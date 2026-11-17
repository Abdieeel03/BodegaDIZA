"""Sincroniza catálogo CSV con Spring Boot en PostgreSQL de desarrollo.

Nunca inserta ventas históricas como tickets ni modifica stock positivo.
Las entradas se generan usando los endpoints transaccionales existentes,
no mediante inserciones SQL directas ni sobrescritura de stock.
"""
from __future__ import annotations
import argparse
import getpass
import json
import os
import unicodedata
from datetime import date,timedelta,datetime
from pathlib import Path
import httpx
import pandas as pd
from app.ingestion import read_local
from app.preprocessing import prepare_products,prepare_providers,norm

# Alias del proveedor del catálogo anterior, para no crear seis duplicados.
KNOWN_ALIASES={
 'PRV001':['PROVEEDOR TEST - LÁCTEOS DIZA'],
 'PRV002':['PROVEEDOR TEST - ABARROTES DIZA'],
 'PRV003':['PROVEEDOR TEST - BEBIDAS DIZA'],
 'PRV004':['PROVEEDOR TEST - CONSERVAS DIZA'],
 'PRV005':['PROVEEDOR TEST - SNACKS DIZA'],
 'PRV006':['PROVEEDOR TEST - LIMPIEZA DIZA'],
}
UNITS={'UNIDAD','BOTELLA','CAJA','PACK','LITRO','BOLSA','LATA','KILOGRAMO'}


def synthetic_ruc(reference:str)->str:
    if not reference.startswith('PRV') or not reference[3:].isdigit():
        raise ValueError('Código de proveedor inválido')
    return f'2099{int(reference[3:]):07d}'


def unwrap(payload):
    if not isinstance(payload,dict) or not payload.get('success'):
        raise ValueError(f'La API no devolvió un resultado correcto: {str(payload)[:250]}')
    return payload['data']

class DizaClient:
    def __init__(self,base_url:str,token:str):
        if base_url.rstrip('/')!='http://localhost:8081':
            raise ValueError('Este sincronizador está restringido a http://localhost:8081')
        self.client=httpx.Client(base_url=base_url,headers={'Authorization':f'Bearer {token}'},timeout=30)

    def get(self,path:str,params:dict|None=None):
        response=self.client.get(path,params=params)
        response.raise_for_status()
        return unwrap(response.json())

    def send(self,path:str,payload:dict,method='POST'):
        response=self.client.request(method,path,json=payload)
        if response.status_code>=400:
            raise RuntimeError(f'{method} {path}: HTTP {response.status_code} {response.text[:300]}')
        return unwrap(response.json())

    def close(self):self.client.close()


def login(base_url:str, email:str, password:str)->str:
    response=httpx.post(base_url+'/auth/login',json={'email':email,'password':password},timeout=20)
    response.raise_for_status()
    return unwrap(response.json())['token']


def normalized_lookup(items:list[dict],field:str='nombre')->dict[str,dict]:
    return {norm(x.get(field,'')):x for x in items}


def product_request(row:pd.Series,category:int,supplier:int)->dict:
    unit=str(row.get('unidad_medida') or 'UNIDAD').strip().upper()
    if unit not in UNITS:raise ValueError(f'Unidad de medida inválida: {unit}')
    return {'sku':str(row.id_producto),'nombre':str(row.nombre_producto),
            'descripcion':f'Producto del catálogo DIZA · SKU {row.id_producto}',
            'categoriaId':category,'proveedorId':supplier,
            'precioVenta':round(float(row.precio_venta_unitario),2),
            'stockMinimo':float(row.stock_minimo_seguridad),'unidadMedida':unit,
            'loteInicial':None}


def normalize_products(p):
    """El catálogo CSV tiene snapshot stock, NO un kardex."""
    return prepare_products(p)


def sync(api:DizaClient,products_csv:pd.DataFrame,providers_csv:pd.DataFrame,
         apply:bool=False,update_metadata:bool=True,output_dir:str|Path='data/sync') -> dict:
    products=normalize_products(products_csv)
    providers=prepare_providers(providers_csv,products)
    # Verificación positiva de que la API está conectada a staging de la base TEST.
    api.get('/test-data/resumen')
    category_list=api.get('/categorias')
    provider_list=api.get('/proveedores')
    operational=api.get('/productos')
    by_category=normalized_lookup(category_list)
    by_provider=normalized_lookup(provider_list)
    by_sku={str(x['sku']).upper():x for x in operational}
    folder=Path(output_dir)
    folder.mkdir(parents=True,exist_ok=True)
    if apply:
        backup={'createdAt':datetime.now().isoformat(),'categories':category_list,
                'providers':provider_list,'products':operational}
        stamp=datetime.now().strftime('%Y%m%d_%H%M%S')
        (folder/f'catalogo_antes_{stamp}.json').write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf-8')
    actions=[]; created=0;entries=0;retained=0
    provider_ids={}
    for row in providers.itertuples(index=False):
        reference=str(row.codigo_referencia)
        canonical=str(row.nombre)
        found=by_provider.get(norm(canonical))
        if not found:
            found=next((by_provider.get(norm(alias)) for alias in KNOWN_ALIASES.get(reference,[]) if norm(alias) in by_provider),None)
        ruc=synthetic_ruc(reference)
        if found:
            pid=int(found['id'])
            if norm(found['nombre'])!=norm(canonical):
                actions.append(f'Proveedor {reference}: renombrar {found["nombre"]} -> {canonical}')
                if apply:
                    data={'nombre':canonical,'ruc':str(found['ruc']),
                          'telefono':found.get('telefono'),'email':found.get('email')}
                    updated=api.send(f'/proveedores/{pid}',data,'PUT')
                    by_provider[norm(canonical)]=updated
        else:
            actions.append(f'Proveedor {reference}: crear {canonical} con RUC sintético {ruc}')
            if apply:
                found=api.send('/proveedores',{'nombre':canonical,'ruc':ruc,'telefono':None,'email':None})
                pid=int(found['id'])
                by_provider[norm(canonical)]=found
                created+=1
            else:
                pid=-1
        provider_ids[norm(canonical)]=pid

    for category in sorted(products.categoria.unique(),key=norm):
        if norm(category) in by_category: continue
        actions.append(f'Categoría: crear {category}')
        if apply:
            found=api.send('/categorias',{'nombre':str(category),'descripcion':'Categoría del catálogo DIZA'})
            by_category[norm(category)]=found
    for row in products.itertuples(index=False):
        sku=str(row.id_producto).upper()
        cat=by_category.get(norm(row.categoria))
        supplier_id=provider_ids[norm(row.proveedor)]
        product_payload=product_request(pd.Series(row._asdict()),int(cat['id']) if cat else -1,supplier_id)
        stock_csv=float(row.stock_actual)
        found=by_sku.get(sku)
        if found is None:
            actions.append(f'{sku}: crear producto con stock inicial {stock_csv}')
            if apply:
                if stock_csv>0:
                    product_payload['loteInicial']={
                        'codigoLote':f'CATALOGO-{sku}-INICIAL','cantidad':stock_csv,
                        'fechaVencimiento':(date.today()+timedelta(days=365)).isoformat()}
                found=api.send('/productos',product_payload)
                by_sku[sku]=found;created+=1
                if stock_csv>0:entries+=1
            continue
        operational_stock=float(found['stockTotal'])
        if update_metadata:
            differences=(int(found['categoria']['id'])!=product_payload['categoriaId'] or
                         int(found['proveedor']['id'])!=product_payload['proveedorId'] or
                         str(found['unidadMedida'])!=product_payload['unidadMedida'] or
                         float(found['precioVenta'])!=product_payload['precioVenta'] or
                         float(found['stockMinimo'])!=product_payload['stockMinimo'])
            if differences:
                actions.append(f'{sku}: actualizar categoría/proveedor/unidad/precio/stock mínimo')
                if apply:
                    product_payload['descripcion']=found.get('descripcion') or product_payload['descripcion']
                    found=api.send(f'/productos/{found["id"]}',product_payload,'PUT')
                    by_sku[sku]=found
        if operational_stock>0:
            if operational_stock!=stock_csv:
                actions.append(f'{sku}: conservar stock operativo {operational_stock} (catálogo {stock_csv})')
                retained+=1
            continue
        if stock_csv<=0:continue
        lots=api.get('/inventario/lotes',params={'productoId':found['id']})
        initial_lot=f'CATALOGO-{sku}-INICIAL'
        if any(lot.get('codigoLote')==initial_lot for lot in lots):
            actions.append(f'{sku}: ya tuvo carga inicial; no reponer automáticamente')
            continue
        actions.append(f'{sku}: entrada inicial de {stock_csv} unidades')
        if apply:
            api.send('/inventario/entradas',{
                'productoId':found['id'],'codigoLote':initial_lot,
                'cantidad':stock_csv,
                'fechaVencimiento':(date.today()+timedelta(days=365)).isoformat(),
                'motivo':'Carga inicial desde catálogo de productos'})
            entries+=1
    if apply:
        refreshed={str(p['sku']).upper():p for p in api.get('/productos')}
        categories={int(c['id']):c for c in api.get('/categorias')}
        suppliers={int(x['id']):x for x in api.get('/proveedores')}
        snapshot=[]
        for row in products.itertuples(index=False):
            operational_item=refreshed[str(row.id_producto).upper()]
            actual_stock=float(operational_item['stockTotal'])
            snapshot.append({
                'id_producto':str(row.id_producto),'nombre_producto':operational_item['nombre'],
                'categoria':operational_item['categoria']['nombre'],
                'costo_compra_unitario':float(row.costo_compra_unitario),
                'precio_venta_unitario':float(operational_item['precioVenta']),
                'stock_actual':actual_stock,
                'stock_minimo_seguridad':float(operational_item['stockMinimo']),
                'estado_alerta':'ROJO' if actual_stock<=float(operational_item['stockMinimo']) else 'VERDE',
                'proveedor':operational_item['proveedor']['nombre'],
                'unidad_medida':operational_item['unidadMedida'],
            })
        export_file=folder/'productos_para_ml.csv'
        pd.DataFrame(snapshot).to_csv(export_file,index=False,encoding='utf-8-sig')
        actions.append(f'Snapshot de existencias operativas actualizado: {export_file.resolve()}')
    report={'applied':apply,'existingOperationalProducts':len(operational),
            'catalogProducts':len(products),'catalogProviders':len(providers),
            'actions':actions,'createdItems':created,'registeredStockEntries':entries,
            'retainedExistingStockDifferentFromCsv':retained}
    stamp=datetime.now().strftime('%Y%m%d_%H%M%S')
    path=folder/f'sync_{stamp}_{"aplicado" if apply else "vista_previa"}.json'
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return report


def main():
    parser=argparse.ArgumentParser(description='Sincronizar catálogo con Spring Boot local, usando API y lotes.')
    parser.add_argument('--productos',default='data/productos.csv')
    parser.add_argument('--proveedores',default='data/proveedores.csv')
    parser.add_argument('--api-url',default='http://localhost:8081')
    parser.add_argument('--email',default='admin@bodegadiza.com')
    parser.add_argument('--apply',action='store_true',help='Aplicar modificaciones en PostgreSQL TEST')
    parser.add_argument('--no-update-metadata',action='store_true')
    parser.add_argument('--output-dir',default='data/sync')
    args=parser.parse_args()
    products=read_local(args.productos)
    providers=read_local(args.proveedores)
    password=getpass.getpass('Contraseña del administrador: ')
    token=login(args.api_url,args.email,password)
    api=DizaClient(args.api_url,token)
    try:
        result=sync(api,products,providers,args.apply,not args.no_update_metadata,args.output_dir)
    finally:api.close()
    print(json.dumps(result,ensure_ascii=False,indent=2))
    print('\n', 'Se aplicaron los cambios a PostgreSQL TEST.' if args.apply else 'Solo vista previa: ningún dato fue modificado.')

if __name__=='__main__':main()
