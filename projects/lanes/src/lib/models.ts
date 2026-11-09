/** Fecha aceptada en la API pública: Date, timestamp en ms o cadena ISO. */
export type LanesDateInput = Date | number | string;

/** Una fila del timeline: persona, vehículo, sala, máquina, antena… */
export interface LanesResource {
  id: string;
  label: string;
  /** Texto secundario bajo el nombre (opcional). */
  description?: string;
}

/** Una asignación de un recurso en el tiempo. */
export interface LanesItem<TData = unknown> {
  id: string;
  resourceId: string;
  start: LanesDateInput;
  end: LanesDateInput;
  label?: string;
  /** Color CSS de la barra; si no se da, se usa --lanes-bar-bg. */
  color?: string;
  /** Clases CSS extra para la barra (p. ej. para marcar conflictos o estados). */
  className?: string;
  data?: TData;
}

export type LanesZoom = 'day' | 'week' | 'month';

/** Item con fechas normalizadas a ms, usado internamente. */
export interface NormalizedItem<TData = unknown> {
  source: LanesItem<TData>;
  start: number;
  end: number;
}

export interface LanesItemEvent<TData = unknown> {
  item: LanesItem<TData>;
  resource: LanesResource | undefined;
  event: MouseEvent | KeyboardEvent;
}
