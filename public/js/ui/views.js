import { h, card, grid, statBox, bar, btn, table, slider, drawChart } from './components.js';
import { money, num, num1, num2, people, pct, clamp, dateStr } from '../core/util.js';
import { LAWS } from '../game/laws.js';
import { budget, taxBurden } from '../game/economy.js';
import { hdi, democracyIndex, rankings } from '../game/stats.js';
import { ROLES, holdElection } from '../game/politics.js';
import { computeInfluence } from '../game/diplomacy.js';

/* ----------------------------- Обзор ----------------------------- */
export function viewDashboard(g, app) {
  const c = g.countries[g.playerId];
  const e = c.economy, d = c.demography, s = c.society, gov = c.government;

  const recent = g.log.slice(0, 12);

  return h('div', {},
    grid('g6',
      statBox('ВВП', money(e.gdp), `рост ${pct(e.growth)}`),
      statBox('ВВП на душу', `${num(e.gdpPerCapita)} $`, `инфляция ${pct(e.inflation)}`),
      statBox('Население', people(d.population), `безработица ${pct(e.unemployment)}`),
      statBox('Одобрение', pct(s.approval), `недовольство ${pct(s.discontent)}`),
      statBox('Стабильность', pct(gov.stability), `коррупция ${pct(gov.corruption * 100)}`),
      statBox('Долг / ВВП', pct(e.debtRatio * 100), money(e.debt))),

    grid('g2',
      card('Правительство',
        h('div', { class: 'country-row' },
          h('div', { class: 'flag-preview', style: {
            width: 46, height: 30, fontSize: 15,
            background: `linear-gradient(135deg, ${c.flag.colors[0]} 0 50%, ${c.flag.colors[1]} 50% 75%, ${c.flag.colors[2]} 75% 100%)`,
          } }, c.flag.emblem),
          h('div', { class: 'nm' },
            h('div', { style: { fontWeight: 600 } }, c.name),
            h('div', { style: { color: 'var(--muted)', fontSize: 12.5 } },
              `${c.capital} · ${gov.system}`))),
        h('div', { style: { marginTop: '12px' } },
          bar('Одобрение правительства', s.approval, 100, s.approval > 50 ? 'good' : 'bad'),
          bar('Политическая стабильность', gov.stability, 100, gov.stability > 50 ? 'good' : 'warn'),
          bar('Коррупция', gov.corruption * 100, 100, 'bad')),
        h('div', { style: { marginTop: '10px', color: 'var(--muted)', fontSize: 13 } },
          `Президент: ${gov.president?.name ?? '—'}`),
        h('div', { style: { color: 'var(--muted)', fontSize: 13 } },
          `До выборов: ${c.electionIn ?? '—'} мес. · Полит. капитал: ${num1(c.politicalCapital)}`)),

      card('Ключевые показатели',
        grid('g2',
          statBox('Бюджет', money(e.balance), e.balance >= 0 ? 'профицит' : 'дефицит'),
          statBox('Инфляция', pct(e.inflation), `ставка ЦБ ${pct(e.interestRate)}`),
          statBox('Безработица', pct(e.unemployment), `бедность ${pct(e.poverty)}`),
          statBox('HDI', num1(hdi(c)), `демократия ${num1(democracyIndex(c))}`)))),

    card('Последние события',
      h('div', { class: 'log' },
        recent.length
          ? recent.map(l => h('div', { class: 'log-item' },
              h('span', { class: 't' }, dateStr(l.date)), h('b', {}, l.text)))
          : h('div', { class: 'log-item' }, 'Пока тихо…'))));
}

/* --------------------------- Правительство --------------------------- */
export function viewGovernment(g, app) {
  const c = g.countries[g.playerId];
  const gov = c.government || {};
  const parties = Array.isArray(gov.parties) ? gov.parties
                : Array.isArray(c.parties) ? c.parties : [];
  const parliamentTotal = gov.parliament?.total ?? 450;
  const coalition = Array.isArray(gov.coalition) ? gov.coalition : [];

  if (!parties.length) {
    return h('div', { style: { padding: 20, color: '#f85149' } },
      h('h3', {}, 'Данные правительства отсутствуют'),
      h('p', {}, 'В state.js функция createPlayerCountry должна создавать массив parties.'),
      h('pre', { style: { fontSize: 12, color: '#8b98a8' } },
        `gov.parties: ${typeof gov.parties}\nc.parties: ${typeof c.parties}`));
  }

  const majority = Math.floor(parliamentTotal / 2) + 1;
  const coalitionSeats = parties
    .filter(p => coalition.includes(p.id))
    .reduce((a, p) => a + (p.seats || 0), 0);

  const presidentPartyName = parties.find(p => p.id === gov.president?.partyId)?.name ?? '—';

  return h('div', {},
    grid('g3',
      statBox('Полит. капитал', num1(c.politicalCapital ?? 0), 'растёт с одобрением'),
      statBox('Мест в коалиции', `${coalitionSeats} / ${parliamentTotal}`,
        coalitionSeats >= majority ? 'большинство' : 'нет большинства'),
      statBox('Эффективность', pct((gov.efficiency ?? 0) * 100), 'зависит от министров')),

    card('Президент',
      h('div', { class: 'country-row' },
        h('div', { class: 'nm' },
          h('div', { style: { fontWeight: 600 } }, gov.president?.name ?? '—'),
          h('div', { style: { color: 'var(--muted)', fontSize: 12.5 } },
            `Партия: ${presidentPartyName} · с ${gov.president?.since?.year ?? '—'}`)),
        h('div', { class: 'btn-row' },
          btn('Провести президентские выборы', () => {
            holdElection(g, c, app.rng(), 'presidential');
            app.refresh();
          })))),

    card('Кабинет министров',
      grid('g2', ...Object.entries(ROLES).map(([role, label]) => {
        const m = gov.ministers?.[role];
        return h('div', { class: 'country-row' },
          h('div', { class: 'nm' },
            h('div', { style: { fontSize: 12.5, color: 'var(--muted)' } }, label),
            h('div', {}, m ? m.name : '— вакантно —'),
            m ? h('div', { style: { fontSize: 12, color: 'var(--muted)' } },
              `Компетентность ${pct((m.competence ?? 0) * 100)} · Лояльность ${pct((m.loyalty ?? 0) * 100)}`) : null),
          btn(m ? 'Заменить' : 'Назначить', () => app.pickMinister(role)));
      }))),

    card('Партии и парламент',
      table(
        [{ key: 'name', label: 'Партия' }, { key: 'ideology', label: 'Идеология' },
         { key: 'support', label: 'Поддержка' }, { key: 'seats', label: 'Места' },
         { key: 'status', label: 'Статус' }],
        parties
          .slice().sort((a, b) => (b.seats || 0) - (a.seats || 0))
          .map(p => ({
            name: p.name,
            ideology: p.ideology,
            support: pct(p.support ?? 0),
            seats: p.seats ?? 0,
            status: p.id === gov.rulingPartyId ? 'Правящая'
                  : coalition.includes(p.id) ? 'Коалиция' : 'Оппозиция',
          }))),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        btn('Провести парламентские выборы', () => {
          holdElection(g, c, app.rng(), 'parliamentary'); app.refresh();
        }),
        btn('Сформировать коалицию', () => app.openCoalition()),
        btn('Импичмент президента', () => app.impeach(), 'danger'))),

    card('Законы и реформы',
      h('div', { class: 'grid g2' }, ...Object.entries(LAWS).map(([id, law]) => {
        const passed = (c.laws || []).includes(id);
        const blocked = law.excludes?.some(x => (c.laws || []).includes(x));
        return h('div', { class: 'stat' },
          h('div', { style: { fontWeight: 600, marginBottom: 4 } }, law.name),
          h('div', { style: { fontSize: 12.5, color: 'var(--muted)', minHeight: 34 } }, law.desc),
          h('div', { class: 'btn-row', style: { marginTop: 8, alignItems: 'center' } },
            btn(passed ? '✓ Принят' : `Принять (${law.cost} ПК)`, () => app.passLaw(id),
                passed ? 'good' : blocked ? '' : 'primary'),
            blocked ? h('span', { class: 'pill' }, 'несовместим') : null));
      }))));
}

/* ----------------------------- Экономика ----------------------------- */
export function viewEconomy(g, app) {
  const c = g.countries[g.playerId];
  const e = c.economy;
  const b = budget(c, null);

  return h('div', {},
    grid('g4',
      statBox('ВВП', money(e.gdp), `рост ${pct(e.growth)}`),
      statBox('Доходы бюджета', money(b.revenue), `${pct(taxBurden(c) * 100)} ВВП`),
      statBox('Расходы бюджета', money(b.expenditure), `${pct(b.spendRate * 100)} ВВП`),
      statBox('Баланс', money(b.balance), e.balance >= 0 ? 'профицит' : 'дефицит')),

    card('Налоговая политика',
      slider('Подоходный налог', e.taxRates.income * 100, 0, 60, 1,
        v => pct(v), v => { e.taxRates.income = v / 100; }),
      slider('Налог на прибыль', e.taxRates.corporate * 100, 0, 45, 1,
        v => pct(v), v => { e.taxRates.corporate = v / 100; }),
      slider('НДС', e.taxRates.vat * 100, 0, 35, 1,
        v => pct(v), v => { e.taxRates.vat = v / 100; }),
      slider('Налог на имущество', e.taxRates.property * 100, 0, 20, 0.5,
        v => pct(v), v => { e.taxRates.property = v / 100; })),

    card('Государственные расходы (% ВВП)',
      ...Object.entries({
        social: 'Социальная сфера', health: 'Здравоохранение', education: 'Образование',
        defense: 'Оборона', infrastructure: 'Инфраструктура', admin: 'Администрация',
      }).map(([k, label]) =>
        slider(label, e.spending[k] * 100, 0, 25, 0.5, v => pct(v),
          v => { e.spending[k] = v / 100; }))),

    grid('g2',
      card('Центральный банк',
        statBox('Ключевая ставка', pct(e.interestRate),
          e.centralBank.independence > 0.5 ? 'ЦБ независим' : 'под контролем правительства'),
        h('div', { style: { marginTop: 12 } },
          slider('Независимость ЦБ', e.centralBank.independence * 100, 0, 100, 1,
            v => pct(v), v => { e.centralBank.independence = v / 100; })),
        e.centralBank.independence <= 0.5
          ? slider('Ставка ЦБ', e.interestRate, 0, 30, 0.25, v => pct(v), v => { e.interestRate = v; })
          : h('div', { style: { color: 'var(--muted)', fontSize: 12.5 } },
              'Ставку устанавливает независимый ЦБ (правило Тейлора).')),

      card('Торговля и валюта',
        statBox('Экспорт', money(e.exports), ''),
        h('div', { style: { marginTop: 8 } }, statBox('Импорт', money(e.imports), '')),
        h('div', { style: { marginTop: 8 } },
          statBox('Сальдо', money(e.tradeBalance), e.tradeBalance >= 0 ? 'положительное' : 'отрицательное')),
        h('div', { style: { marginTop: 8 } },
          statBox(`Валюта (${e.currency.name})`, num1(e.currency.value), 'индекс 100 = старт')))),

    card('Государственный сектор',
      grid('g3',
        statBox('Госпредприятия', num(e.stateEnterprises.count), ''),
        statBox('Эффективность', pct(e.stateEnterprises.efficiency * 100), ''),
        statBox('Доход', money(e.stateEnterprises.revenueAnnual), '')),
      h('div', { class: 'btn-row', style: { marginTop: 12 } },
        btn('Приватизировать 10%', () => app.privatize(10)),
        btn('Национализировать 10%', () => app.nationalize(10)))));
}

/* ------------------------------ Общество ------------------------------ */
export function viewSociety(g, app) {
  const c = g.countries[g.playerId];
  const d = c.demography, s = c.society, gov = c.government, e = c.economy;

  return h('div', {},
    grid('g6',
      statBox('Население', people(d.population), ''),
      statBox('Рождаемость', num1(d.birthRate), 'на 1000'),
      statBox('Смертность', num1(d.deathRate), 'на 1000'),
      statBox('Ожид. жизнь', num1(d.lifeExpectancy), 'лет'),
      statBox('Миграция', num2(d.netMigration / 1000) + ' тыс.', 'в месяц'),
      statBox('Благополучие', pct(s.wellbeing), '')),

    grid('g2',
      card('Структура населения',
        bar('Молодёжь (0–17)', d.ageStructure.youth, 100),
        bar('Трудоспособные', d.ageStructure.working, 100, 'good'),
        bar('Пожилые (65+)', d.ageStructure.elderly, 100, 'warn'),
        h('div', { style: { marginTop: 10, color: 'var(--muted)', fontSize: 12.5 } },
          `Преступность: ${pct(d.crimeRate)} · Неравенство (Джини): ${pct(e.inequality * 100)}`),
        h('div', { style: { color: 'var(--muted)', fontSize: 12.5 } },
          `Бедность: ${pct(e.poverty)} · Средняя зарплата: ${num(e.avgWage)} $/мес`)),

      card('Образование и здравоохранение',
        bar('Индекс образования', d.education.index, 100, 'good'),
        bar('Грамотность', d.education.literacy, 100, 'good'),
        bar('Индекс здравоохранения', d.health.index, 100, 'good'),
        bar('Доступность медицины', d.health.access, 100, 'warn'),
        h('div', { style: { marginTop: 10, color: 'var(--muted)', fontSize: 12.5 } },
          `Школ: ${num(d.education.schools)} · Вузов: ${num(d.education.universities)} · Больниц: ${num(d.health.hospitals)}`))),

    card('Свободы и институты',
      grid('g2',
        bar('Свобода прессы', gov.pressFreedom * 100, 100, gov.pressFreedom > 0.5 ? 'good' : 'bad'),
        bar('Независимость судов', gov.judiciary * 100, 100, gov.judiciary > 0.5 ? 'good' : 'warn'),
        bar('Гражданские права', gov.civilRights * 100, 100, gov.civilRights > 0.5 ? 'good' : 'warn'),
        bar('Коррупция', gov.corruption * 100, 100, 'bad')),
      h('div', { style: { marginTop: 12, color: 'var(--muted)', fontSize: 13 } },
        `Индекс демократии: ${num1(democracyIndex(c))} / 100 · HDI: ${num2(hdi(c))}`)));
}

/* ----------------------------- Дипломатия ----------------------------- */
export function viewDiplomacy(g, app) {
  const c = g.countries[g.playerId];
  const others = g.countries.filter(o => !o.isPlayer);

  return h('div', {},
    grid('g4',
      statBox('Репутация', pct(c.diplomacy.reputation), ''),
      statBox('Глобальное влияние', num1(computeInfluence(c)), ''),
      statBox('Соглашений', c.diplomacy.agreements.length, ''),
      statBox('Санкций против вас', c.diplomacy.sanctions.length, '')),

    card('Международные отношения',
      table(
        [{ key: 'name', label: 'Государство' }, { key: 'system', label: 'Строй' },
         { key: 'rel', label: 'Отношения' }, { key: 'status', label: 'Статус' },
         { key: 'actions', label: 'Действия' }],
        others.map(o => {
          const key = String(o.id);
          const rel = c.diplomacy.relations[key] ?? 50;
          const hasTrade = c.diplomacy.agreements.some(a => a.type === 'trade' && a.with === o.id);
          const hasAlliance = c.diplomacy.agreements.some(a => a.type === 'alliance' && a.with === o.id);
          return {
            name: o.name,
            system: o.government.system,
            rel: h('div', { style: { minWidth: 110 } },
              h('div', { style: { fontSize: 12, color: 'var(--muted)' } }, pct(rel)),
              h('div', { class: 'bar' },
                h('div', {
                  class: `bar-fill ${rel > 60 ? 'good' : rel > 35 ? 'warn' : 'bad'}`,
                  style: { width: `${rel}%` },
                }))),
            status: hasAlliance ? h('span', { class: 'pill gov' }, 'Союз')
                  : hasTrade ? h('span', { class: 'pill' }, 'Торговля') : '—',
            actions: h('div', { class: 'btn-row' },
              btn('Улучшить', () => app.diploAction('improve', o), ''),
              hasTrade ? null : btn('Торговля', () => app.diploAction('trade', o)),
              hasAlliance ? null : btn('Союз', () => app.diploAction('alliance', o)),
              btn('Санкции', () => app.diploAction('sanction', o), 'danger')),
          };
        }))),

    card('Саммиты и организации',
      h('div', { class: 'btn-row' },
        btn('Провести международный саммит (−20 ПК)', () => app.diploAction('summit')),
        btn('Открыть посольства', () => app.diploAction('embassy'), 'primary')),
      h('div', { style: { marginTop: 10, color: 'var(--muted)', fontSize: 13 } },
        `Участие в организациях: ${c.diplomacy.organizations.join(', ')}`)));
}

/* ------------------------------- Армия ------------------------------- */
export function viewMilitary(g, app) {
  const c = g.countries[g.playerId];
  const m = c.military;

  return h('div', {},
    grid('g4',
      statBox('Военнослужащие', num(m.personnel), ''),
      statBox('Военный бюджет', money(m.budget), `${pct(m.budget / c.economy.gdp * 100)} ВВП`),
      statBox('Оборонная промышленность', pct(m.industry), ''),
      statBox('Боеготовность', pct(m.readiness), '')),

    card('Управление вооружёнными силами',
      slider('Доля оборонного бюджета', c.economy.spending.defense * 100, 0, 15, 0.25,
        v => pct(v), v => { c.economy.spending.defense = v / 100; }),
      h('div', { class: 'btn-row', style: { marginTop: 12 } },
        btn('Провести военные учения', () => app.militaryAction('drill')),
        btn('Модернизация промышленности', () => app.militaryAction('industry'), 'primary'),
        btn('Заключить договор об ограничении вооружений', () => app.militaryAction('treaty')))),

    card('Мобилизационный потенциал',
      bar('Призывной резерв', clamp(c.demography.population / 1e5 * 0.02, 0, 100), 100, 'good'),
      bar('Оборонная инфраструктура', m.industry, 100),
      h('div', { style: { marginTop: 10, color: 'var(--muted)', fontSize: 13 } },
        `Договоры: ${m.treaties.length ? m.treaties.join(', ') : 'нет'}`)));
}

/* -------------------------------- Мир -------------------------------- */
export function viewWorld(g, app) {
  const keys = [
    { key: 'gdp', label: 'ВВП' },
    { key: 'gdpPerCapita', label: 'ВВП/душу' },
    { key: 'population', label: 'Население' },
    { key: 'hdi', label: 'HDI' },
    { key: 'military', label: 'Армия' },
    { key: 'influence', label: 'Влияние' },
  ];

  const renderValue = (key, value) => {
    if (key === 'population') return people(value);
    if (key === 'gdp') return money(value);
    if (key === 'gdpPerCapita') return `${num(value)} $`;
    return num1(value);
  };

  const rankingBlock = ({ key, label }) =>
    h('div', {},
      h('h3', { style: { marginBottom: 8 } }, label),
      h('div', {},
        rankings(g, key).slice(0, 12).map((r, i) =>
          h('div', { class: 'country-row' },
            h('span', { style: { width: 22, color: 'var(--muted)' } }, i + 1),
            h('span', {
              class: 'nm',
              style: r.isPlayer ? { color: 'var(--accent)', fontWeight: 600 } : {},
            }, r.name),
            h('span', { style: { color: 'var(--muted)' } },
              renderValue(key, r.value))
          )
        )
      )
    );

  return h('div', {},
    card('Международные рейтинги',
      h('div', { class: 'grid g2' }, keys.map(rankingBlock))
    )
  );
}

/* ----------------------------- Статистика ----------------------------- */
export function viewStatistics(g, app) {
  const c = g.countries[g.playerId];
  const H = g.history;

  const canvas1 = h('canvas', {});
  const canvas2 = h('canvas', {});
  const canvas3 = h('canvas', {});

  setTimeout(() => {
    drawChart(canvas1, [{ color: '#4f9cf9', values: H.map(p => p.gdp) }]);
    drawChart(canvas2, [{ color: '#3fb950', values: H.map(p => p.approval) }]);
    drawChart(canvas3, [
      { color: '#d29922', values: H.map(p => p.inflation) },
      { color: '#f85149', values: H.map(p => p.unemployment) },
    ]);
  }, 0);

  return h('div', {},
    grid('g4',
      statBox('HDI', num2(hdi(c)), ''),
      statBox('Индекс демократии', num1(democracyIndex(c)), ''),
      statBox('Экономическая свобода', pct(c.economy.economicFreedom * 100), ''),
      statBox('Глобальное влияние', num1(computeInfluence(c)), '')),

    grid('g2',
      card('ВВП (млрд $)', canvas1),
      card('Одобрение правительства (%)', canvas2)),
    card('Инфляция и безработица (%)', canvas3),
    card('Историческая таблица',
      table(
        [{ key: 'date', label: 'Дата' }, { key: 'gdp', label: 'ВВП' },
         { key: 'pop', label: 'Население' }, { key: 'approval', label: 'Одобрение' },
         { key: 'hdi', label: 'HDI' }],
        H.slice(-24).reverse().map(p => ({
          date: `${p.m}/${p.y}`,
          gdp: money(p.gdp),
          pop: people(p.population),
          approval: pct(p.approval),
          hdi: num2(p.hdi),
        })))));
}

export const VIEWS = {
  dashboard: viewDashboard,
  government: viewGovernment,
  economy: viewEconomy,
  society: viewSociety,
  diplomacy: viewDiplomacy,
  military: viewMilitary,
  world: viewWorld,
  statistics: viewStatistics,
};