import type { Id } from './common';

export interface Proveedor {
  id: Id;
  nombre: string;
  ruc: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}
