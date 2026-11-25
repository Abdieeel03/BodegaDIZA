"""Lectura directa desde PostgreSQL para entrenamiento e inferencia sin CSV."""
from __future__ import annotations

import os
import pandas as pd
import psycopg


def _connection():
    return psycopg.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        port=int(os.environ.get('DB_PORT', '5432')),
        dbname=os.environ.get('DB_NAME', 'bodega_diza'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', ''),
        sslmode=os.environ.get('DB_SSLMODE', 'prefer'),
        prepare_threshold=None,
        connect_timeout=10,
    )


def load_products_from_db() -> pd.DataFrame:
    """Obtiene el catálogo activo y su stock vigente desde public.productos y lotes_producto."""
    query = """
        SELECT
            p.sku AS id_producto,
            p.nombre AS nombre_producto,
            c.nombre AS categoria,
            COALESCE(SUM(l.cantidad_disponible) FILTER (
                WHERE l.cantidad_disponible > 0 AND (
                    ((l.precision_vencimiento IS NULL OR l.precision_vencimiento = 'EXACTA')
                        AND l.fecha_vencimiento >= (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date)
                    OR (l.precision_vencimiento = 'NO_APLICA' AND p.permite_sin_vencimiento = true)
                )
            ), 0)::float8 AS stock_actual,
            p.stock_minimo::float8 AS stock_minimo_seguridad,
            p.precio_venta::float8 AS precio_venta_unitario,
            pr.nombre AS proveedor
        FROM public.productos p
        JOIN public.categorias c ON c.id = p.categoria_id
        JOIN public.proveedores pr ON pr.id = p.proveedor_id
        LEFT JOIN public.lotes_producto l ON l.producto_id = p.id
        WHERE p.activo = true
        GROUP BY p.id, p.sku, p.nombre, c.nombre, p.stock_minimo, p.precio_venta, pr.nombre
        ORDER BY p.sku
    """
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            columns = [desc.name for desc in cur.description]
    df = pd.DataFrame(rows, columns=columns)
    if df.empty:
        raise ValueError('No hay productos activos en PostgreSQL')
    return df


def load_providers_from_db() -> pd.DataFrame:
    """Obtiene los proveedores activos desde public.proveedores."""
    query = """
        SELECT
            ('PRV' || LPAD(id::text, 3, '0')) AS codigo_referencia,
            nombre
        FROM public.proveedores
        WHERE activo = true
        ORDER BY id
    """
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            columns = [desc.name for desc in cur.description]
    df = pd.DataFrame(rows, columns=columns)
    if df.empty:
        raise ValueError('No hay proveedores activos en PostgreSQL')
    return df


def load_sales_from_db() -> pd.DataFrame:
    """Carga todas las ventas desde public.ventas y public.detalles_venta."""
    query = """
        SELECT
            TO_CHAR(v.fecha::date, 'YYYY-MM-DD') AS fecha,
            p.sku AS id_producto,
            SUM(dv.cantidad)::float8 AS cantidad_vendida,
            MAX(dv.precio_unitario)::float8 AS precio_venta_unitario,
            NULL::float8 AS stock_final_dia
        FROM public.detalles_venta dv
        JOIN public.ventas v ON v.id = dv.venta_id
        JOIN public.productos p ON p.id = dv.producto_id
        WHERE p.activo = true
        GROUP BY v.fecha::date, p.sku
        ORDER BY v.fecha::date, p.sku
    """
    with _connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()
            columns = [desc.name for desc in cur.description]
    df = pd.DataFrame(rows, columns=columns)
    if df.empty:
        raise ValueError('No hay ventas registradas en PostgreSQL')
    return df


def load_from_db() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Carga ventas, productos y proveedores desde PostgreSQL."""
    products = load_products_from_db()
    providers = load_providers_from_db()
    sales = load_sales_from_db()
    return sales, products, providers
