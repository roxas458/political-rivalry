import { clamp } from '../core/util.js';

const IDEOLOGY_AXIS = {
  liberal: 0, socialdemocrat: 1, socialist: 2, centrist: 3, technocratic: 4,
  conservative: 5, nationalist: 6, authoritarian: 7,
};

function similarity(a, b) {
  const x = IDEOLOGY_AXIS[a] ?? 3, y = IDEOLOGY_AXIS[b] ?? 3;
  return 1 - Math.abs(x - y) / 7;
}

export function tickDiplomacy(game, rng) {
  const c = game.countries[game.playerId];

  for (const o of game.countries) {
    if (o.isPlayer) continue;
    const key = String(o.id);
    const rel = c.diplomacy.relations[key] ?? 50;
    const sim = similarity(c.government.ideology, o.government.ideology);
    const trade = c.diplomacy.agreements.some(a => a.type === 'trade' && a.with === o.id) ? 0.4 : 0;
    const ally = c.diplomacy.agreements.some(a => a.type === 'alliance' && a.with === o.id) ? 0.6 : 0;
    const sanction = c.diplomacy.sanctions.includes(o.id) ? -1.2 : 0;
    const drift = (50 - rel) * 0.012 + sim * 0.5 + trade + ally + sanction;
    c.diplomacy.relations[key] = clamp(rel + drift + rng.gauss(0, 0.5), 0, 100);
  }

  c.tradeAgreementsCount = c.diplomacy.agreements.filter(a => a.type === 'trade').length;
  c.diplomacy.allies = c.diplomacy.agreements.filter(a => a.type === 'alliance').map(a => a.with);
  c.diplomacy.reputation = clamp(
    c.diplomacy.reputation + 0.03 * (1 - c.government.corruption)
    - (c.diplomacy.sanctions.length > 2 ? 0.05 : 0), 0, 100);
}

export function tickAI(ai, rng, game) {
  const e = ai.economy, d = ai.demography;
  const growth = clamp(
    rng.gauss(2.2 + (ai.development - 0.5) * -1.5, 0.8), -8, 12);
  e.growth = growth;
  e.gdp = Math.max(1, e.gdp * (1 + growth / 100));
  e.inflation = clamp(e.inflation + rng.gauss(0, 0.25) + (2 - e.inflation) * 0.05, -2, 60);
  d.population = Math.max(1e5, d.population * (1 + (d.birthRate - d.deathRate) / 1000 / 12));
  e.gdpPerCapita = (e.gdp * 1e9) / d.population;
  ai.government.stability = clamp(ai.government.stability + rng.gauss(0, 0.4), 0, 100);
}

export function computeInfluence(c) {
  const e = c.economy;
  return clamp(
    Math.log10(Math.max(1, e.gdp)) * 9
    + c.military.personnel / 12000
    + c.diplomacy.reputation * 0.22
    + (c.diplomacy.allies?.length || 0) * 3
    + (c.diplomacy.agreements?.length || 0) * 1.2, 0, 100);
}