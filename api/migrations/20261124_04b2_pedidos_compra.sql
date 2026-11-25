BEGIN;
DO $$ BEGIN
    IF current_database() <> 'bodega_diza_test' THEN
        RAISE EXCEPTION 'Esta migración de pruebas solo se ejecuta en bodega_diza_test';
    END IF;
END $$;
ALTER TABLE public.detalles_compra ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS usuario_pedido_id bigint REFERENCES public.usuarios(id);
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS fecha_recepcion timestamp;
COMMIT;
SELECT column_name, is_nullable, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND ((table_name = 'detalles_compra' AND column_name = 'lote_id')
    OR (table_name = 'compras' AND column_name IN ('usuario_pedido_id','fecha_recepcion')))
ORDER BY table_name, column_name;
