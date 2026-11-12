import { LAWS } from './laws.js';
import { clamp } from '../core/util.js';

const MOD_KEYS = ['taxMult','spendMult','growthBonus','corruptionDrift','inflationPressure',
  'approvalBonus','stabilityBonus','healthBonus','eduBonus','unemploymentBonus','militaryBonus',
  'inequalityDrift','pressFreedomDrift'];

export function getMods(c) {
  const m = Object.fromEntries(MOD_KEYS.map(k => [k, 0]));
  for (const id of c.laws || []) {
    const law = LAWS[id];
    if (!law?.mods) continue;
    for (const [k, v] of Object.entries(law.mods)) if (k in m) m[k] += v;
  }
  return m;
}

export function applyEffects(game, c, eff = {}) {
  const e = c.economy, g = c.government, s = c.society, d = c.demography;
  if (eff.approval) s.approval = clamp(s.approval + eff.approval, 0, 100);
  if (eff.stability) g.stability = clamp(g.stability + eff.stability, 0, 100);
  if (eff.corruption) g.corruption = clamp(g.corruption + eff.corruption, 0.01, 0.99);
  if (eff.pressFreedom) g.pressFreedom = clamp(g.pressFreedom + eff.pressFreedom, 0, 1);
  if (eff.civilRights) g.civilRights = clamp(g.civilRights + eff.civilRights, 0, 1);
  if (eff.judiciary) g.judiciary = clamp(g.judiciary + eff.judiciary, 0, 1);
  if (eff.gdpPct) e.gdp = Math.max(1, e.gdp * (1 + eff.gdpPct / 100));
  if (eff.budget) e.debt = Math.max(0, e.debt - eff.budget);
  if (eff.inflation) e.inflation = clamp(e.inflation + eff.inflation, -5, 150);
  if (eff.unemployment) e.unemployment = clamp(e.unemployment + eff.unemployment, 0.5, 60);
  if (eff.pc) c.politicalCapital = clamp(c.politicalCapital + eff.pc, 0, 100);
  if (eff.reputation) c.diplomacy.reputation = clamp(c.diplomacy.reputation + eff.reputation, 0, 100);
  if (eff.relations) {
    for (const id in c.diplomacy.relations)
      c.diplomacy.relations[id] = clamp(c.diplomacy.relations[id] + eff.relations, 0, 100);
  }
  if (eff.populationPct) d.population = Math.max(1e5, d.population * (1 + eff.populationPct / 100));
  if (eff.military) c.military.personnel = Math.max(0, c.military.personnel * (1 + eff.military / 100));
  if (eff.tech) e.techLevel = clamp(e.techLevel + eff.tech, 1, 10);
}