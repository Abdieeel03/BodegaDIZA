import { DataFeedback } from '../../components/common/DataFeedback';

export type InventoryDataStatus = 'loading' | 'error' | 'empty';

type Props = {
  status: InventoryDataStatus;
  onRetry?: () => void;
  errorMessage?: string | null;
};

/** Adaptador del componente reutilizable para los textos de Inventario. */
export function InventoryDataState({ status, onRetry, errorMessage }: Props) {
  const texts = {
    loading: {
      title: 'Cargando inventario',
      description: 'Estamos preparando la lista de productos.',
    },
    error: {
      title: 'No se pudo cargar el inventario',
      description: errorMessage || 'Comprueba tu conexión e inténtalo de nuevo.',
    },
    empty: {
      title: 'Todavía no hay productos registrados',
      description: 'Cuando haya productos, aparecerán aquí.',
    },
  };

  return (
    <DataFeedback
      status={status}
      title={texts[status].title}
      description={texts[status].description}
      onRetry={onRetry}
      actionLabel={status === 'empty' ? 'Actualizar inventario' : 'Reintentar'}
    />
  );
}
