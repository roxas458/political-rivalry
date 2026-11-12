import { applyEffects } from './effects.js';
import { clamp } from '../core/util.js';

export const EVENTS = [
  {
    id: 'crisis', title: 'Экономический кризис',
    text: 'Мировые рынки обвалились. Инвесторы выводят капитал, банки ужесточают кредитование.',
    weight: 8,
    options: [
      { label: 'Жёсткая экономия (−расходы, +стабильность)', effects: { approval: -8, gdpPct: -2.5, budget: 0, stability: 4, inflation: -1.5 } },
      { label: 'Стимулирование экономики (+долг, +одобрение)', effects: { approval: 4, gdpPct: -1, budget: -40, inflation: 2.5 } },
      { label: 'Спасать банки за счёт бюджета', effects: { approval: -3, budget: -60, gdpPct: -0.5, corruption: 0.02 } },
    ],
  },
  {
    id: 'corruption', title: 'Коррупционный скандал',
    text: 'Журналисты раскрыли схему хищений в правительстве. Оппозиция требует отставок.',
    weight: 9,
    options: [
      { label: 'Уволить виновных и начать расследование', effects: { approval: 2, corruption: -0.04, stability: -3, pc: -10 } },
      { label: 'Замять дело', effects: { approval: -9, corruption: 0.04, pressFreedom: -0.05 } },
    ],
  },
  {
    id: 'protests', title: 'Массовые протесты',
    text: 'На улицы вышли сотни тысяч граждан. Требования — рост зарплат и отставка правительства.',
    weight: 8, cond: c => c.society.discontent > 50,
    options: [
      { label: 'Пойти на диалог и уступки', effects: { approval: 6, budget: -25, stability: 5 } },
      { label: 'Разогнать силой', effects: { approval: -10, stability: -8, pressFreedom: -0.06, relations: -4 } },
      { label: 'Игнорировать', effects: { approval: -5, stability: -4 } },
    ],
  },
  {
    id: 'disaster', title: 'Природная катастрофа',
    text: 'Землетрясение разрушило инфраструктуру в нескольких регионах.',
    weight: 7,
    options: [
      { label: 'Масштабная помощь пострадавшим', effects: { approval: 6, budget: -35, stability: 2 } },
      { label: 'Минимальные меры', effects: { approval: -6, budget: -8 } },
    ],
  },
  {
    id: 'epidemic', title: 'Эпидемия',
    text: 'Новый вирус распространяется быстро. Система здравоохранения на пределе.',
    weight: 6,
    options: [
      { label: 'Жёсткий карантин', effects: { approval: -3, gdpPct: -2, populationPct: -0.05, health: 0.02 } },
      { label: 'Мягкие ограничения', effects: { approval: 1, gdpPct: -0.8, populationPct: -0.15 } },
    ],
  },
  {
    id: 'tech', title: 'Технологический прорыв',
    text: 'Национальная лаборатория совершила прорыв в области полупроводников.',
    weight: 6,
    options: [
      { label: 'Государственные инвестиции в масштабирование', effects: { tech: 0.4, gdpPct: 1.5, budget: -20, approval: 3 } },
      { label: 'Продать патенты за рубеж', effects: { budget: 45, tech: 0.1 } },
    ],
  },
  {
    id: 'energy', title: 'Энергетический кризис',
    text: 'Цены на энергоносители взлетели. Промышленность несёт убытки.',
    weight: 7,
    options: [
      { label: 'Субсидировать тарифы', effects: { budget: -40, approval: 5, inflation: -1 } },
      { label: 'Отпустить цены', effects: { approval: -8, inflation: 3, gdpPct: -1 } },
    ],
  },
  {
    id: 'diplo', title: 'Дипломатический конфликт',
    text: 'Соседнее государство обвинило вас во вмешательстве во внутренние дела.',
    weight: 7,
    options: [
      { label: 'Принести извинения', effects: { relations: 6, reputation: 2, approval: -3 } },
      { label: 'Ответить жёстко', effects: { relations: -10, reputation: -2, approval: 4, stability: -2 } },
    ],
  },
  {
    id: 'boom', title: 'Неожиданный экономический рост',
    text: 'Экспортные отрасли показали рекордные результаты.',
    weight: 6,
    options: [
      { label: 'Направить доходы в бюджет', effects: { budget: 55, approval: 2 } },
      { label: 'Инвестировать в инфраструктуру', effects: { gdpPct: 1.2, approval: 4, growthBonusTemp: 0 } },
    ],
  },
  {
    id: 'strike', title: 'Всеобщая забастовка',
    text: 'Профсоюзы остановили работу ключевых отраслей.',
    weight: 6, cond: c => c.economy.unemployment > 8 || c.society.discontent > 55,
    options: [
      { label: 'Повысить зарплаты', effects: { approval: 5, inflation: 1.5, budget: -20 } },
      { label: 'Запретить забастовку', effects: { approval: -7, stability: -6, civilRights: -0.05 } },
    ],
  },
  {
    id: 'summit', title: 'Международный саммит',
    text: 'Вас приглашают на саммит ведущих держав.',
    weight: 5,
    options: [
      { label: 'Участвовать', effects: { reputation: 5, relations: 4, budget: -8, approval: 1 } },
      { label: 'Отклонить приглашение', effects: { reputation: -4, relations: -3 } },
    ],
  },
  {
    id: 'minister_scandal', title: 'Скандал в правительстве',
    text: 'Министр обвиняется в злоупотреблении полномочиями.',
    weight: 6,
    options: [
      { label: 'Отправить в отставку', effects: { approval: 2, stability: -2, corruption: -0.02 } },
      { label: 'Защитить министра', effects: { approval: -6, corruption: 0.03, stability: -3 } },
    ],
  },
  {
    id: 'investment', title: 'Инвестиционное предложение',
    text: 'Крупный международный консорциум готов вложить средства в промышленность.',
    weight: 6,
    options: [
      { label: 'Принять с льготами', effects: { gdpPct: 1.0, budget: -15, corruption: 0.01, approval: 2 } },
      { label: 'Отказаться — работаем сами', effects: { approval: 1, reputation: 1 } },
    ],
  },
  {
    id: 'cyber', title: 'Кибератака',
    text: 'Хакеры атаковали государственные информационные системы.',
    weight: 5,
    options: [
      { label: 'Инвестировать в кибербезопасность', effects: { budget: -20, tech: 0.15, stability: 1 } },
      { label: 'Сэкономить', effects: { corruption: 0.01, stability: -3, approval: -2 } },
    ],
  },
];

export function maybeEvent(game, rng) {
  if (game.pendingEvent) return;
  if (!rng.chance(0.28)) return;
  const c = game.countries[game.playerId];
  const pool = EVENTS.filter(e => !e.cond || e.cond(c));
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let r = rng.next() * total;
  let chosen = pool[0];
  for (const e of pool) { r -= e.weight; if (r <= 0) { chosen = e; break; } }
  game.pendingEvent = { ...chosen, instance: rng.int(1, 99999) };
}

export function resolveEvent(game, optionIndex) {
  const ev = game.pendingEvent;
  if (!ev) return;
  const c = game.countries[game.playerId];
  const opt = ev.options[optionIndex];
  if (opt) {
    applyEffects(game, c, opt.effects);
    game.log.unshift({ date: { ...game.date }, type: 'warn',
      text: `${ev.title}: ${opt.label}` });
  }
  game.pendingEvent = null;
}