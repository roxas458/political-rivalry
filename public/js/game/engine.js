import { Rng } from '../core/rng.js';
import { getMods } from './effects.js';
import { tickEconomy } from './economy.js';
import { tickSociety } from './society.js';
import { tickPolitics } from './politics.js';
import { tickDiplomacy, tickAI, computeInfluence } from './diplomacy.js';
import { maybeEvent } from './events.js';
import { snapshot } from './stats.js';

export function advanceDate(game) {
  game.date.month++;
  if (game.date.month > 12) { game.date.month = 1; game.date.year++; }
}

export function tick(game) {
  const rng = new Rng(game.rngState);
  const c = game.countries[game.playerId];
  const mods = getMods(c);

  advanceDate(game);

  tickSociety(c, rng, mods, game);
  tickEconomy(c, rng, mods, game); // ← передаём game для бонуса от регионов
  tickPolitics(game, c, rng, mods);
  tickDiplomacy(game, rng);

  for (const o of game.countries) if (!o.isPlayer) tickAI(o, rng, game);

  c.diplomacy.influence = computeInfluence(c);
  maybeEvent(game, rng);

  game.history.push(snapshot(c, game));
  if (game.history.length > 240) game.history.shift();
  if (game.log.length > 300) game.log.length = 300;

  game.rngState = rng.s;
  game.turnCount++;
  return game;
}

export function tickMonths(game, n) {
  for (let i = 0; i < n; i++) {
    tick(game);
    if (game.pendingEvent) break;
  }
  return game;
}