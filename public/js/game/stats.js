import { clamp } from '../core/util.js';
import { computeInfluence } from './diplomacy.js';

export function hdi(c) {
  const life = clamp((c.demography.lifeExpectancy - 20) / 65, 0, 1);
  const edu = clamp(c.demography.education.index / 100, 0, 1);
  const inc = clamp(Math.log10(Math.max(100, c.economy.gdpPerCapita)) / Math.log10(75000), 0, 1);
  return ((life + edu + inc) / 3) * 100;
}

export function democracyIndex(c) {
  const g = c.government;
  let v = g.pressFreedom * 20 + g.civilRights * 20 + g.judiciary * 15
        + (1 - g.corruption) * 15 + (c.electionsFree ? 20 : 0);
  if (g.system === 'authoritarian') v -= 30;
  if (g.system === 'monarchy') v -= 15;
  return clamp(v, 0, 100);
}

export function snapshot(c, game) {
  return {
    y: game.date.year, m: game.date.month,
    gdp: c.economy.gdp,
    gdpPerCapita: c.economy.gdpPerCapita,
    population: c.demography.population,
    approval: c.society.approval,
    stability: c.government.stability,
    hdi: hdi(c),
    inflation: c.economy.inflation,
    unemployment: c.economy.unemployment,
    debtRatio: c.economy.debtRatio * 100,
    influence: computeInfluence(c),
  };
}

export function rankings(game, key, dir = -1) {
  const rows = game.countries.map(c => ({
    id: c.id,
    name: c.name,
    isPlayer: !!c.isPlayer,
    value: {
      gdp: c.economy.gdp,
      gdpPerCapita: c.economy.gdpPerCapita,
      population: c.demography.population,
      hdi: hdi(c),
      military: c.military.personnel,
      influence: computeInfluence(c),
      stability: c.government.stability,
      education: c.demography.education.index,
      health: c.demography.health.index,
    }[key],
  }));
  return rows.sort((a, b) => (b.value - a.value) * (dir < 0 ? 1 : -1));
}