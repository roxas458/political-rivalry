import { h } from './core/dom.js';
import { dateStr, money, people, pct, num1 } from './core/util.js';
import { Rng } from './core/rng.js';
import { createGame } from './game/state.js';
import { tick } from './game/engine.js';
import { resolveEvent } from './game/events.js';
import { LAWS } from './game/laws.js';
import { ROLES, formCoalition } from './game/politics.js';
import { person } from './game/names.js';
import { renderSetup } from './ui/setup.js';
import { VIEWS } from './ui/views.js';
import { card, btn, grid } from './ui/components.js';
import { applyEffects } from './game/effects.js';

const NAV = [
  { id: 'dashboard',   label: 'Обзор',         ico: '📊' },
  { id: 'government',  label: 'Правительство', ico: '🏛️' },
  { id: 'economy',     label: 'Экономика',     ico: '💰' },
  { id: 'society',     label: 'Общество',      ico: '👥' },
  { id: 'diplomacy',   label: 'Дипломатия',    ico: '🌍' },
  { id: 'military',    label: 'Армия',         ico: '⚔️' },
  { id: 'map',         label: 'Карта',         ico: '🗺️' },
  { id: 'world',       label: 'Мир',           ico: '🌐' },
  { id: 'statistics',  label: 'Статистика',    ico: '📈' },
];

const app = {
  game: null,
  tab: 'dashboard',
  playing: false,
  timer: null,
  speed: 1200,
  root: document.getElementById('app'),
  rng() { return new Rng(this.game.rngState ^ Date.now()); },

  start(cfg) {
    this.game = createGame(cfg);
    this.tab = 'dashboard';
    this.render();
  },

  refresh() { this.render(); },

  toast(msg, type = '') {
    const box = document.getElementById('toasts');
    const el = h('div', { class: `toast ${type}` }, msg);
    box.append(el);
    setTimeout(() => el.remove(), 3500);
  },

  modal(node, { onClose } = {}) {
    const root = document.getElementById('modal-root');
    root.innerHTML = '';
    const close = () => { root.innerHTML = ''; onClose?.(); };
    root.append(h('div', { class: 'modal-bg', onclick: (e) => { if (e.target.classList.contains('modal-bg')) close(); } },
      h('div', { class: 'modal' }, node)));
    return close;
  },

  step(n = 1) {
    if (!this.game) return;
    for (let i = 0; i < n; i++) {
      tick(this.game);
      if (this.game.pendingEvent) { this.pause(); break; }
    }
    this.render();
    if (this.game.pendingEvent) this.showEvent();
  },

  togglePlay() {
    this.playing ? this.pause() : this.play();
  },
  play() {
    if (this.playing) return;
    this.playing = true;
    this.timer = setInterval(() => {
      if (!this.game.pendingEvent) this.step(1);
    }, this.speed);
    this.render();
  },
  pause() {
    this.playing = false;
    clearInterval(this.timer);
    this.timer = null;
    this.render();
  },

  /* ---------- Действия ---------- */
  showEvent() {
    const ev = this.game.pendingEvent;
    if (!ev) return;
    const close = this.modal(h('div', {},
      h('div', { class: 'modal-head' }, ev.title),
      h('div', { class: 'modal-body' },
        h('p', { style: { marginTop: 0, color: 'var(--muted)' } }, ev.text),
        h('div', { class: 'btn-row', style: { flexDirection: 'column', alignItems: 'stretch' } },
          ev.options.map((o, i) => btn(o.label, () => {
            resolveEvent(this.game, i);
            close();
            this.render();
          }, 'primary')))),
    ), { onClose: () => {} });
  },

  passLaw(id) {
    const g = this.game, c = g.countries[g.playerId];
    const law = LAWS[id];
    if (!law || c.laws.includes(id)) return;
    if (law.cost > c.politicalCapital) return this.toast('Недостаточно политического капитала', 'bad');
    const majority = Math.floor(c.government.parliament.total / 2) + 1;
    const coalitionSeats = c.parties.filter(p => c.government.coalition.includes(p.id))
      .reduce((a, p) => a + p.seats, 0);
    if (coalitionSeats < majority) return this.toast('Нет большинства в парламенте', 'bad');

    c.politicalCapital -= law.cost;
    c.laws.push(id);
    c.society.approval = Math.min(100, c.society.approval + (law.mods.approvalBonus || 0));
    g.log.unshift({ date: { ...g.date }, type: 'good', text: `Принят закон: ${law.name}` });
    this.render();
  },

  pickMinister(role) {
    const g = this.game, c = g.countries[g.playerId];
    const rng = this.rng();
    const candidates = Array.from({ length: 4 }, () => person(rng));
    const close = this.modal(h('div', {},
      h('div', { class: 'modal-head' }, ROLES[role]),
      h('div', { class: 'modal-body' },
        h('div', { class: 'btn-row', style: { flexDirection: 'column', alignItems: 'stretch' } },
          candidates.map(cand => btn(
            `${cand.name} — комп. ${pct(cand.competence * 100)}, лояльн. ${pct(cand.loyalty * 100)}, корр. ${pct(cand.corruption * 100)}`,
            () => {
              c.government.ministers[role] = cand;
              close();
              this.render();
            })))),
    ));
  },

  openCoalition() {
    const g = this.game, c = g.countries[g.playerId];
    const gov = c.government;
    const partners = c.parties.filter(p => p.id !== gov.rulingPartyId);
    const chosen = new Set();
    const close = this.modal(h('div', {},
      h('div', { class: 'modal-head' }, 'Формирование коалиции'),
      h('div', { class: 'modal-body' },
        partners.map(p => h('label', { style: { display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, padding: '8px 0', minHeight: 36 } },
          h('input', {
            type: 'checkbox',
            style: { width: 20, height: 20, flexShrink: 0 },
            onchange: (e) => e.target.checked ? chosen.add(p.id) : chosen.delete(p.id),
          }),
          h('span', {}, `${p.name} — ${p.seats} мест`))),
        h('div', { class: 'btn-row', style: { marginTop: 14 } },
          btn('Сформировать', () => {
            const res = formCoalition(g, c, [...chosen]);
            close();
            this.toast(res.ok ? 'Коалиция сформирована' : res.msg, res.ok ? 'good' : 'bad');
            this.render();
          }, 'primary'))),
    ));
  },

  impeach() {
    const g = this.game, c = g.countries[g.playerId];
    const oppSeats = c.parties.filter(p => !c.government.coalition.includes(p.id))
      .reduce((a, p) => a + p.seats, 0);
    if (oppSeats < c.government.parliament.total / 2)
      return this.toast('Оппозиция не имеет большинства', 'bad');
    if (c.politicalCapital < 40) return this.toast('Нужно 40 ПК', 'bad');
    c.politicalCapital -= 40;
    const rng = this.rng();
    c.government.president.name = person(rng).name;
    c.society.approval = Math.min(100, c.society.approval + 10);
    g.log.unshift({ date: { ...g.date }, type: 'bad', text: 'Президент отправлен в отставку' });
    this.render();
  },

  privatize(pctShare) {
    const g = this.game, c = g.countries[g.playerId];
    const se = c.economy.stateEnterprises;
    const amount = Math.round(se.count * pctShare / 100);
    se.count = Math.max(0, se.count - amount);
    c.economy.debt = Math.max(0, c.economy.debt - c.economy.gdp * 0.02 * amount / 10);
    c.society.approval = Math.max(0, c.society.approval - 2);
    g.log.unshift({ date: { ...g.date }, type: 'warn', text: `Приватизировано ${amount}% госпредприятий` });
    this.render();
  },

  nationalize(pctShare) {
    const g = this.game, c = g.countries[g.playerId];
    const se = c.economy.stateEnterprises;
    se.count = Math.min(100, se.count + Math.round(pctShare));
    c.economy.debt += c.economy.gdp * 0.02 * pctShare / 10;
    c.society.approval = Math.min(100, c.society.approval + 1);
    g.log.unshift({ date: { ...g.date }, type: 'warn', text: 'Проведена национализация' });
    this.render();
  },

  diploAction(type, target) {
    const g = this.game, c = g.countries[g.playerId];
    const key = target ? String(target.id) : null;

    switch (type) {
      case 'improve': {
        if (c.politicalCapital < 5) return this.toast('Нужно 5 ПК', 'bad');
        c.politicalCapital -= 5;
        c.diplomacy.relations[key] = Math.min(100, (c.diplomacy.relations[key] ?? 50) + 8);
        this.toast(`Отношения с ${target.name} улучшены`, 'good');
        break;
      }
      case 'trade': {
        if (c.politicalCapital < 10) return this.toast('Нужно 10 ПК', 'bad');
        c.politicalCapital -= 10;
        c.diplomacy.agreements.push({ type: 'trade', with: target.id });
        c.diplomacy.relations[key] = Math.min(100, (c.diplomacy.relations[key] ?? 50) + 6);
        this.toast(`Торговое соглашение с ${target.name}`, 'good');
        break;
      }
      case 'alliance': {
        const rel = c.diplomacy.relations[key] ?? 50;
        if (rel < 70) return this.toast('Нужны отношения ≥ 70', 'bad');
        if (c.politicalCapital < 20) return this.toast('Нужно 20 ПК', 'bad');
        c.politicalCapital -= 20;
        c.diplomacy.agreements.push({ type: 'alliance', with: target.id });
        c.diplomacy.reputation = Math.min(100, c.diplomacy.reputation + 4);
        this.toast(`Военный союз с ${target.name}`, 'good');
        break;
      }
      case 'sanction': {
        c.diplomacy.sanctions.push(target.id);
        c.diplomacy.relations[key] = Math.max(0, (c.diplomacy.relations[key] ?? 50) - 20);
        c.diplomacy.reputation = Math.max(0, c.diplomacy.reputation - 3);
        c.economy.gdp *= 0.997;
        this.toast(`Санкции против ${target.name}`, 'bad');
        break;
      }
      case 'summit': {
        if (c.politicalCapital < 20) return this.toast('Нужно 20 ПК', 'bad');
        c.politicalCapital -= 20;
        c.diplomacy.reputation = Math.min(100, c.diplomacy.reputation + 6);
        applyEffects(g, c, { relations: 5, budget: -5 });
        this.toast('Саммит прошёл успешно', 'good');
        break;
      }
      case 'embassy': {
        applyEffects(g, c, { relations: 4 });
        this.toast('Посольства открыты', 'good');
        break;
      }
    }
    this.render();
  },

  militaryAction(type) {
    const g = this.game, c = g.countries[g.playerId];
    switch (type) {
      case 'drill':
        c.military.readiness = Math.min(100, c.military.readiness + 6);
        c.economy.debt += c.economy.gdp * 0.003;
        break;
      case 'industry':
        if (c.politicalCapital < 15) return this.toast('Нужно 15 ПК', 'bad');
        c.politicalCapital -= 15;
        c.military.industry = Math.min(100, c.military.industry + 8);
        c.economy.gdp *= 1.002;
        break;
      case 'treaty':
        c.military.treaties.push('Ограничение вооружений');
        c.diplomacy.reputation = Math.min(100, c.diplomacy.reputation + 5);
        break;
    }
    this.render();
  },

  /* ---------- Рендер ---------- */
  render() {
    this.root.innerHTML = '';
    if (!this.game) {
      this.root.append(renderSetup((cfg) => this.start(cfg)));
      return;
    }
    const g = this.game, c = g.countries[g.playerId];

    // Топбар
    const top = h('header', { class: 'topbar' },
      h('div', { class: 'brand' }, 'POLITICAL RIVALRY'),
      h('div', { class: 'meta' }, `${c.flag.emblem} ${c.name} · ${c.capital}`),
      h('div', { class: 'meta' }, dateStr(g.date)),
      h('div', { class: 'spacer' }),
      h('div', { class: 'res' },
        h('span', {}, 'ВВП ', h('b', {}, money(c.economy.gdp))),
        h('span', {}, 'Нас. ', h('b', {}, people(c.demography.population))),
        h('span', {}, 'Одобр. ', h('b', {}, pct(c.society.approval))),
        h('span', {}, 'ПК ', h('b', {}, num1(c.politicalCapital)))),
      h('div', { class: 'controls' },
        btn(this.playing ? '⏸' : '▶', () => this.togglePlay(), this.playing ? '' : 'primary'),
        btn('+1м', () => this.step(1)),
        btn('+1г', () => this.step(12)),
        btn('💾', () => this.save()),
        btn('📂', () => this.load())));

    // Сайдбар / нижняя навигация
    const sidebar = h('nav', { class: 'sidebar' },
      NAV.map(item => h('div', {
        class: `nav-item ${this.tab === item.id ? 'active' : ''}`,
        onclick: () => { this.tab = item.id; this.render(); },
      },
        h('span', { class: 'ico' }, item.ico),
        h('span', {}, item.label))));

    // Контент
    const view = (VIEWS[this.tab] || VIEWS.dashboard)(g, this);
    const main = h('main', {}, view);

    this.root.append(top, sidebar, main);
  },

  async save() {
    try {
      await fetch('/api/save/slot1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.game),
      });
      this.toast('Игра сохранена', 'good');
    } catch { this.toast('Ошибка сохранения', 'bad'); }
  },

  async load() {
    try {
      const res = await fetch('/api/save/slot1');
      const data = await res.json();
      if (!data) return this.toast('Сохранений нет', 'bad');
      this.game = data;
      this.render();
      this.toast('Игра загружена', 'good');
    } catch { this.toast('Ошибка загрузки', 'bad'); }
  },
};

window.app = app;
app.render();