import { clamp } from '../core/util.js';

/* ---------- Вороной (Fortune's algorithm упрощён: brute-force) ---------- */
function voronoiCells(points, bbox, gridStep = 8) {
  const [minX, minY, maxX, maxY] = bbox;
  const cells = points.map(() => []);
  for (let y = minY; y <= maxY; y += gridStep) {
    for (let x = minX; x <= maxX; x += gridStep) {
      let best = 0, bestD = Infinity;
      for (let i = 0; i < points.length; i++) {
        const dx = points[i].x - x, dy = points[i].y - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = i; }
      }
      cells[best].push({ x, y });
    }
  }
  return cells;
}

/* ---------- Генерация мира ---------- */
export function generateWorld(rng, { width = 1600, height = 900, countryCount = 12 } = {}) {
  const bbox = [40, 40, width - 40, height - 40];

  // 1) Континентальные центры — раскидываем по карте
  const countryCenters = [];
  const minDist = Math.min(width, height) / (countryCount * 0.65);
  let attempts = 0;
  while (countryCenters.length < countryCount && attempts < countryCount * 80) {
    attempts++;
    const x = rng.range(bbox[0] + 60, bbox[2] - 60);
    const y = rng.range(bbox[1] + 60, bbox[3] - 60);
    if (countryCenters.every(c => Math.hypot(c.x - x, c.y - y) > minDist)) {
      countryCenters.push({ x, y });
    }
  }

  // 2) Региональные центры — по 3–6 на страну, вокруг её центра
  const regionPoints = [];
  const countryRegions = countryCenters.map(() => []);
  countryCenters.forEach((cc, ci) => {
    const n = rng.int(3, 6);
    const spread = rng.range(minDist * 0.6, minDist * 1.3);
    const used = [];
    for (let i = 0; i < n; i++) {
      let px, py, tries = 0;
      do {
        const a = rng.range(0, Math.PI * 2);
        const r = rng.range(spread * 0.25, spread);
        px = clamp(cc.x + Math.cos(a) * r, bbox[0] + 20, bbox[2] - 20);
        py = clamp(cc.y + Math.sin(a) * r, bbox[1] + 20, bbox[3] - 20);
        tries++;
      } while (tries < 20 && used.some(p => Math.hypot(p.x - px, p.y - py) < spread * 0.3));
      used.push({ x: px, y: py });
      regionPoints.push({ x: px, y: py, countryIndex: ci });
      countryRegions[ci].push(regionPoints.length - 1);
    }
  });

  // 3) Ячейки Вороного по всем региональным точкам
  const cells = voronoiCells(regionPoints, bbox, 8);

  const REGION_NAMES = ['Северный','Южный','Восточный','Западный','Центральный','Приморский',
    'Горный','Лесной','Степной','Речной','Озёрный','Пограничный'];
  const RESOURCES = ['нефть','газ','уголь','железо','золото','лес','рыба','зерно',
    'виноград','уран','редкозем','вода'];

  const regions = regionPoints.map((p, i) => {
    const poly = cells[i];
    const resource = rng.chance(0.65) ? rng.pick(RESOURCES) : null;
    const richness = rng.range(0.3, 1.4);
    return {
      id: i,
      name: `${rng.pick(REGION_NAMES)} ${['регион','край','округ','провинция'][rng.int(0,3)]}`,
      countryId: p.countryIndex,
      points: poly,
      center: { x: p.x, y: p.y },
      population: 0,               // заполняется ниже пропорционально
      resource,
      richness,
      infrastructure: rng.range(0.2, 0.8),
      autonomy: 0,
      isCapital: false,
    };
  });

  // 4) Столица — регион, ближайший к центру страны
  countryCenters.forEach((cc, ci) => {
    const own = regions.filter(r => r.countryId === ci);
    if (!own.length) return;
    let best = own[0], bestD = Infinity;
    for (const r of own) {
      const d = Math.hypot(r.center.x - cc.x, r.center.y - cc.y);
      if (d < bestD) { bestD = d; best = r; }
    }
    best.isCapital = true;
    best.infrastructure = Math.max(best.infrastructure, 0.6);
  });

  return {
    width, height,
    bbox,
    countryCenters,
    regions,
    countryRegions,
  };
}

/* ---------- Распределение населения после создания стран ---------- */
export function distributePopulation(world, countries) {
  // Считаем "вес" региона: инфраструктура + ресурсы + столица
  const weights = world.regions.map(r => {
    let w = 0.4 + r.infrastructure * 1.2 + r.richness * 0.3;
    if (r.isCapital) w *= 1.8;
    return w;
  });
  const totals = {};
  world.regions.forEach((r, i) => {
    totals[r.countryId] = (totals[r.countryId] || 0) + weights[i];
  });
  world.regions.forEach((r, i) => {
    const country = countries[r.countryId];
    if (!country) return;
    r.population = Math.round(country.demography.population * weights[i] / totals[r.countryId]);
  });
}

/* ---------- Поиск региона по точке ---------- */
export function regionAt(world, x, y) {
  for (const r of world.regions) {
    if (pointInPolygon(x, y, r.points)) return r;
  }
  return null;
}

function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}