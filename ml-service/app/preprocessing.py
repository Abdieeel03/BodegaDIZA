"""Validaciones y datos tabulares; ninguna fecha faltante se interpreta como venta cero."""
from __future__ import annotations
import unicodedata
import pandas as pd

SALE_REQUIRED = {'fecha','id_producto','cantidad_vendida'}
PRODUCT_REQUIRED = {'id_producto','nombre_producto','categoria','stock_actual','stock_minimo_seguridad','precio_venta_unitario','proveedor'}
PROVIDER_REQUIRED = {'codigo_referencia','nombre'}


def norm(value: object) -> str:
    s = str(value).strip().casefold()
    return ''.join(c for c in unicodedata.normalize('NFKD',s) if not unicodedata.combining(c))


def _required(frame: pd.DataFrame, columns: set[str], name: str) -> None:
    missing = sorted(columns - set(frame.columns))
    if missing:
        raise ValueError(f'El archivo de {name} no contiene columnas: {", ".join(missing)}')


def prepare_products(frame: pd.DataFrame) -> pd.DataFrame:
    _required(frame, PRODUCT_REQUIRED, 'productos')
    df = frame.copy()
    for col in ['id_producto','nombre_producto','categoria','proveedor']:
        df[col] = df[col].astype('string').str.strip()
        if df[col].isna().any() or df[col].eq('').any():
            raise ValueError(f'Productos: el campo {col} no puede estar vacío')
    if df['id_producto'].duplicated().any():
        raise ValueError('Productos: existen SKU duplicados')
    for col in ['stock_actual','stock_minimo_seguridad','precio_venta_unitario']:
        df[col] = pd.to_numeric(df[col], errors='coerce')
        if df[col].isna().any() or (df[col] < 0).any():
            raise ValueError(f'Productos: {col} debe ser numérico y mayor o igual a cero; no se inventarán valores')
    if 'costo_compra_unitario' in df:
        df['costo_compra_unitario'] = pd.to_numeric(df['costo_compra_unitario'],errors='coerce')
    return df.reset_index(drop=True)


def prepare_providers(frame: pd.DataFrame | None, products: pd.DataFrame) -> pd.DataFrame:
    if frame is None:
        distinct = sorted(products['proveedor'].unique())
        return pd.DataFrame({'codigo_referencia': [None]*len(distinct),'nombre':distinct})
    _required(frame, PROVIDER_REQUIRED, 'proveedores')
    df = frame.copy()
    for col in ['codigo_referencia','nombre']:
        df[col] = df[col].astype('string').str.strip()
    if df[['codigo_referencia','nombre']].isna().any().any() or df[['codigo_referencia','nombre']].eq('').any().any():
        raise ValueError('Proveedores: código y nombre son obligatorios')
    if df['codigo_referencia'].duplicated().any() or df['nombre'].map(norm).duplicated().any():
        raise ValueError('Proveedores: existen códigos o nombres duplicados')
    unknown = sorted(set(products['proveedor'].map(norm)) - set(df['nombre'].map(norm)))
    if unknown:
        raise ValueError(f'Proveedores no encontrados en su catálogo: {unknown}')
    return df.reset_index(drop=True)


def prepare_sales(frame: pd.DataFrame, products: pd.DataFrame) -> tuple[pd.DataFrame,int]:
    _required(frame, SALE_REQUIRED, 'ventas')
    df = frame.copy()
    original = len(df)
    df['id_producto'] = df['id_producto'].astype('string').str.strip()
    df['fecha'] = pd.to_datetime(df['fecha'],format='%Y-%m-%d',errors='coerce').dt.normalize()
    df['cantidad_vendida'] = pd.to_numeric(df['cantidad_vendida'], errors='coerce')
    df['precio_venta_unitario'] = pd.to_numeric(df['precio_venta_unitario'],errors='coerce') if 'precio_venta_unitario' in df else float('nan')
    df = df.drop_duplicates()
    valid = df['fecha'].notna() & df['id_producto'].notna() & df['id_producto'].ne('') & df['cantidad_vendida'].notna() & (df['cantidad_vendida'] >= 0)
    rejected = int((~valid).sum())
    if rejected > max(5,int(original*0.05)):
        raise ValueError(f'Datos de ventas inválidos: {rejected} de {original} filas')
    df = df.loc[valid].copy()
    missing_sku = sorted(set(df['id_producto']) - set(products['id_producto']))
    if missing_sku:
        raise ValueError(f'Las ventas contienen productos ausentes del catálogo: {missing_sku[:10]}')
    # Consolidar transacciones del MISMO día si existen; no fabricar días sin información.
    df = df.groupby(['id_producto','fecha'],as_index=False).agg({'cantidad_vendida':'sum','precio_venta_unitario':'last'})
    attrs = products[['id_producto','nombre_producto','categoria','precio_venta_unitario']].rename(columns={'precio_venta_unitario':'precio_catalogo'})
    df = df.merge(attrs,on='id_producto',how='left',validate='many_to_one')
    df['precio_venta_unitario'] = df['precio_venta_unitario'].fillna(df['precio_catalogo'])
    if df['precio_venta_unitario'].isna().any() or (df['precio_venta_unitario'] < 0).any():
        raise ValueError('Ventas: hay precios faltantes o inválidos')
    df = df.drop(columns=['precio_catalogo']).sort_values(['fecha','id_producto']).reset_index(drop=True)
    if len(df) < 100 or df['id_producto'].nunique() < 2:
        raise ValueError('No hay suficientes observaciones y productos distintos para validar el modelo')
    return df,rejected


def coverage(sales: pd.DataFrame) -> dict[str,object]:
    first = sales['fecha'].min()
    last = sales['fecha'].max()
    days = int((last-first).days)+1
    total = days*sales['id_producto'].nunique()
    return {
        'firstDate':first.date().isoformat(), 'lastDate':last.date().isoformat(),
        'calendarDays':days, 'observedProductDays':len(sales),
        'expectedProductDaysIfComplete':total,
        'coverageRatio':round(len(sales)/total,5),
        'missingDatesPolicy':'UNKNOWN_NOT_ZERO',
    }
