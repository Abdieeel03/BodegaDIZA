"""Valida y adapta los CSV entregados de D'IZA, sin tocar los originales.

Uso:
  python preparar_datos.py --productos productos_diza.csv --ventas ventas_diza_limpio.csv --salida preparados

Salida compatible con los endpoints /test-data/importar del prototipo BodegaDIZA.
Requiere pandas (ver requirements.txt).
"""
from __future__ import annotations
import argparse
import json
from pathlib import Path
import pandas as pd

PRODUCTOS_COL = ["id_producto", "nombre_producto", "categoria", "costo_compra_unitario",
                 "precio_venta_unitario", "stock_actual", "stock_minimo_seguridad", "estado_alerta"]
VENTAS_COL = ["fecha", "dia_semana", "es_fin_de_semana", "id_producto", "nombre_producto",
              "categoria", "costo_compra_unitario", "precio_venta_unitario", "cantidad_repuesta",
              "stock_inicial_dia", "cantidad_vendida", "stock_final_dia", "stock_minimo_seguridad",
              "estado_alerta"]
# Correcciones exclusivamente ortográficas, sin tocar códigos, cantidades ni precios.
NOMBRES = {
    "Azucar rubia 1kg": "Azúcar rubia 1kg", "Atun en lata 170g": "Atún en lata 170g",
    "Chocolate pequeno": "Chocolate pequeño", "Jabon de tocador": "Jabón de tocador",
    "Cafe soluble 100g": "Café soluble 100g", "Papel higienico 4 rollos": "Papel higiénico 4 rollos",
}
CATEGORIAS = {"Lacteos": "Lácteos"}


def validar_columnas(df: pd.DataFrame, esperado: list[str], archivo: str) -> None:
    if list(df.columns) != esperado:
        raise ValueError(f"{archivo}: columnas distintas; esperadas {esperado}")
    if df.empty or df.isna().any().any():
        raise ValueError(f"{archivo}: hay filas vacías o valores faltantes")


def preparar(productos_csv: Path, ventas_csv: Path, salida: Path) -> dict:
    salida.mkdir(parents=True, exist_ok=True)
    p = pd.read_csv(productos_csv, encoding="utf-8-sig", dtype={"id_producto": "string"})
    v = pd.read_csv(ventas_csv, encoding="utf-8-sig", dtype={"id_producto": "string"})
    validar_columnas(p, PRODUCTOS_COL, "productos")
    validar_columnas(v, VENTAS_COL, "ventas")

    if p.id_producto.duplicated().any():
        raise ValueError("Catálogo: id_producto repetido")
    if v.duplicated(subset=["fecha", "id_producto"]).any():
        raise ValueError("Ventas: fecha + id_producto repetidos")
    if not v.id_producto.isin(p.id_producto).all():
        raise ValueError("Ventas: existen productos que no están en el catálogo")

    fechas = pd.to_datetime(v["fecha"], format="%Y-%m-%d", errors="raise")
    if ((fechas.dt.dayofweek + 1).to_numpy() != v.dia_semana.to_numpy()).any():
        raise ValueError("El dia_semana (1=lunes, 7=domingo) no coincide con la fecha")
    if (v["es_fin_de_semana"].isin([0, 1]) == False).any():
        raise ValueError("es_fin_de_semana debe ser 0 o 1")
    for frame, columns in [
        (p, ["costo_compra_unitario", "precio_venta_unitario", "stock_actual", "stock_minimo_seguridad"]),
        (v, ["costo_compra_unitario", "precio_venta_unitario", "cantidad_repuesta", "stock_inicial_dia", "cantidad_vendida", "stock_final_dia", "stock_minimo_seguridad"]),
    ]:
        for col in columns:
            frame[col] = pd.to_numeric(frame[col], errors="raise")
            if (frame[col] < 0).any():
                raise ValueError(f"{col}: contiene valores negativos")
    if ((v["stock_inicial_dia"] - v["cantidad_vendida"] - v["stock_final_dia"]).abs() > 1e-7).any():
        raise ValueError("El stock diario no cuadra: inicial - vendido != final")
    p_by_id = p.set_index("id_producto")
    for col in ["nombre_producto", "categoria", "costo_compra_unitario", "precio_venta_unitario", "stock_minimo_seguridad"]:
        esperado = v["id_producto"].map(p_by_id[col])
        if pd.api.types.is_numeric_dtype(v[col]):
            distinto = (v[col] - esperado).abs() > 1e-7
        else:
            distinto = v[col] != esperado
        if distinto.any():
            raise ValueError(f"Inconsistencia ventas-productos en columna {col}")

    v = v.copy().sort_values(["id_producto", "fecha"]).reset_index(drop=True)
    anterior = v.groupby("id_producto")["stock_final_dia"].shift(1)
    errores_reposicion = (v["stock_inicial_dia"] - anterior - v["cantidad_repuesta"]).abs() > 1e-7
    if errores_reposicion.fillna(False).any():
        raise ValueError("La secuencia diaria de stock y reposiciones no cuadra")
    ultimos = v.groupby("id_producto").tail(1).set_index("id_producto")["stock_final_dia"]
    if ((p_by_id["stock_actual"] - ultimos.reindex(p_by_id.index)).abs() > 1e-7).any():
        raise ValueError("stock_actual del catálogo no coincide con el último día del histórico")

    # Normalizar tildes y fin de semana: viernes se trata como día laboral.
    antes_semana = v["es_fin_de_semana"].astype(int)
    # Recalcular fechas después de ordenar.
    dias = pd.to_datetime(v["fecha"]).dt.dayofweek
    v["es_fin_de_semana"] = (dias >= 5).astype(int)
    corregidas = int((antes_semana != v["es_fin_de_semana"]).sum())
    for df in (p, v):
        df["nombre_producto"] = df["nombre_producto"].replace(NOMBRES)
        df["categoria"] = df["categoria"].replace(CATEGORIAS)

    # Guardar con el esquema ORIGINAL: compatible con /test-data/importar.
    p.to_csv(salida / "productos_diza_validado.csv", index=False, encoding="utf-8")
    v[VENTAS_COL].to_csv(salida / "ventas_diza_validado.csv", index=False, encoding="utf-8")
    # Tabla específica de ML: nunca se importa como una venta operativa ni descuenta stock.
    ventas_ml = v[["fecha", "id_producto", "cantidad_vendida", "dia_semana", "es_fin_de_semana"]].copy()
    ventas_ml.to_csv(salida / "ventas_para_ml.csv", index=False, encoding="utf-8")

    # Preplantilla manual para la futura carga al inventario REAL. Los campos desconocidos van vacíos.
    catalogo = pd.DataFrame({
        "sku": p["id_producto"], "nombre": p["nombre_producto"],
        "categoria": p["categoria"], "precioVenta": p["precio_venta_unitario"],
        "stockMinimo": p["stock_minimo_seguridad"],
        "costoReferenciaCSV": p["costo_compra_unitario"],
        "stockReferenciaAl2026_04_30": p["stock_actual"],
        "unidadMedida": "", "proveedorId": "", "codigoLote": "", "fechaVencimiento": "",
    })
    catalogo.to_csv(salida / "catalogo_operativo_PENDIENTE.csv", index=False, encoding="utf-8")

    resumen = {
        "origen": [productos_csv.name, ventas_csv.name],
        "productos": int(len(p)), "categorias": int(p.categoria.nunique()),
        "registros_ventas_diarias": int(len(v)),
        "fechas_unicas": int(v.fecha.nunique()),
        "periodo": {"desde": str(v.fecha.min()), "hasta": str(v.fecha.max())},
        "ids_productos_coinciden": True,
        "balance_stock_diario_consistente": True,
        "reposiciones_conciliadas": True,
        "stock_catalogo_coincide_con_ultimo_dia": True,
        "filas_fin_de_semana_corregidas": corregidas,
        "regla_fin_de_semana": "sábado y domingo (ISO 6 y 7)",
        "dato_no_disponible": ["proveedorId", "unidadMedida confirmada", "codigoLote", "fechaVencimiento"],
        "advertencia": "Datos de origen: no convertir 2400 filas diarias en tickets reales ni sumar reposiciones dos veces.",
    }
    (salida / "reporte_calidad.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=2), encoding="utf-8")
    return resumen


def main() -> None:
    cli = argparse.ArgumentParser(description="Validar y adaptar CSV BodegaDIZA")
    cli.add_argument("--productos", required=True, type=Path)
    cli.add_argument("--ventas", required=True, type=Path)
    cli.add_argument("--salida", required=True, type=Path)
    a = cli.parse_args()
    info = preparar(a.productos, a.ventas, a.salida)
    print(f"OK: {info['productos']} productos, {info['registros_ventas_diarias']} ventas diarias")
    print("Fechas:", info["periodo"])
    print("Fin de semana corregido:", info["filas_fin_de_semana_corregidas"], "filas")
    print("Archivos compatibles con la API TEST:", a.salida.resolve())

if __name__ == "__main__":
    main()
