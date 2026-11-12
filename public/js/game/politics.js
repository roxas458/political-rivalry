import { clamp } from '../core/util.js';
import { person } from './names.js';

export const ROLES = {
  finance: 'Министр финансов',
  foreign: 'Министр иностранных дел',
  defense: 'Министр обороны',
  interior: 'Министр внутренних дел',
  economy: 'Министр экономики',
  health: 'Министр здравоохранения',
  education: 'Министр образования',
};

export function assignSeats(c) {
  const total = c.government.parliament.total;
  const sum = c.parties.reduce((a, p) => a + p.support, 0) || 1;
  const raw = c.parties.map(p => (p.support / sum) * total);
  const seats = raw.map(Math.floor);
  let left = total - seats.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < left; k++) seats[order[k % order.length].i]++;
  c.parties.forEach((p, i) => { p.seats = seats[i]; });
}

export function tickPolitics(game, c, rng, mods) {
  const g = c.government, s = c.society;

  // --- Политический капитал ---
  c.politicalCapital = clamp(c.politicalCapital + 1.5 + s.approval / 40 + g.stability / 60, 0, 100);

  // --- Эффективность правительства ---
  const ms = Object.values(g.ministers).filter(Boolean);
  if (ms.length) {
    const comp = ms.reduce((a, m) => a + m.competence, 0) / ms.length;
    const corr = ms.reduce((a, m) => a + m.corruption, 0) / ms.length;
    g.efficiency = clamp(comp - corr * 0.4, 0, 1);
    g.corruption = clamp(g.corruption + (corr * 0.2 - 0.02) * 0.05, 0.02, 0.95);
  } else g.efficiency = 0.3;

  // --- Поддержка партий ---
  for (const p of c.parties) {
    const inGov = g.coalition.includes(p.id);
    const target = clamp(
      p.base + (inGov ? (s.approval - 50) * 0.28 : (50 - s.approval) * 0.14), 0.5, 62);
    p.support = clamp(p.support + (target - p.support) * 0.06 + rng.gauss(0, 0.08), 0.4, 65);
  }
  const sum = c.parties.reduce((a, p) => a + p.support, 0);
  if (sum > 0) c.parties.forEach(p => { p.support = (p.support / sum) * 100; });
  assignSeats(c);

  // --- Выборы ---
  c.electionIn -= 1;
  if (c.electionIn <= 0) holdElection(game, c, rng, 'parliamentary');

  // --- Импичмент-риск ---
  const ruling = c.parties.find(p => p.id === g.rulingPartyId);
  const oppSeats = c.parties.filter(p => !g.coalition.includes(p.id))
    .reduce((a, p) => a + p.seats, 0);
  if (s.approval < 25 && oppSeats > c.government.parliament.total * 0.55 && rng.chance(0.04)) {
    impeach(game, c, rng);
  }
}

export function holdElection(game, c, rng, type = 'parliamentary') {
  const g = c.government, s = c.society;
  assignSeats(c);
  const ruling = c.parties.find(p => p.id === g.rulingPartyId);
  const majority = Math.floor(g.parliament.total / 2) + 1;

  if (type === 'presidential') {
    const win = clamp((s.approval - 40) / 100 + (ruling.seats / g.parliament.total - 0.35), 0.05, 0.9);
    if (rng.chance(win)) {
      g.president.name = person(rng).name;
      game.log.unshift({ date: { ...game.date }, type: 'good',
        text: `Президентские выборы: победа действующей власти (${g.president.name})` });
    } else {
      const challenger = c.parties.filter(p => p.id !== g.rulingPartyId)
        .sort((a, b) => b.seats - a.seats)[0];
      g.president.name = person(rng).name;
      g.president.partyId = challenger.id;
      s.approval = clamp(s.approval - 5, 0, 100);
      game.log.unshift({ date: { ...game.date }, type: 'bad',
        text: `Президентские выборы: оппозиция побеждает (${challenger.name})` });
    }
    return;
  }

  if (ruling.seats >= majority) {
    g.coalition = [ruling.id];
    game.log.unshift({ date: { ...game.date }, type: 'good',
      text: `Парламентские выборы: ${ruling.name} сохраняет большинство (${ruling.seats} мест)` });
  } else {
    g.coalition = [ruling.id];
    game.log.unshift({ date: { ...game.date }, type: 'warn',
      text: `Парламентские выборы: у ${ruling.name} нет большинства — требуется коалиция` });
  }
  g.parliament.seats = Object.fromEntries(c.parties.map(p => [p.id, p.seats]));
  c.electionIn = c.termMonths;
}

export function formCoalition(game, c, partnerIds) {
  const g = c.government;
  const majority = Math.floor(g.parliament.total / 2) + 1;
  const seats = c.parties.filter(p => [g.rulingPartyId, ...partnerIds].includes(p.id))
    .reduce((a, p) => a + p.seats, 0);
  if (seats < majority) return { ok: false, msg: 'Недостаточно мест для большинства' };
  const cost = partnerIds.length * 8;
  if (c.politicalCapital < cost) return { ok: false, msg: 'Не хватает политического капитала' };
  c.politicalCapital -= cost;
  g.coalition = [g.rulingPartyId, ...partnerIds];
  g.stability = clamp(g.stability + 4, 0, 100);
  game.log.unshift({ date: { ...game.date }, type: 'good',
    text: `Сформирована коалиция (${seats} из ${g.parliament.total} мест)` });
  return { ok: true };
}

export function impeach(game, c, rng) {
  const g = c.government;
  g.president.name = person(rng).name;
  const opp = c.parties.filter(p => p.id !== g.rulingPartyId).sort((a, b) => b.seats - a.seats)[0];
  g.rulingPartyId = opp.id;
  g.coalition = [opp.id];
  c.society.approval = clamp(c.society.approval + 8, 0, 100);
  g.stability = clamp(g.stability - 10, 0, 100);
  game.log.unshift({ date: { ...game.date }, type: 'bad',
    text: `Импичмент! Президент отстранён, к власти пришла ${opp.name}` });
}