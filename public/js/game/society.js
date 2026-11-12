import { clamp } from '../core/util.js';

export function tickSociety(c, rng, mods, game) {
  const d = c.demography, e = c.economy, g = c.government, s = c.society;

  // --- Демография ---
  const dev = clamp(e.gdpPerCapita / 40000, 0.05, 1.4);
  const birthTarget = clamp(24 - dev * 8 + (d.religiosity - 0.5) * 4 + (s.wellbeing - 50) * 0.04, 6, 45);
  d.birthRate = clamp(d.birthRate + (birthTarget - d.birthRate) * 0.05 + rng.gauss(0, 0.05), 4, 50);

  const deathTarget = clamp(20 - d.health.index * 0.13 - (e.gdpPerCapita / 60000) * 3
    + (d.lifeExpectancy - 70) * -0.02, 3, 32);
  d.deathRate = clamp(d.deathRate + (deathTarget - d.deathRate) * 0.05 + rng.gauss(0, 0.05), 2, 35);

  const worldAvg = game ? game.worldAvgGdpPerCapita : e.gdpPerCapita;
  const migTarget = clamp(
    (e.gdpPerCapita - worldAvg) / 1800 + (1 - g.corruption) * 3
    + (g.civilRights - 0.5) * 4 + (g.stability - 50) * 0.05 - 4.5, -8, 12);
  d.migrationRate = clamp(d.migrationRate + (migTarget - d.migrationRate) * 0.1, -12, 15);

  const births = d.population * d.birthRate / 1000 / 12;
  const deaths = d.population * d.deathRate / 1000 / 12;
  const migration = d.population * d.migrationRate / 1000 / 12;
  d.births = births; d.deaths = deaths; d.netMigration = migration;
  d.population = Math.max(1e5, d.population + births - deaths + migration);

  // --- Продолжительность жизни ---
  const lifeTarget = clamp(45 + d.health.index * 0.38 - e.poverty * 0.10 - e.inequality * 6, 35, 92);
  d.lifeExpectancy += (lifeTarget - d.lifeExpectancy) * 0.04;

  // --- Возрастная структура ---
  d.ageStructure.youth = clamp(42 - (d.lifeExpectancy - 60) * 0.5, 8, 50);
  d.ageStructure.elderly = clamp((d.lifeExpectancy - 60) * 1.4, 5, 38);
  d.ageStructure.working = clamp(100 - d.ageStructure.youth - d.ageStructure.elderly, 30, 75);

  // --- Образование ---
  const eduTarget = clamp(10 + e.spending.education * 900 + (e.gdpPerCapita / 1000) * 0.9
    + (mods.eduBonus || 0) * 6, 5, 99);
  d.education.index += (eduTarget - d.education.index) * 0.04;
  d.education.literacy = clamp(d.education.index * 1.05, 20, 99.9);
  d.education.schools = Math.round(d.population / 1e6 * (1 + d.education.index / 100) * 4);
  d.education.universities = Math.round(d.population / 1e6 * 0.25 * (d.education.index / 60));
  d.education.teachers = Math.round(d.population / 1e6 * 12 * (d.education.index / 60));

  // --- Здравоохранение ---
  const healthTarget = clamp(12 + e.spending.health * 1000 + (e.gdpPerCapita / 1000) * 0.8
    + (mods.healthBonus || 0) * 6, 5, 99);
  d.health.index += (healthTarget - d.health.index) * 0.04;
  d.health.hospitals = Math.round(d.population / 1e6 * 0.35 * (d.health.index / 50));
  d.health.doctors = Math.round(d.population / 1e6 * 3.2 * (d.health.index / 50));
  d.health.access = clamp(d.health.index * 0.95 + e.spending.health * 100, 5, 99);

  // --- Преступность ---
  const crimeTarget = clamp(18 + e.poverty * 0.8 + e.unemployment * 0.5 + e.inequality * 30 - 8, 2, 95);
  d.crimeRate += (crimeTarget - d.crimeRate) * 0.06;

  // --- Общественное благополучие ---
  const wellbeingTarget = clamp(
    Math.log10(Math.max(500, e.gdpPerCapita)) * 16 - 25
    + d.health.index * 0.20 + d.education.index * 0.15
    - d.crimeRate * 0.15 - e.inequality * 20 + (g.civilRights - 0.5) * 10, 0, 100);
  s.wellbeing += (wellbeingTarget - s.wellbeing) * 0.08;

  // --- Коррупция, свободы ---
  g.corruption = clamp(
    g.corruption + (mods.corruptionDrift || 0)
    + (0.4 - g.judiciary) * 0.0022 + (g.pressFreedom - 0.5) * 0.0015 - 0.0012
    + (g.efficiency < 0.5 ? 0.0008 : 0), 0.02, 0.95);
  g.pressFreedom = clamp(g.pressFreedom + (mods.pressFreedomDrift || 0) + (1 - g.corruption) * 0.0005, 0.02, 1);
  g.judiciary = clamp(g.judiciary + (1 - g.corruption) * 0.0004 - 0.0002, 0.02, 1);
  g.civilRights = clamp(g.civilRights + (g.pressFreedom - 0.5) * 0.0008, 0.02, 1);

  // --- Одобрение правительства ---
  const approvalTarget = clamp(
    45
    + clamp((e.growth - 1.5) * 3, -12, 12)
    + clamp((e.inflation - 4) * -1.2, -12, 6)
    + clamp((8 - e.unemployment) * 1.0, -12, 10)
    + (g.pressFreedom - 0.5) * 8
    + (g.civilRights - 0.5) * 8
    - (g.corruption - 0.30) * 20
    + (mods.approvalBonus || 0)
    - (s.scandalTimer > 0 ? 8 : 0)
    - (c.military.atWar ? 6 : 0)
    + (s.wellbeing - 50) * 0.10, 1, 99);
  s.approval += (approvalTarget - s.approval) * 0.20;
  s.scandalTimer = Math.max(0, s.scandalTimer - 1);

  // --- Недовольство ---
  s.discontent = clamp(100 - s.approval + e.inequality * 20 + (e.poverty - 15) * 0.5, 0, 100);

  // --- Стабильность ---
  const stabTarget = clamp(
    50 + (s.approval - 50) * 0.6 - s.discontent * 0.18 + (mods.stabilityBonus || 0)
    + g.judiciary * 10 + (g.civilRights - 0.5) * 8 - (s.protestTimer > 0 ? 15 : 0), 0, 100);
  g.stability += (stabTarget - g.stability) * 0.15;
  s.protestTimer = Math.max(0, s.protestTimer - 1);

  // --- Риск протестов ---
  if (rng.chance(clamp((s.discontent - 55) / 260, 0, 0.5))) {
    s.protestTimer = 3;
    s.approval = clamp(s.approval - 3, 0, 100);
    game?.log.unshift({ date: { ...game.date }, type: 'bad', text: 'Массовые протесты в крупных городах' });
  }
}