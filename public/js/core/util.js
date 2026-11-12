export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export const num = (n) => nf0.format(Math.round(n));
export const num1 = (n) => nf1.format(n);
export const num2 = (n) => nf2.format(n);
export const pct = (v, d = 1) => (d === 2 ? nf2 : nf1).format(round(v, d)) + '%';

export function money(b) {
  const a = Math.abs(b);
  if (a >= 1000) return `${num1(b / 1000)} трлн $`;
  if (a >= 1) return `${num1(b)} млрд $`;
  return `${num1(b * 1000)} млн $`;
}

export function people(n) {
  if (n >= 1e9) return `${num2(n / 1e9)} млрд`;
  if (n >= 1e6) return `${num1(n / 1e6)} млн`;
  return num(n);
}

export const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

export const dateStr = (d) => `${MONTHS[d.month - 1]} ${d.year}`;