export interface Medicamento {
  id: number;
  nombre: string;
  principio_activo: string;
  presentacion: string;
  concentracion: string;
  requiere_formula: boolean;
  stock: number;
  /** Precio en pesos colombianos. */
  precio: number;
}

export type Disponibilidad = 'disponible' | 'pocas' | 'agotado';

/** Por debajo de este stock se avisa "Pocas unidades". */
export const STOCK_BAJO = 50;

/** Estado de disponibilidad derivado del stock; no se expone la cifra exacta al público. */
export function disponibilidad(stock: number): Disponibilidad {
  if (stock <= 0) return 'agotado';
  return stock <= STOCK_BAJO ? 'pocas' : 'disponible';
}
