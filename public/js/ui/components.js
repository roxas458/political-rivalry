import { h } from '../core/dom.js';
import { num, num1, money, people, pct } from '../core/util.js';

export { h };

export const card = (title, ...body) =>
  h('section', { class: 'card' },
    title ? h('div', { class: 'card-head' }, h('h3', {}, title)) : null,
    h('div', { class: 'card-body' }, ...body));

export const grid = (cls, ...kids) => h('div', { class: `grid ${cls}` }, ...kids);

export const statBox = (label, value, sub) =>
  h('div', { class: 'stat' },
    h('div', { class: 'stat-label' }, label),
    h('div', { class: 'stat-value' }, value),
    sub ? h('div', { class: 'stat-sub' }, sub) : null);

export function bar(label, value, max = 100, cls = '') {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  return h('div', { class: 'bar-row' },
    h('div', { class: 'bar-head' }, h('span', {}, label), h('span', {}, num1(value))),
    h('div', { class: 'bar' }, h('div', { class: `bar-fill ${cls}`, style: { width: `${p}%` } })));
}

export const btn = (label, onClick, cls = '') =>
  h('button', { class: `btn ${cls}`, onclick: onClick }, label);

export function table(cols, rows) {
  return h('table', {},
    h('thead', {}, h('tr', {}, cols.map(c => h('th', {}, c.label)))),
    h('tbody', {}, rows.map(r =>
      h('tr', {}, cols.map(c => h('td', {}, r[c.key] ?? '—'))))));
}

export function slider(label, value, min, max, step, fmt, onChange) {
  const val = h('span', { class: 'slider-val' }, fmt(value));
  const input = h('input', {
    type: 'range', min, max, step, value,
    oninput: (ev) => { const v = +ev.target.value; val.textContent = fmt(v); onChange(v); },
  });
  return h('div', { class: 'slider-row' },
    h('div', { class: 'slider-head' }, h('span', {}, label), val), input);
}

export function drawChart(canvas, series, { height = 150 } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320;
  canvas.width = w * dpr;
  canvas.height = height * dpr;
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, height);

  const all = series.flatMap(s => s.values).filter(Number.isFinite);
  if (!all.length) return;
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.12;
  min -= pad; max += pad;

  const n = Math.max(...series.map(s => s.values.length));
  const x = i => 8 + (i / Math.max(1, n - 1)) * (w - 16);
  const y = v => height - 10 - ((v - min) / (max - min)) * (height - 20);

  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const yy = 10 + i * (height - 20) / 4;
    ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(w - 8, yy); ctx.stroke();
  }
  for (const s of series) {
    ctx.strokeStyle = s.color || '#4f9cf9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const px = x(i), py = y(v);
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    });
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(230,237,243,.45)';
  ctx.font = '10px system-ui';
  ctx.fillText(num1(max), 10, 13);
  ctx.fillText(num1(min), 10, height - 2);
}