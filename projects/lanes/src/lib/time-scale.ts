import { LanesDateInput, LanesZoom } from './models';

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** Píxeles por día en cada nivel de zoom. */
export const DAY_WIDTH: Record<LanesZoom, number> = {
  day: 1152, // 48 px por hora
  week: 140,
  month: 32,
};

export interface Tick {
  time: number;
  x: number;
  label: string;
}

export interface TimeScale {
  start: number;
  end: number;
  pxPerMs: number;
  width: number;
  toX(time: number): number;
  toTime(x: number): number;
}

export function toMs(value: LanesDateInput): number {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`ngx-lanes: invalid date: ${String(value)}`);
  }
  return ms;
}

export function createTimeScale(start: number, end: number, zoom: LanesZoom): TimeScale {
  const pxPerMs = DAY_WIDTH[zoom] / DAY;
  const safeEnd = Math.max(end, start + HOUR);
  return {
    start,
    end: safeEnd,
    pxPerMs,
    width: Math.ceil((safeEnd - start) * pxPerMs),
    toX: (time) => (time - start) * pxPerMs,
    toTime: (x) => start + x / pxPerMs,
  };
}

/** Inicio del día local que contiene `time`. */
export function startOfDay(time: number): number {
  const d = new Date(time);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function startOfWeek(time: number): number {
  const d = new Date(startOfDay(time));
  const offset = (d.getDay() + 6) % 7; // lunes = 0
  d.setDate(d.getDate() - offset);
  return d.getTime();
}

function addDays(time: number, days: number): number {
  const d = new Date(time);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

function addMonths(time: number, months: number): number {
  const d = new Date(time);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

function addHours(time: number, hours: number): number {
  return time + hours * HOUR;
}

interface TickSpec {
  floor(t: number): number;
  next(t: number): number;
  format: Intl.DateTimeFormatOptions;
}

const MAJOR: Record<LanesZoom, TickSpec> = {
  day: { floor: startOfDay, next: (t) => addDays(t, 1), format: { weekday: 'short', day: 'numeric', month: 'short' } },
  week: { floor: startOfWeek, next: (t) => addDays(t, 7), format: { day: 'numeric', month: 'short', year: 'numeric' } },
  month: { floor: startOfMonth, next: (t) => addMonths(t, 1), format: { month: 'long', year: 'numeric' } },
};

const MINOR: Record<LanesZoom, TickSpec> = {
  day: { floor: (t) => startOfDay(t), next: (t) => addHours(t, 1), format: { hour: '2-digit' } },
  week: { floor: startOfDay, next: (t) => addDays(t, 1), format: { weekday: 'short', day: 'numeric' } },
  month: { floor: startOfWeek, next: (t) => addDays(t, 7), format: { day: 'numeric' } },
};

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

function buildTicks(scale: TimeScale, from: number, to: number, spec: TickSpec, locale: string): Tick[] {
  const fmt = new Intl.DateTimeFormat(locale, spec.format);
  const ticks: Tick[] = [];
  let t = spec.floor(Math.max(from, scale.start));
  // Límite de seguridad: nunca más de 2.000 marcas por llamada.
  for (let i = 0; t <= Math.min(to, scale.end) && i < 2000; i++) {
    ticks.push({ time: t, x: scale.toX(t), label: capitalize(fmt.format(t)) });
    t = spec.next(t);
  }
  return ticks;
}

/** Marcas principales y secundarias solo para el rango visible [from, to]. */
export function visibleTicks(
  scale: TimeScale,
  zoom: LanesZoom,
  from: number,
  to: number,
  locale: string,
): { major: Tick[]; minor: Tick[] } {
  return {
    major: buildTicks(scale, from, to, MAJOR[zoom], locale),
    minor: buildTicks(scale, from, to, MINOR[zoom], locale),
  };
}
