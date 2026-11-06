import { DAY, DAY_WIDTH, createTimeScale, startOfDay, visibleTicks } from './time-scale';

describe('createTimeScale', () => {
  it('convierte tiempo a x y vuelta', () => {
    const start = new Date(2026, 0, 1).getTime();
    const scale = createTimeScale(start, start + 10 * DAY, 'week');
    expect(scale.toX(start + DAY)).toBeCloseTo(DAY_WIDTH.week);
    expect(scale.toTime(scale.toX(start + 3 * DAY))).toBeCloseTo(start + 3 * DAY);
    expect(scale.width).toBe(10 * DAY_WIDTH.week);
  });

  it('nunca tiene ancho cero', () => {
    const scale = createTimeScale(0, 0, 'month');
    expect(scale.width).toBeGreaterThan(0);
  });
});

describe('visibleTicks', () => {
  const start = new Date(2026, 0, 1).getTime(); // jueves
  const scale = createTimeScale(start, start + 60 * DAY, 'week');

  it('genera marcas solo para el rango pedido', () => {
    const { major, minor } = visibleTicks(scale, 'week', start, start + 14 * DAY, 'es-ES');
    expect(minor.length).toBe(15); // un día por marca, ambos extremos incluidos
    expect(major.length).toBeGreaterThanOrEqual(2);
    expect(minor.every((t) => t.time >= start)).toBe(true);
  });

  it('las semanas empiezan en lunes', () => {
    const { major } = visibleTicks(scale, 'week', start, start + 30 * DAY, 'es-ES');
    const weekStarts = major.filter((t) => t.time >= start);
    expect(weekStarts.every((t) => new Date(t.time).getDay() === 1)).toBe(true);
  });

  it('el zoom de día marca horas', () => {
    const dayScale = createTimeScale(start, start + 2 * DAY, 'day');
    const { minor } = visibleTicks(dayScale, 'day', start, start + DAY - 1, 'es-ES');
    expect(minor.length).toBe(24);
  });

  it('startOfDay devuelve medianoche local', () => {
    const d = new Date(startOfDay(new Date(2026, 4, 10, 15, 30).getTime()));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });
});
