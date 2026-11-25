"""Ejecuta el predicado SQL real con tablas efímeras; jamás conecta a PostgreSQL."""
from contextlib import contextmanager
from types import SimpleNamespace
import sqlite3
import pytest
from app import database


@pytest.mark.parametrize("allows_none,expected", [(True, 14.5), (False, 10.5)])
def test_sellable_stock_excludes_expired_pending_and_month(monkeypatch, allows_none, expected):
    conn = sqlite3.connect(":memory:")
    conn.executescript("""
        CREATE TABLE productos(id INTEGER, sku TEXT, nombre TEXT, categoria_id INTEGER,
            proveedor_id INTEGER, stock_minimo REAL, precio_venta REAL, activo BOOLEAN, permite_sin_vencimiento BOOLEAN);
        CREATE TABLE categorias(id INTEGER, nombre TEXT);
        CREATE TABLE proveedores(id INTEGER, nombre TEXT);
        CREATE TABLE lotes_producto(producto_id INTEGER, cantidad_disponible REAL,
            precision_vencimiento TEXT, fecha_vencimiento TEXT);
        INSERT INTO categorias VALUES(1, 'Artículos');
        INSERT INTO proveedores VALUES(1, 'Proveedor de prueba');
    """)
    conn.execute("INSERT INTO productos VALUES(1, 'P1', 'Producto', 1, 1, 2, 5, true, ?)", (allows_none,))
    conn.executemany("INSERT INTO lotes_producto VALUES(1, ?, ?, ?)", [
        (2, None, '2026-11-25'),         # fecha histórica preservada
        (3, 'EXACTA', '2026-11-24'),    # vence hoy: conserva regla existente
        (5.5, 'EXACTA', '2026-11-30'),
        (10, 'EXACTA', '2026-11-23'),
        (20, 'PENDIENTE', None),
        (30, 'MES_ANIO', None),
        (4, 'NO_APLICA', None),
        (100, None, None),             # null por sí solo no significa no aplica
        (0, 'EXACTA', '2026-11-30'),
    ])

    class Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def execute(self, query):
            # Solo adapta sintaxis de namespace, cast y reloj PostgreSQL.
            query = query.replace('public.', '').replace('::float8', '')
            query = query.replace("(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date", "'2026-11-24'")
            self.result = conn.execute(query)
            self.description = [SimpleNamespace(name=column[0]) for column in self.result.description]

        def fetchall(self):
            return self.result.fetchall()

    @contextmanager
    def connection():
        yield SimpleNamespace(cursor=Cursor)

    monkeypatch.setattr(database, '_connection', connection)
    try:
        products = database.load_products_from_db()
        assert products.iloc[0].stock_actual == expected
        assert products.iloc[0].id_producto == 'P1'
    finally:
        conn.close()
