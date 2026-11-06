import { indexItemsByResource, itemsExtent, itemsInRange, visibleRows } from './layout';
import { LanesItem } from './models';

const H = 3_600_000;

function item(id: string, resourceId: string, startH: number, endH: number): LanesItem {
  return { id, resourceId, start: startH * H, end: endH * H };
}

describe('indexItemsByResource', () => {
  it('agrupa por recurso y ordena por inicio', () => {
    const index = indexItemsByResource([item('b', 'r1', 5, 6), item('a', 'r1', 1, 2), item('c', 'r2', 0, 10)]);
    expect(index.get('r1')!.items.map((i) => i.source.id)).toEqual(['a', 'b']);
    expect(index.get('r2')!.maxDuration).toBe(10 * H);
  });

  it('acepta Date, número y cadena ISO', () => {
    const index = indexItemsByResource([{ id: 'x', resourceId: 'r', start: new Date(0), end: '1970-01-01T01:00:00Z' }]);
    expect(index.get('r')!.items[0].end).toBe(H);
  });

  it('lanza un error claro con fechas no válidas', () => {
    expect(() => indexItemsByResource([{ id: 'x', resourceId: 'r', start: 'no-es-fecha', end: 0 }])).toThrow(
      /invalid date/,
    );
  });
});

describe('itemsInRange', () => {
  const index = indexItemsByResource([
    item('largo', 'r', 0, 100),
    item('antes', 'r', 10, 20),
    item('dentro', 'r', 50, 55),
    item('borde', 'r', 59, 61),
    item('despues', 'r', 70, 80),
  ]).get('r');

  it('devuelve los items que se solapan con el rango, incluido uno largo que empezó antes', () => {
    const ids = itemsInRange(index, 50 * H, 60 * H).map((i) => i.source.id);
    expect(ids).toEqual(['largo', 'dentro', 'borde']);
  });

  it('excluye items que terminan justo al inicio del rango', () => {
    expect(itemsInRange(index, 20 * H, 21 * H).map((i) => i.source.id)).toEqual(['largo']);
  });

  it('devuelve vacío para un recurso sin items', () => {
    expect(itemsInRange(undefined, 0, 1)).toEqual([]);
  });

  it('escala: 10.000 items en un recurso se filtran sin recorrerlos todos', () => {
    const many = Array.from({ length: 10_000 }, (_, i) => item(`i${i}`, 'r', i, i + 1));
    const big = indexItemsByResource(many).get('r');
    expect(itemsInRange(big, 5000 * H, 5003 * H).map((i) => i.source.id)).toEqual(['i5000', 'i5001', 'i5002']);
  });
});

describe('visibleRows', () => {
  it('calcula la ventana con margen', () => {
    expect(visibleRows(400, 200, 40, 1000, 2)).toEqual({ first: 8, last: 17 });
  });

  it('no se sale de los límites', () => {
    expect(visibleRows(0, 200, 40, 3, 4)).toEqual({ first: 0, last: 3 });
    expect(visibleRows(0, 200, 40, 0)).toEqual({ first: 0, last: 0 });
  });
});

describe('itemsExtent', () => {
  it('devuelve el inicio mínimo y el fin máximo', () => {
    const index = indexItemsByResource([item('a', 'r1', 3, 4), item('b', 'r2', 1, 9)]);
    expect(itemsExtent(index)).toEqual({ start: H, end: 9 * H });
  });

  it('devuelve undefined sin items', () => {
    expect(itemsExtent(new Map())).toBeUndefined();
  });
});
