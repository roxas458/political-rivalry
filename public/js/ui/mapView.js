import { h } from './components.js';
import { num, num1, pct, people } from '../core/util.js';
import { regionAt } from '../game/map.js';

const RESOURCE_BONUS = {
  'нефть':      { growth: 0.5, label: 'нефть' },
  'газ':        { growth: 0.4, label: 'газ' },
  'уголь':      { growth: 0.3, label: 'уголь' },
  'железо':     { growth: 0.3, label: 'железо' },
  'золото':     { growth: 0.2, label: 'золото' },
  'лес':        { growth: 0.2, label: 'лес' },
  'рыба':       { growth: 0.15, label: 'рыба' },
  'зерно':      { growth: 0.25, label: 'зерно' },
  'виноград':   { growth: 0.15, label: 'виноград' },
  'уран':       { growth: 0.6, label: 'уран' },
  'редкозем':   { growth: 0.7, label: 'редкозем' },
  'вода':       { growth: 0.1, label: 'вода' },
};

export function createMapView(g, app) {
  const world = g.world;
  const canvas = h('canvas', { style: { display: 'block', width: '100%', borderRadius: '10px', background: '#0b1926', touchAction: 'none' } });
  const infoPanel = h('div', { id: 'map-info', style: { marginTop: '12px' } });
  const controls = h('div', { class: 'btn-row', style: { marginBottom: '10px', alignItems: 'center' } },
    h('button', { class: 'btn', onclick: () => { view.resetView(); } }, 'Сбросить вид'),
    h('button', { class: 'btn', onclick: () => { view.zoomBy(1.3); } }, '➕'),
    h('button', { class: 'btn', onclick: () => { view.zoomBy(0.77); } }, '➖'),
    h('span', { id: 'map-hint', style: { color: 'var(--muted)', fontSize: '12.5px' } },
      'Колёсико / щипок — зум, перетаскивание — панорама, клик — регион'),
  );

  const container = h('div', {}, controls, canvas, infoPanel);

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let selectedRegion = null;
  let hoverRegion = null;
  let panning = false;
  let lastPointer = null;

  const view = {
    resetView() { scale = 1; offsetX = 0; offsetY = 0; render(); },
    zoomBy(factor) {
      const cx = canvas.clientWidth / 2;
      const cy = canvas.clientHeight / 2;
      zoomAt(cx, cy, factor);
    },
    render,
  };

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight || (w * 0.56);
    canvas.style.height = h + 'px';
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function screenToWorld(px, py) {
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function render() {
    const ctx = canvas.getContext('2d');
    const W = canvas.clientWidth, H = canvas.clientHeight;
    ctx.clearRect(0, 0, W, H);
    if (!world) return;

    // Фон — «океан»
    ctx.fillStyle = '#0b1926';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Границы стран (толстые) и регионов (тонкие)
    const countryColors = g.countries.map(c => c.flag?.colors?.[0] || '#4f9cf9');

    // Сначала регионы — заливка
    for (const r of world.regions) {
      const country = g.countries[r.countryId];
      let fill = countryColors[r.countryId] || '#2a4a6a';
      if (r === selectedRegion) fill = '#4f9cf9';
      else if (r === hoverRegion) fill = shade(fill, 0.2);
      else fill = shade(fill, -0.3);

      ctx.fillStyle = fill + 'cc';
      ctx.beginPath();
      drawPolygon(ctx, r.points);
      ctx.fill();

      // Ресурсы — маленькая точка
      if (r.resource) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath();
        ctx.arc(r.center.x, r.center.y - 6, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Инфраструктура — внутренний круг
      if (r.infrastructure > 0.3) {
        ctx.strokeStyle = `rgba(255,255,255,${0.15 + r.infrastructure * 0.3})`;
        ctx.lineWidth = 1 / scale;
        ctx.beginPath();
        ctx.arc(r.center.x, r.center.y, 6 + r.infrastructure * 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Границы регионов
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8 / scale;
    for (const r of world.regions) {
      ctx.beginPath();
      drawPolygon(ctx, r.points);
      ctx.stroke();
    }

    // Границы стран — толще, цвет страны
    const drawnBorders = new Set();
    for (const r of world.regions) {
      const key = r.countryId;
      if (drawnBorders.has(key)) continue;
      drawnBorders.add(key);
      ctx.strokeStyle = countryColors[key] || '#4f9cf9';
      ctx.lineWidth = 2 / scale;
      // Рисуем только контурные рёбра: это дорого, поэтому упрощаем — обводим каждый регион
      for (const rr of world.regions) {
        if (rr.countryId !== key) continue;
        ctx.beginPath();
        drawPolygon(ctx, rr.points);
        ctx.stroke();
      }
    }

    // Столицы
    for (const r of world.regions) {
      if (!r.isCapital) continue;
      const country = g.countries[r.countryId];
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r.center.x, r.center.y, 5 / scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = countryColors[r.countryId] || '#000';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
      if (scale > 0.7) {
        ctx.fillStyle = '#fff';
        ctx.font = `${Math.max(10, 12 / scale)}px system-ui`;
        ctx.textAlign = 'center';
        ctx.fillText(country?.capital || '', r.center.x, r.center.y - 10 / scale);
      }
    }

    ctx.restore();
  }

  function drawPolygon(ctx, points) {
    if (!points || !points.length) return;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    let r = (n >> 16) & 0xff, gg = (n >> 8) & 0xff, b = n & 0xff;
    if (amt > 0) {
      r = Math.round(r + (255 - r) * amt);
      gg = Math.round(gg + (255 - gg) * amt);
      b = Math.round(b + (255 - b) * amt);
    } else {
      r = Math.round(r * (1 + amt));
      gg = Math.round(gg * (1 + amt));
      b = Math.round(b * (1 + amt));
    }
    return '#' + [r, gg, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function zoomAt(cx, cy, factor) {
    const newScale = Math.max(0.4, Math.min(4, scale * factor));
    const k = newScale / scale;
    offsetX = cx - (cx - offsetX) * k;
    offsetY = cy - (cy - offsetY) * k;
    scale = newScale;
    render();
  }

  // --- Взаимодействие ---
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    zoomAt(cx, cy, e.deltaY < 0 ? 1.15 : 0.87);
  }, { passive: false });

  canvas.addEventListener('pointerdown', (e) => {
    panning = true;
    lastPointer = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (panning && lastPointer) {
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) lastPointer.moved = true;
      offsetX += dx;
      offsetY += dy;
      lastPointer.x = e.clientX;
      lastPointer.y = e.clientY;
      render();
      return;
    }

    const p = screenToWorld(mx, my);
    const r = regionAt(world, p.x, p.y);
    if (r !== hoverRegion) {
      hoverRegion = r;
      canvas.style.cursor = r ? 'pointer' : 'grab';
      render();
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (panning && lastPointer && !lastPointer.moved) {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const p = screenToWorld(mx, my);
      const r = regionAt(world, p.x, p.y);
      selectedRegion = r;
      render();
      renderInfoPanel();
    }
    panning = false;
    lastPointer = null;
  });

  canvas.addEventListener('pointerleave', () => {
    hoverRegion = null;
    panning = false;
    render();
  });

  function renderInfoPanel() {
    infoPanel.innerHTML = '';
    if (!selectedRegion) {
      infoPanel.append(h('div', { style: { color: 'var(--muted)', fontSize: 13 } },
        'Выберите регион на карте, чтобы управлять им.'));
      return;
    }
    const r = selectedRegion;
    const country = g.countries[r.countryId];
    const isPlayer = country?.isPlayer;
    const resLabel = r.resource
      ? `${RESOURCE_BONUS[r.resource]?.label || r.resource} (${num1(r.richness * 100)}% богатство)`
      : 'нет';

    const panel = h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        h('h3', {}, r.name),
        h('span', { class: 'pill' }, country?.name || '—')),
      h('div', { class: 'card-body' },
        h('div', { class: 'grid g2' },
          h('div', { class: 'stat' },
            h('div', { class: 'stat-label' }, 'Население'),
            h('div', { class: 'stat-value' }, people(r.population))),
          h('div', { class: 'stat' },
            h('div', { class: 'stat-label' }, 'Инфраструктура'),
            h('div', { class: 'stat-value' }, pct(r.infrastructure * 100))),
          h('div', { class: 'stat' },
            h('div', { class: 'stat-label' }, 'Ресурс'),
            h('div', { class: 'stat-value', style: { fontSize: 14 } }, resLabel)),
          h('div', { class: 'stat' },
            h('div', { class: 'stat-label' }, 'Автономия'),
            h('div', { class: 'stat-value' }, pct(r.autonomy * 100))),
        ),
        isPlayer ? h('div', { class: 'btn-row', style: { marginTop: 14 } },
          h('button', {
            class: 'btn primary',
            disabled: r.infrastructure >= 1,
            onclick: () => {
              const c = g.countries[g.playerId];
              if (c.politicalCapital < 8) return app.toast('Нужно 8 ПК', 'bad');
              c.politicalCapital -= 8;
              r.infrastructure = Math.min(1, r.infrastructure + 0.08);
              c.economy.gdp *= 1.0015;
              c.economy.debt += c.economy.gdp * 0.004;
              app.toast(`Инфраструктура «${r.name}» улучшена`, 'good');
              render(); renderInfoPanel();
            },
          }, `Развивать (8 ПК)`),
          h('button', {
            class: 'btn',
            disabled: r.autonomy >= 1,
            onclick: () => {
              const c = g.countries[g.playerId];
              if (c.politicalCapital < 5) return app.toast('Нужно 5 ПК', 'bad');
              c.politicalCapital -= 5;
              r.autonomy = Math.min(1, r.autonomy + 0.1);
              c.government.stability = Math.min(100, c.government.stability + 1);
              c.society.approval = Math.min(100, c.society.approval + 1);
              app.toast(`«${r.name}» получил автономию`, 'good');
              render(); renderInfoPanel();
            },
          }, 'Автономия (5 ПК)'),
        ) : h('div', { style: { color: 'var(--muted)', fontSize: 13, marginTop: 10 } },
          'Это регион другого государства — управлять им нельзя.'),
      ),
    );
    infoPanel.append(panel);
  }

  // первичный рендер и адаптация к размеру
  requestAnimationFrame(() => { resize(); });
  window.addEventListener('resize', resize);

  // двойной клик — сброс
  canvas.addEventListener('dblclick', () => view.resetView());

  renderInfoPanel();
  return container;
}