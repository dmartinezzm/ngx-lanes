import { LanesItem, LanesResource } from 'ngx-lanes';

const DAY = 86_400_000;
const HOUR = 3_600_000;
const KINDS = ['Maintenance', 'Route', 'Booking', 'Shift', 'Inspection'];
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777'];

/** Generador pseudoaleatorio con semilla, para que la demo sea siempre igual. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemo(resourceCount: number, itemsPerResource: number) {
  const random = mulberry32(42);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const origin = today.getTime() - 14 * DAY;

  const resources: LanesResource[] = Array.from({ length: resourceCount }, (_, i) => ({
    id: `r${i}`,
    label: `Unit ${String(i + 1).padStart(4, '0')}`,
    description: ['North fleet', 'South fleet', 'Workshop', 'Warehouse'][i % 4],
  }));

  const items: LanesItem[] = [];
  for (const resource of resources) {
    let cursor = origin + Math.floor(random() * 48) * HOUR;
    for (let j = 0; j < itemsPerResource; j++) {
      const duration = (4 + Math.floor(random() * 60)) * HOUR;
      const kind = Math.floor(random() * KINDS.length);
      items.push({
        id: `${resource.id}-${j}`,
        resourceId: resource.id,
        start: cursor,
        end: cursor + duration,
        label: `${KINDS[kind]} ${j + 1}`,
        color: COLORS[kind],
      });
      cursor += duration + (2 + Math.floor(random() * 30)) * HOUR;
    }
  }
  return { resources, items };
}
