-- BodegaDIZA: escenario academico reproducible, no es historial comercial real.
-- Solo completa dias sin ventas entre 2026-05-01 y 2026-11-11.
-- Conserva ventas anteriores y recientes; los lotes historicos nuevos se consumen
-- por completo en el escenario y no alteran las existencias actuales.
-- Ejecutar con psql -X -v ON_ERROR_STOP=1 -f archivo.sql
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL TIME ZONE 'America/Lima';
SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
    IF current_database() <> 'bodega_diza_test' THEN
        RAISE EXCEPTION 'Solo se permite bodega_diza_test';
    END IF;
    IF CURRENT_DATE < DATE '2026-11-12' THEN
        RAISE EXCEPTION 'El periodo debe ser historico';
    END IF;
END $$;

LOCK TABLE public.productos, public.usuarios, public.ventas,
    public.detalles_venta, public.lotes_producto, public.movimientos_inventario
    IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE staging_diza.ventas_csv IN SHARE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.ventas WHERE fecha >= DATE '2026-05-01' AND fecha < DATE '2026-11-12')
       OR EXISTS (SELECT 1 FROM staging_diza.ventas_csv WHERE fecha >= DATE '2026-05-01' AND fecha < DATE '2026-11-12')
       OR EXISTS (SELECT 1 FROM public.lotes_producto WHERE codigo_lote LIKE 'HIST26-%') THEN
        RAISE EXCEPTION 'El periodo ya contiene registros o fue cargado. No se duplicaran ventas.';
    END IF;
    IF (SELECT count(*) FROM public.productos WHERE activo) <> 20 THEN
        RAISE EXCEPTION 'Se esperaba el catalogo activo de 20 productos del equipo';
    END IF;
    IF (SELECT count(*) FROM public.usuarios WHERE email='admin@bodegadiza.com' AND rol='ADMIN') <> 1 THEN
        RAISE EXCEPTION 'No se encontro el administrador de la base de pruebas';
    END IF;
END $$;

CREATE TEMP TABLE h26_stock_antes ON COMMIT DROP AS
SELECT id,cantidad_disponible FROM public.lotes_producto;

-- Cantidad por SKU y dia, procedente de ventas operativas de enero a abril.
-- No se usa noviembre ni las metricas del modelo para generar el escenario.
CREATE TEMP TABLE h26_base ON COMMIT DROP AS
SELECT d.producto_id, v.fecha::date AS dia,
       extract(isodow FROM v.fecha)::int AS dow,
       sum(d.cantidad) AS cantidad
FROM public.detalles_venta d JOIN public.ventas v ON v.id=d.venta_id
WHERE v.fecha >= DATE '2026-01-01' AND v.fecha < DATE '2026-05-01'
GROUP BY d.producto_id,v.fecha::date,extract(isodow FROM v.fecha)::int
HAVING sum(d.cantidad)>0;

CREATE TEMP TABLE h26_plan ON COMMIT DROP AS
WITH catalogo AS (
    SELECT p.id,p.sku,p.precio_venta,
           row_number() OVER(ORDER BY p.sku,p.id) AS rn,
           CASE WHEN p.sku='P009' THEN 3 ELSE 7 END AS intervalo,
           CASE WHEN p.sku='P009' THEN 1 WHEN p.sku IN ('P005','P015') THEN 7
                WHEN p.sku='P001' THEN 90 ELSE 120 END AS vida_extra
    FROM public.productos p WHERE p.activo
), calendario AS (
    SELECT x::date AS dia FROM generate_series(DATE '2026-05-01',DATE '2026-11-11',interval '1 day') AS s(x)
)
SELECT c.id AS producto_id,c.sku,d.dia,
       ((c.rn-1)%3)::integer AS grupo,
       'HIST26-'||c.sku||'-'||((d.dia-DATE '2026-05-01')/c.intervalo)::text AS codigo_lote,
       c.vida_extra, c.precio_venta AS precio,
       greatest(1,round(b.cantidad * (0.90 +
           (('x'||substr(md5('variacion-'||c.sku||d.dia::text),1,4))::bit(16)::int % 21)/100.0),0)) AS cantidad
FROM catalogo c CROSS JOIN calendario d
CROSS JOIN LATERAL (
    SELECT h.cantidad FROM h26_base h
    WHERE h.producto_id=c.id AND h.dow=extract(isodow FROM d.dia)::int
    ORDER BY md5('muestra-'||c.sku||d.dia::text||h.dia::text),h.dia
    LIMIT 1
) b;

DO $$ BEGIN
    IF (SELECT count(*) FROM h26_plan) <> 195*20 THEN
        RAISE EXCEPTION 'Faltan observaciones historicas por producto/dia de semana';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_plan WHERE precio IS NULL OR precio<=0 OR cantidad<=0) THEN
        RAISE EXCEPTION 'Precio o cantidad invalida';
    END IF;
END $$;

CREATE TEMP TABLE h26_lotes ON COMMIT DROP AS
SELECT producto_id,codigo_lote,min(dia) AS ingreso,max(dia)+max(vida_extra) AS vencimiento,
       sum(cantidad) AS cantidad
FROM h26_plan GROUP BY producto_id,codigo_lote;

-- Recepciones historicas independientes de los lotes existentes.
INSERT INTO public.lotes_producto(producto_id,codigo_lote,cantidad_disponible,fecha_ingreso,fecha_vencimiento,precision_vencimiento,version)
SELECT producto_id,codigo_lote,cantidad,ingreso,vencimiento,'EXACTA',0 FROM h26_lotes ORDER BY ingreso,producto_id;

INSERT INTO public.movimientos_inventario(producto_id,lote_id,tipo,cantidad,fecha,motivo,usuario_id,compra_id,venta_id)
SELECT l.producto_id,l.id,'ENTRADA',h.cantidad,h.ingreso+TIME '07:30',
       'HIST26 | Entrada de mercaderia',u.id,NULL,NULL
FROM h26_lotes h JOIN public.lotes_producto l ON l.producto_id=h.producto_id AND l.codigo_lote=h.codigo_lote
CROSS JOIN (SELECT id FROM public.usuarios WHERE email='admin@bodegadiza.com') u;

CREATE TEMP TABLE h26_tickets (dia date,grupo integer,venta_id bigint,fecha timestamp,PRIMARY KEY(dia,grupo)) ON COMMIT DROP;
DO $$
DECLARE r record; nuevo_id bigint; usuario bigint;
BEGIN
    SELECT id INTO STRICT usuario FROM public.usuarios WHERE email='admin@bodegadiza.com';
    FOR r IN SELECT dia,grupo,sum(round(cantidad*precio,2)) AS total
             FROM h26_plan GROUP BY dia,grupo ORDER BY dia,grupo LOOP
        INSERT INTO public.ventas(fecha,total,usuario_id)
        VALUES(r.dia+TIME '09:00'+r.grupo*interval '3 hours',r.total,usuario)
        RETURNING id INTO nuevo_id;
        INSERT INTO h26_tickets VALUES(r.dia,r.grupo,nuevo_id,r.dia+TIME '09:00'+r.grupo*interval '3 hours');
    END LOOP;
END $$;

INSERT INTO public.detalles_venta(venta_id,producto_id,lote_id,cantidad,precio_unitario,subtotal)
SELECT t.venta_id,p.producto_id,l.id,p.cantidad,p.precio,round(p.cantidad*p.precio,2)
FROM h26_plan p JOIN h26_tickets t ON t.dia=p.dia AND t.grupo=p.grupo
JOIN public.lotes_producto l ON l.producto_id=p.producto_id AND l.codigo_lote=p.codigo_lote;

INSERT INTO public.movimientos_inventario(producto_id,lote_id,tipo,cantidad,fecha,motivo,usuario_id,compra_id,venta_id)
SELECT d.producto_id,d.lote_id,'SALIDA',d.cantidad,t.fecha,
       'HIST26 | Salida por venta #'||t.venta_id,v.usuario_id,NULL,t.venta_id
FROM h26_tickets t JOIN public.detalles_venta d ON d.venta_id=t.venta_id
JOIN public.ventas v ON v.id=t.venta_id;

UPDATE public.lotes_producto l SET cantidad_disponible=l.cantidad_disponible-h.cantidad
FROM h26_lotes h WHERE l.producto_id=h.producto_id AND l.codigo_lote=h.codigo_lote;

-- Controles antes de confirmar: cualquier incumplimiento revierte toda la carga.
DO $$ BEGIN
    IF (SELECT count(*) FROM h26_tickets) <> 585 OR
       (SELECT count(*) FROM public.detalles_venta d JOIN h26_tickets t ON t.venta_id=d.venta_id) <> 3900 THEN
        RAISE EXCEPTION 'Cantidad inesperada de tickets o detalles';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_stock_antes a LEFT JOIN public.lotes_producto l ON l.id=a.id
              WHERE l.id IS NULL OR l.cantidad_disponible IS DISTINCT FROM a.cantidad_disponible) THEN
        RAISE EXCEPTION 'Cambio no permitido en el stock existente';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_lotes h JOIN public.lotes_producto l ON l.producto_id=h.producto_id AND l.codigo_lote=h.codigo_lote
              WHERE l.cantidad_disponible<>0) THEN
        RAISE EXCEPTION 'Los lotes historicos deben quedar consumidos';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_tickets t JOIN public.ventas v ON v.id=t.venta_id
              JOIN public.detalles_venta d ON d.venta_id=v.id GROUP BY v.id,v.total HAVING v.total<>sum(d.subtotal)) THEN
        RAISE EXCEPTION 'Importe de ticket inconsistente';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_tickets t JOIN public.detalles_venta d ON d.venta_id=t.venta_id
              JOIN public.lotes_producto l ON l.id=d.lote_id
              WHERE l.producto_id<>d.producto_id OR t.dia<l.fecha_ingreso OR t.dia>l.fecha_vencimiento) THEN
        RAISE EXCEPTION 'Detalle incompatible con lote';
    END IF;
    IF EXISTS(SELECT 1 FROM h26_lotes h JOIN public.lotes_producto l ON l.producto_id=h.producto_id AND l.codigo_lote=h.codigo_lote
              LEFT JOIN public.movimientos_inventario m ON m.lote_id=l.id
              GROUP BY l.id,h.cantidad HAVING coalesce(sum(m.cantidad) FILTER(WHERE m.tipo='ENTRADA'),0)<>h.cantidad
                OR coalesce(sum(m.cantidad) FILTER(WHERE m.tipo='SALIDA'),0)<>h.cantidad) THEN
        RAISE EXCEPTION 'Movimientos historicos no conciliados';
    END IF;
    RAISE NOTICE 'Carga completada: 585 tickets, 3900 detalles, % lotes historicos; stock previo intacto', (SELECT count(*) FROM h26_lotes);
END $$;
COMMIT;

SELECT to_char(fecha,'YYYY-MM') AS mes,count(*) AS tickets,count(DISTINCT fecha::date) AS dias_con_ventas,sum(total) AS importe
FROM public.ventas WHERE fecha>=DATE '2026-01-01' AND fecha<DATE '2026-12-01' GROUP BY 1 ORDER BY 1;

-- Conciliacion de fuentes anteriores (solo lectura). Las coincidencias no se suman.
WITH op AS (
    SELECT v.fecha::date AS dia,p.sku,sum(d.cantidad) AS unidades,sum(d.subtotal) AS importe
    FROM public.ventas v JOIN public.detalles_venta d ON d.venta_id=v.id JOIN public.productos p ON p.id=d.producto_id
    WHERE v.fecha>=DATE '2026-01-01' AND v.fecha<DATE '2026-05-01' GROUP BY 1,2
), hist AS (
    SELECT fecha::date AS dia,id_producto AS sku,sum(cantidad_vendida) AS unidades,
           sum(cantidad_vendida*precio_venta_unitario) AS importe
    FROM staging_diza.ventas_csv GROUP BY 1,2
)
SELECT count(*) FILTER(WHERE op.sku IS NOT NULL AND hist.sku IS NOT NULL) AS solapamientos,
       count(*) FILTER(WHERE op.sku IS NOT NULL AND hist.sku IS NOT NULL AND op.unidades=hist.unidades AND abs(op.importe-hist.importe)<0.01) AS coincidencias_exactas,
       count(*) FILTER(WHERE op.sku IS NOT NULL AND hist.sku IS NOT NULL AND (op.unidades<>hist.unidades OR abs(op.importe-hist.importe)>=0.01)) AS diferencias,
       count(*) FILTER(WHERE op.sku IS NULL) AS solo_historico,
       count(*) FILTER(WHERE hist.sku IS NULL) AS solo_operativo
FROM op FULL JOIN hist ON op.dia=hist.dia AND op.sku=hist.sku;
