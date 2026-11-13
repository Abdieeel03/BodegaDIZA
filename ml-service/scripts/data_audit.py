"""Diagnóstico de integridad, sin alterar las ventas originales."""
import argparse,json
from app.ingestion import read_local
from app.preprocessing import prepare_products,prepare_sales


def audit(ventas,productos)->dict:
    p=prepare_products(productos)
    s,rejected=prepare_sales(ventas,p)
    original=ventas.copy()
    original['fecha']=__import__('pandas').to_datetime(original['fecha'],errors='coerce')
    original=original.sort_values(['id_producto','fecha'])
    previous=original.groupby('id_producto')['stock_final_dia'].shift()
    mismatch_internal=(original.stock_inicial_dia+original.cantidad_repuesta-original.cantidad_vendida!=original.stock_final_dia)
    mismatch_continuity=previous.notna()&(original.stock_inicial_dia!=previous)
    final=original.groupby('id_producto').tail(1).set_index('id_producto').stock_final_dia
    snap=p.set_index('id_producto').stock_actual
    differences={sku:{'catalogStock':float(snap[sku]),'lastHistoricalClose':float(final[sku])}
                 for sku in snap.index if sku in final.index and snap[sku]!=final[sku]}
    return {'productCount':len(p),'salesCount':len(s),'rejectedSales':rejected,
            'invalidStockEquationRows':int(mismatch_internal.sum()),
            'stockContinuityDifferences':int(mismatch_continuity.sum()),
            'catalogVsLastHistoricalStockDifferences':differences,
            'note':'El inventario del catálogo es una referencia; NO se deduce de estas ventas históricas inconsistentes.'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--ventas',default='data/ventas.csv')
    parser.add_argument('--productos',default='data/productos.csv')
    args=parser.parse_args()
    print(json.dumps(audit(read_local(args.ventas),read_local(args.productos)),ensure_ascii=False,indent=2))
if __name__=='__main__':main()
