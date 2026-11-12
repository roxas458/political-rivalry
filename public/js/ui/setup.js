import { h, card, btn, grid } from './components.js';
import { SIZES, SYSTEMS, IDEOLOGIES, DIFFICULTY } from '../game/state.js';
import { EMBLEMS, countryName, cityName, partyName } from '../game/names.js';
import { Rng } from '../core/rng.js';

export function renderSetup(onStart) {
  const rng = new Rng(Date.now());
  const state = {
    name: countryName(rng),
    capital: cityName(rng),
    partyName: partyName(rng),
    size: 'medium',
    system: 'presidential',
    ideology: 'centrist',
    difficulty: 'normal',
    flagColors: ['#2b6cb0', '#e2e8f0', '#c53030'],
    emblem: '★',
  };

  const root = h('div', { class: 'setup' });

  const flagPreview = () => h('div', { class: 'flag-preview', style: {
    background: `linear-gradient(135deg, ${state.flagColors[0]} 0 50%, ${state.flagColors[1]} 50% 75%, ${state.flagColors[2]} 75% 100%)`,
  } }, state.emblem);

  function rebuild() {
    root.innerHTML = '';
    const preview = flagPreview();

    const form = card('Создание государства',
      h('div', { class: 'grid g2' },
        h('div', { class: 'field' }, h('label', {}, 'Название государства'),
          h('input', { value: state.name, oninput: e => state.name = e.target.value })),
        h('div', { class: 'field' }, h('label', {}, 'Столица'),
          h('input', { value: state.capital, oninput: e => state.capital = e.target.value })),
        h('div', { class: 'field' }, h('label', {}, 'Правящая партия'),
          h('input', { value: state.partyName, oninput: e => state.partyName = e.target.value })),
        h('div', { class: 'field' }, h('label', {}, 'Размер государства'),
          h('select', { onchange: e => state.size = e.target.value },
            Object.entries(SIZES).map(([k, v]) =>
              h('option', { value: k, selected: state.size === k }, v.label)))),
        h('div', { class: 'field' }, h('label', {}, 'Форма правления'),
          h('select', { onchange: e => state.system = e.target.value },
            Object.entries(SYSTEMS).map(([k, v]) =>
              h('option', { value: k, selected: state.system === k }, v.label)))),
        h('div', { class: 'field' }, h('label', {}, 'Идеология'),
          h('select', { onchange: e => state.ideology = e.target.value },
            Object.entries(IDEOLOGIES).map(([k, v]) =>
              h('option', { value: k, selected: state.ideology === k }, v.label)))),
        h('div', { class: 'field' }, h('label', {}, 'Сложность'),
          h('select', { onchange: e => state.difficulty = e.target.value },
            Object.entries(DIFFICULTY).map(([k, v]) =>
              h('option', { value: k, selected: state.difficulty === k }, v.label)))),
      ),
      h('div', { class: 'field' }, h('label', {}, 'Флаг'),
        h('div', { class: 'btn-row', style: { alignItems: 'center' } },
          preview,
          ...[0, 1, 2].map(i => h('input', {
            type: 'color', value: state.flagColors[i],
            oninput: e => { state.flagColors[i] = e.target.value; rebuild(); },
          })),
          h('select', { onchange: e => { state.emblem = e.target.value; rebuild(); } },
            EMBLEMS.map(x => h('option', { value: x, selected: state.emblem === x }, x))))),
      h('div', { class: 'btn-row', style: { marginTop: '18px' } },
        btn('Начать правление', () => onStart({ ...state }), 'primary')));

    root.append(form);
  }

  rebuild();
  return root;
}