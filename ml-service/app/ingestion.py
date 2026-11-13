"""Ingesta de CSV/Excel; no conoce el modelo ni la API."""
from io import BytesIO
from pathlib import Path
import pandas as pd

MAX_BYTES = 15 * 1024 * 1024


def read_table(filename: str, content: bytes) -> pd.DataFrame:
    name = Path(filename or '').name.lower()
    if not content or len(content) > MAX_BYTES:
        raise ValueError('El archivo está vacío o supera el límite de 15 MB')
    try:
        if name.endswith('.csv'):
            table = pd.read_csv(BytesIO(content), encoding='utf-8-sig', dtype={'id_producto': 'string', 'codigo_referencia': 'string'})
        elif name.endswith('.xlsx'):
            table = pd.read_excel(BytesIO(content), engine='openpyxl', dtype={'id_producto': 'string', 'codigo_referencia': 'string'})
        else:
            raise ValueError('Solo se admiten CSV UTF-8 y Excel .xlsx')
    except (UnicodeError, pd.errors.ParserError, ValueError, TypeError, ImportError) as exc:
        raise ValueError(f'No fue posible leer {name}: {exc}') from exc
    if table.empty:
        raise ValueError(f'El archivo {name} no contiene registros')
    table.columns = table.columns.astype(str).str.strip().str.removeprefix('\ufeff')
    return table


def read_local(path: str | Path) -> pd.DataFrame:
    filepath = Path(path)
    return read_table(filepath.name, filepath.read_bytes())
