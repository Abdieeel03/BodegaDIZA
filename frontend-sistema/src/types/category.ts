import type { Id } from './common';

export interface Categoria {
  id: Id;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}
