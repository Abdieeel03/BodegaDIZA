-- Costos iniciales de referencia del escenario academico. No registra compras.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
DO $$ BEGIN
    IF current_database() <> 'bodega_diza_test' THEN
        RAISE EXCEPTION 'Esta carga solo se permite en bodega_diza_test';
    END IF;
END $$;
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS precio_costo numeric(12,2);
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.productos'::regclass AND conname='ck_productos_precio_costo_positivo') THEN
        ALTER TABLE public.productos ADD CONSTRAINT ck_productos_precio_costo_positivo CHECK (precio_costo IS NULL OR precio_costo > 0);
    END IF;
END $$;
CREATE TEMP TABLE costos_04a(sku text PRIMARY KEY, venta numeric(12,2), costo numeric(12,2)) ON COMMIT DROP;
INSERT INTO costos_04a VALUES
    ('P001',4.20,3.45),
    ('P002',4.20,3.40),
    ('P003',4.30,3.45),
    ('P004',8.50,7.00),
    ('P005',0.75,0.58),
    ('P006',6.50,5.20),
    ('P007',1.70,1.10),
    ('P008',2.70,2.00),
    ('P009',7.20,5.65),
    ('P010',3.10,2.40),
    ('P011',6.10,4.95),
    ('P012',1.50,1.08),
    ('P013',2.50,1.75),
    ('P014',2.00,1.40),
    ('P015',6.50,5.15),
    ('P016',9.30,7.35),
    ('P017',5.00,3.75),
    ('P018',7.50,5.90),
    ('P019',2.20,1.55),
    ('P020',13.50,10.90);
DO $$ BEGIN
    IF (SELECT count(*) FROM costos_04a c JOIN public.productos p ON p.sku=c.sku AND p.activo AND p.precio_venta=c.venta) <> 20 THEN
        RAISE EXCEPTION 'El catalogo o los precios de venta cambiaron; revisar antes de cargar los costos';
    END IF;
END $$;
UPDATE public.productos p SET precio_costo=c.costo FROM costos_04a c
WHERE p.sku=c.sku AND p.precio_costo IS NULL;
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM costos_04a c JOIN public.productos p ON p.sku=c.sku WHERE p.precio_costo IS NULL OR p.precio_costo<=0) THEN
        RAISE EXCEPTION 'Costo faltante o invalido';
    END IF;
END $$;
COMMIT;
SELECT sku,nombre,precio_costo,precio_venta FROM public.productos WHERE activo ORDER BY sku;
