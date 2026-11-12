import { clamp } from '../core/util.js';

export function taxBurden(c) {
  const r = c.economy.taxRates;
  return r.income * 0.40 + r.corporate * 0.25 + r.vat * 0.20 + r.property * 0.15;
}

export function budget(c, mods) {
  const e = c.economy, g = c.government;
  const compliance = clamp(1 - g.corruption * 0.55 + g.judiciary * 0.15, 0.30, 1.05);
  const revenue = e.gdp * taxBurden(c) * 1.45 * compliance * (1 + (mods?.taxMult || 0))
                + e.stateEnterprises.revenueAnnual;
  const spendRate = Object.values(e.spending).reduce((a, b) => a + b, 0);
  const interest = e.debt * Math.max(0, e.interestRate) / 100;
  const expenditure = e.gdp * spendRate * (1 + (mods?.spendMult || 0)) + interest;
  return { revenue, expenditure, interest, balance: revenue - expenditure, spendRate, compliance };
}

/* ---------- Бонус к росту от регионов (ресурсы + инфраструктура) ---------- */
const RESOURCE_GROWTH = {
  'нефть':      0.50,
  'газ':        0.40,
  'уголь':      0.30,
  'железо':     0.30,
  'золото':     0.20,
  'лес':        0.20,
  'рыба':       0.15,
  'зерно':      0.25,
  'виноград':   0.15,
  'уран':       0.60,
  'редкозем':   0.70,
  'вода':       0.10,
};

export function regionGrowthBonus(game, countryId) {
  if (!game?.world?.regions) return 0;
  let bonus = 0;
  for (const r of game.world.regions) {
    if (r.countryId !== countryId) continue;
    if (r.resource && RESOURCE_GROWTH[r.resource]) {
      bonus += RESOURCE_GROWTH[r.resource] * (r.richness || 0.5) * 0.4;
    }
    bonus += (r.infrastructure || 0) * 0.15;
  }
  // ограничиваем, чтобы не улететь в космос
  return Math.min(bonus, 3.0);
}

export function tickEconomy(c, rng, mods = {}, game = null) {
  const e = c.economy, g = c.government, d = c.demography;
  const b = budget(c, mods);
  e.revenue = b.revenue;
  e.expenditure = b.expenditure;
  e.balance = b.balance;

  const debtRatio = e.debt / Math.max(1, e.gdp);
  e.debt = Math.max(0, e.debt + b.balance / 12);
  e.debtRatio = e.debt / Math.max(1, e.gdp);

  // --- Инфляция ---
  let pressure = 0;
  pressure += Math.max(0, -b.balance / Math.max(1, e.gdp) - 0.03) * 55;
  pressure += (1 - e.centralBank.independence) * 1.5;
  pressure -= (e.interestRate - 2.5) * 0.30;
  pressure += mods.inflationPressure || 0;
  pressure += Math.max(0, e.debtRatio - 0.9) * 4;
  const targetInfl = clamp(2 + pressure, -3, 60);
  e.inflation = clamp(e.inflation + (targetInfl - e.inflation) * 0.18 + rng.gauss(0, 0.12), -5, 120);

  // --- Рост ВВП ---
  const human = (d.education.index + d.health.index) / 200;
  const inst = (1 - g.corruption) * 0.45 + g.judiciary * 0.25 + e.economicFreedom * 0.30;
  const debtPenalty = clamp((e.debtRatio - 0.7) * 2.2, 0, 4);
  const inflPenalty = clamp((e.inflation - 6) * 0.10, 0, 2.5);
  const catchUp = clamp((30000 - e.gdpPerCapita) / 30000 * 4, 0, 4);
  const resourceBonus = regionGrowthBonus(game, c.id);

  const potential = 0.3 + human * 1.7 + inst * 1.4 + (e.techLevel - 5) * 0.22 + catchUp
    + (mods.growthBonus || 0) + resourceBonus
    - debtPenalty - inflPenalty - g.corruption * 0.7;

  const growth = clamp(potential + rng.gauss(0, 0.9), -14, 14);
  e.growth = growth;
  e.gdp = Math.max(1, e.gdp * (1 + growth / 100));

  // --- Безработица (закон Оукена) ---
  e.unemployment = clamp(
    e.unemployment - (growth - 2.5) * 0.16 + rng.gauss(0, 0.10) + (mods.unemploymentBonus || 0) * 0.08,
    1.2, 45);

  // --- Торговля ---
  const openness = 0.45 + e.economicFreedom * 0.5 + e.techLevel * 0.02;
  const tradeBonus = (c.tradeAgreementsCount || 0) * 0.03;
  e.exports = e.gdp * clamp(openness * 0.55 + tradeBonus, 0.08, 0.80);
  e.imports = e.gdp * clamp(openness * 0.55 + tradeBonus + (e.inflation > 12 ? 0.05 : 0), 0.08, 0.85);
  e.tradeBalance = e.exports - e.imports;

  // --- Производные показатели ---
  e.gdpPerCapita = (e.gdp * 1e9) / c.demography.population;
  const real = 1 + e.inflation / 100;
  e.avgWage = e.gdpPerCapita * 0.055 * (1 - (e.unemployment - 6) * 0.005);
  e.realWage = e.avgWage / real;
  e.pension = e.avgWage * (0.30 + e.spending.social * 1.1);
  e.socialBenefit = e.avgWage * 0.22;

  // --- Бедность и неравенство ---
  const povertyTarget = clamp(
    42 - e.gdpPerCapita / 900 + e.unemployment * 0.7 + e.inequality * 35 - e.spending.social * 120,
    0.5, 88);
  e.poverty += (povertyTarget - e.poverty) * 0.08;
  e.inequality = clamp(
    e.inequality + (mods.inequalityDrift || 0) - (e.spending.social - 0.10) * 0.01
    + (growth > 4 ? 0.002 : -0.001), 0.15, 0.75);

  // --- Валюта ---
  const depreciate = (e.inflation - 2) * 0.0012 - (growth - 2) * 0.0008;
  e.currency.value = clamp(e.currency.value * (1 - depreciate), 20, 100);

  // --- Госпредприятия ---
  e.stateEnterprises.revenueAnnual =
    e.gdp * 0.05 * (e.stateEnterprises.count / 100) * e.stateEnterprises.efficiency;

  // --- Центральный банк ---
  if (e.centralBank.independence > 0.5) {
    e.interestRate = clamp(2.5 + (e.inflation - 2) * 1.2 + (growth - 3) * 0.4, 0, 30);
  }

  // --- Технологии ---
  e.techLevel = clamp(
    e.techLevel + (d.education.index / 100 - 0.5) * 0.012 + (e.spending.education - 0.04) * 0.15, 1, 10);
}