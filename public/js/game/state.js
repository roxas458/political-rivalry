import { Rng } from '../core/rng.js';
import { clamp } from '../core/util.js';
import { person, partyName, countryName, cityName, EMBLEMS, rnd } from './names.js';

export const SIZES = {
  small:  { label: 'Малое государство',   pop: 8e6,   gdp: 140 },
  medium: { label: 'Средняя держава',     pop: 45e6,  gdp: 900 },
  large:  { label: 'Крупная держава',     pop: 145e6, gdp: 2400 },
};

export const SYSTEMS = {
  presidential:  { label: 'Президентская республика',  democracy: 0.62, stability: 55, corruption: 0.32, term: 60 },
  parliamentary: { label: 'Парламентская республика',  democracy: 0.70, stability: 52, corruption: 0.28, term: 48 },
  semi:          { label: 'Смешанная республика',      democracy: 0.60, stability: 54, corruption: 0.32, term: 60 },
  monarchy:      { label: 'Конституционная монархия',  democracy: 0.52, stability: 60, corruption: 0.34, term: 60 },
  authoritarian: { label: 'Авторитарный режим',        democracy: 0.18, stability: 62, corruption: 0.58, term: 84 },
};

export const IDEOLOGIES = {
  liberal:      { label: 'Либеральная',    econFreedom: 0.78, social: 0.70, base: 22 },
  socialdemocrat:{ label: 'Социал-демократическая', econFreedom: 0.52, social: 0.68, base: 20 },
  socialist:    { label: 'Социалистическая', econFreedom: 0.30, social: 0.45, base: 16 },
  centrist:     { label: 'Центристская',   econFreedom: 0.62, social: 0.55, base: 18 },
  technocratic: { label: 'Технократическая', econFreedom: 0.66, social: 0.50, base: 12 },
  conservative: { label: 'Консервативная', econFreedom: 0.70, social: 0.40, base: 18 },
  nationalist:  { label: 'Националистическая', econFreedom: 0.50, social: 0.25, base: 14 },
};

export const DIFFICULTY = {
  easy:   { label: 'Лёгкая',   approval: 62, startCash: 1.30, growth: 0.8 },
  normal: { label: 'Обычная',  approval: 52, startCash: 1.00, growth: 0.0 },
  hard:   { label: 'Сложная',  approval: 42, startCash: 0.80, growth: -0.7 },
};

const PARTY_IDEOLOGIES = ['liberal','socialdemocrat','socialist','centrist','technocratic','conservative','nationalist'];

export function createGame(cfg) {
  const rng = new Rng(cfg.seed ?? ((Math.random() * 1e9) | 0));
  const game = {
    version: 1, rngState: rng.s, date: { year: 2025, month: 1 },
    countries: [], playerId: 0, log: [], history: [], pendingEvent: null,
    worldAvgGdpPerCapita: 12000, turnCount: 0,
  };

  game.countries.push(createPlayerCountry(cfg, rng));
  for (let i = 0; i < 11; i++) game.countries.push(createAICountry(rng, i + 1));

  const player = game.countries[0];
  for (const o of game.countries) {
    if (o.isPlayer) continue;
    player.diplomacy.relations[String(o.id)] = clamp(rng.range(25, 80), 0, 100);
  }
  game.worldAvgGdpPerCapita =
    game.countries.reduce((a, c) => a + c.economy.gdpPerCapita, 0) / game.countries.length;

  game.log.unshift({ date: { ...game.date }, type: 'good', text: `Государство ${player.name} основано` });
  return game;
}

function createPlayerCountry(cfg, rng) {
  const size = SIZES[cfg.size] ?? SIZES.medium;
  const sys = SYSTEMS[cfg.system] ?? SYSTEMS.presidential;
  const ideo = IDEOLOGIES[cfg.ideology] ?? IDEOLOGIES.centrist;
  const diff = DIFFICULTY[cfg.difficulty] ?? DIFFICULTY.normal;

  const population = Math.round(size.pop * rng.range(0.9, 1.1));
  const gdp = size.gdp * rng.range(0.9, 1.1);
  const gdpPerCapita = (gdp * 1e9) / population;

  const parties = PARTY_IDEOLOGIES.map((id, i) => {
    const isRuling = id === cfg.ideology;
    return {
      id: `p${i}`, name: isRuling ? (cfg.partyName || partyName(rng)) : partyName(rng),
      ideology: id,
      support: isRuling ? rng.range(24, 34) : rng.range(5, 16),
      base: isRuling ? (IDEOLOGIES[id]?.base ?? 18) + 6 : (IDEOLOGIES[id]?.base ?? 16) * rng.range(0.5, 1.2),
      seats: 0, inGovernment: isRuling,
    };
  });
  const totalSupport = parties.reduce((a, p) => a + p.support, 0);
  parties.forEach(p => { p.support = (p.support / totalSupport) * 100; });
  const rulingParty = parties.find(p => p.ideology === cfg.ideology);

  const president = person(rng);
  const ministers = {};
  for (const role of ['finance','foreign','defense','interior','economy','health','education']) {
    ministers[role] = person(rng);
  }

  return {
    id: 0, isPlayer: true,
    name: cfg.name || countryName(rng),
    capital: cfg.capital || cityName(rng),
    flag: { colors: cfg.flagColors || ['#2b6cb0','#e2e8f0','#c53030'], emblem: cfg.emblem || '★' },
    development: clamp(gdpPerCapita / 45000, 0.05, 1.3),

    government: {
      system: cfg.system, ideology: cfg.ideology,
      president: { ...president, partyId: rulingParty.id, since: { year: 2025, month: 1 } },
      ministers,
      parties,
      parliament: { total: 450, seats: {} },
      rulingPartyId: rulingParty.id,
      coalition: [rulingParty.id],
      corruption: sys.corruption * rng.range(0.8, 1.2),
      judiciary: clamp(0.45 + rng.range(-0.1, 0.15) + (sys.democracy - 0.5) * 0.3, 0.05, 0.95),
      pressFreedom: clamp(sys.democracy * rng.range(0.85, 1.15), 0.05, 0.98),
      civilRights: clamp(sys.democracy * rng.range(0.85, 1.15), 0.05, 0.98),
      stability: sys.stability * rng.range(0.9, 1.1),
      efficiency: 0.5,
    },

    economy: {
      gdp, gdpPerCapita,
      growth: 2.0,
      revenue: 0, expenditure: 0, balance: 0,
      debt: gdp * rng.range(0.25, 0.7),
      debtRatio: 0,
      inflation: rng.range(2, 7),
      unemployment: rng.range(4, 11),
      poverty: clamp(45 - gdpPerCapita / 900, 2, 70),
      inequality: clamp(rng.range(0.28, 0.45), 0.15, 0.7),
      avgWage: gdpPerCapita * 0.055,
      realWage: gdpPerCapita * 0.055,
      pension: gdpPerCapita * 0.055 * 0.4,
      socialBenefit: gdpPerCapita * 0.055 * 0.22,
      taxRates: { income: 0.28, corporate: 0.20, vat: 0.20, property: 0.10 },
      spending: { social: 0.10, health: 0.05, education: 0.045, defense: 0.022, infrastructure: 0.035, admin: 0.020 },
      exports: 0, imports: 0, tradeBalance: 0,
      currency: { name: cfg.currencyName || 'Крона', code: cfg.currencyCode || 'KRN', value: 100 },
      interestRate: 5.0,
      centralBank: { independence: clamp(sys.democracy * rng.range(0.9, 1.15), 0.1, 0.95), reserves: gdp * 0.12 },
      economicFreedom: ideo.econFreedom,
      techLevel: clamp(3 + gdpPerCapita / 15000 + rng.range(-0.8, 1.2), 1, 10),
      fdi: gdp * 0.05,
      stateEnterprises: { count: 45, efficiency: 0.55, revenueAnnual: gdp * 0.02 },
    },

    demography: {
      population,
      birthRate: 15, deathRate: 9, migrationRate: 0.5,
      births: 0, deaths: 0, netMigration: 0,
      lifeExpectancy: clamp(62 + gdpPerCapita / 2500, 45, 88),
      religiosity: rng.range(0.35, 0.75),
      ageStructure: { youth: 24, working: 60, elderly: 16 },
      ethnicComposition: [{ name: 'Титульная нация', share: 0.74 }, { name: 'Нацменьшинства', share: 0.26 }],
      education: { index: clamp(35 + gdpPerCapita / 900, 10, 95), literacy: 92, schools: 0, universities: 0, teachers: 0 },
      health: { index: clamp(32 + gdpPerCapita / 950, 10, 95), hospitals: 0, doctors: 0, access: 60 },
      crimeRate: 30,
    },

    society: {
      approval: diff.approval,
      discontent: 100 - diff.approval,
      wellbeing: 50,
      protests: 0, protestTimer: 0, scandalTimer: 0,
    },

    military: {
      personnel: Math.round(population / 250),
      budget: gdp * 0.022,
      industry: clamp(20 + gdpPerCapita / 1200, 5, 90),
      readiness: 55,
      atWar: false,
      alliances: [],
      treaties: [],
    },

    diplomacy: {
      relations: {}, reputation: 50, influence: 0,
      agreements: [], sanctions: [], organizations: ['ООН'],
      allies: [],
    },

    laws: [],
    politicalCapital: 40,
    termMonths: sys.term,
    electionIn: sys.term,
    electionsFree: sys.democracy > 0.35,
    tradeAgreementsCount: 0,
  };
}

function createAICountry(rng, id) {
  const population = Math.round(rng.range(5e6, 180e6));
  const gdpPerCapitaBase = rng.range(2000, 55000);
  const gdp = (population * gdpPerCapitaBase) / 1e9;
  const ideology = rnd(rng, PARTY_IDEOLOGIES);
  const system = rnd(rng, Object.keys(SYSTEMS));
  const sys = SYSTEMS[system];

  return {
    id, isPlayer: false,
    name: countryName(rng),
    capital: cityName(rng),
    flag: { colors: [rnd(rng, ['#2b6cb0','#c53030','#2f855a','#6b46c1','#b7791f','#2c7a7b']), '#e2e8f0'], emblem: rnd(rng, EMBLEMS) },
    development: clamp(gdpPerCapitaBase / 45000, 0.05, 1.3),
    government: {
      system, ideology,
      corruption: clamp(sys.corruption * rng.range(0.7, 1.3), 0.03, 0.95),
      stability: clamp(sys.stability + rng.range(-12, 12), 5, 98),
      pressFreedom: clamp(sys.democracy * rng.range(0.7, 1.2), 0.03, 0.98),
      civilRights: clamp(sys.democracy * rng.range(0.7, 1.2), 0.03, 0.98),
      judiciary: clamp(sys.democracy * rng.range(0.7, 1.2), 0.03, 0.98),
    },
    economy: {
      gdp, gdpPerCapita: gdpPerCapitaBase,
      growth: 2, inflation: rng.range(1.5, 9),
      unemployment: rng.range(3, 15),
      debt: gdp * rng.range(0.2, 1.1),
      techLevel: clamp(2 + gdpPerCapitaBase / 12000 + rng.range(-1, 1.5), 1, 10),
      economicFreedom: clamp(rng.range(0.3, 0.85), 0.1, 0.95),
    },
    demography: {
      population,
      birthRate: rng.range(8, 30), deathRate: rng.range(6, 16),
      lifeExpectancy: clamp(55 + gdpPerCapitaBase / 2500, 45, 88),
      education: { index: clamp(30 + gdpPerCapitaBase / 900, 8, 98) },
      health: { index: clamp(28 + gdpPerCapitaBase / 950, 8, 98) },
    },
    military: {
      personnel: Math.round(population / rng.range(150, 600)),
      industry: clamp(15 + gdpPerCapitaBase / 1200, 3, 95),
      readiness: rng.range(30, 85), atWar: false,
    },
    diplomacy: { reputation: rng.range(30, 80), influence: 0, relations: {}, agreements: [], allies: [] },
    society: { approval: rng.range(35, 70), discontent: rng.range(20, 55) },
  };
}