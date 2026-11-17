import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';
import { Button, FormField, PageHeader } from '../../components/ui';
import type { ApiResponse } from '../../types';
import '../demo/demo.css';
import '../../components/period/period-controls.css';
import './product-create.css';

type Category = { id:number; nombre:string; activa:boolean };
type Supplier = { id:number; nombre:string; activo:boolean };
type Product = { id:number; sku:string; nombre:string };
const UNITS = ['UNIDAD','BOTELLA','CAJA','PACK','LITRO','BOLSA','LATA','KILOGRAMO'] as const;
type Unit = typeof UNITS[number];
function unwrap<T>(r:ApiResponse<T>):T {
  if(!r.success || r.data===null) throw Error(r.message||'Error del servidor');
  return r.data;
}
const toNumber=(s:string)=>Number(s);
export const ProductCreatePage=()=>{
  const navigate=useNavigate();
  const [categories,setCategories]=useState<Category[]>([]);
  const [suppliers,setSuppliers]=useState<Supplier[]>([]);
  const [ready,setReady]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [sku,setSku]=useState('');
  const [name,setName]=useState('');
  const [description,setDescription]=useState('');
  const [categoryId,setCategoryId]=useState('');
  const [supplierId,setSupplierId]=useState('');
  const [salePrice,setSalePrice]=useState('');
  const [minStock,setMinStock]=useState('');
  const [unit,setUnit]=useState<Unit>('UNIDAD');
  const [withLot,setWithLot]=useState(false);
  const [lotCode,setLotCode]=useState('');
  const [lotAmount,setLotAmount]=useState('');
  const [expiry,setExpiry]=useState('');

  const checkTest=async()=>{
    if((apiClient.defaults.baseURL||'').replace(/\/$/,'')!=='http://localhost:8081') throw Error('Este formulario está habilitado solo para la API TEST en localhost:8081.');
    const r=await apiClient.get<ApiResponse<unknown>>('/test-data/resumen');
    if(!r.data.success) throw Error('La base TEST no está habilitada');
  };
  useEffect(()=>{
    let active=true;
    void (async()=>{
      try{
        await checkTest();
        const [cat,sup]=await Promise.all([
          apiClient.get<ApiResponse<Category[]>>('/categorias'),
          apiClient.get<ApiResponse<Supplier[]>>('/proveedores'),
        ]);
        if(!active)return;
        setCategories(unwrap(cat.data).filter(x=>x.activa));
        setSuppliers(unwrap(sup.data).filter(x=>x.activo));
        setReady(true);
      }catch(e){if(active)setError(e instanceof Error?e.message:'Error al cargar datos');}
    })();
    return()=>{active=false;};
  },[]);

  const save=async(e:FormEvent)=>{
    e.preventDefault();
    if(saving)return;
    setError('');setSaving(true);
    try{
      if(!sku.trim()||!name.trim()) throw Error('Completa el SKU y el nombre del producto.');
      if(!categoryId||!supplierId) throw Error('Selecciona categoría y proveedor.');
      if(!Number.isFinite(toNumber(salePrice))||toNumber(salePrice)<0||!Number.isFinite(toNumber(minStock))||toNumber(minStock)<0) throw Error('Precio y stock mínimo deben ser números válidos.');
      if(withLot){
        if(!lotCode.trim()||toNumber(lotAmount)<=0||!expiry) throw Error('Completa código, cantidad positiva y vencimiento del lote.');
        const d = new Date(`${expiry}T00:00:00`); const today = new Date();today.setHours(0,0,0,0);
        if(d<=today) throw Error('La fecha de vencimiento debe ser futura.');
      }
      await checkTest();
      const response=await apiClient.post<ApiResponse<Product>>('/productos',{
        sku:sku.trim().toUpperCase(), nombre:name.trim(), descripcion:description.trim(),
        categoriaId:Number(categoryId),proveedorId:Number(supplierId),precioVenta:toNumber(salePrice),
        stockMinimo:toNumber(minStock),unidadMedida:unit,
        loteInicial:withLot?{codigoLote:lotCode.trim(),cantidad:toNumber(lotAmount),fechaVencimiento:expiry}:null,
      });
      unwrap(response.data);
      navigate('/inventario', {replace:true});
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar producto');}
    finally{setSaving(false);}
  };

  return <main className="diza-test-page">
    <PageHeader eyebrow="INVENTARIO · BASE TEST" title="Agregar producto"
      description="Registra productos vinculados a categorías y proveedores de PostgreSQL."
      actions={<Link className="diza-test-link" to="/inventario">← Volver al inventario</Link>} />
    <p className="diza-test-note">El registro se guarda realmente en la base bodega_diza_test. No crea proveedores ficticios ni altera ventas históricas.</p>
    {error && <p className="diza-test-error" role="alert">{error}</p>}
    {!ready ? (
      !error && <p className="diza-test-muted" role="status">Verificando conexión a la base TEST y cargando listas...</p>
    ) : <form className="diza-create-form" onSubmit={e=>{void save(e);}}>
      <section className="diza-test-panel" aria-labelledby="create-product-general">
        <h2 id="create-product-general">Información del producto</h2>
        <p className="diza-kpi-note">Identifica el producto y define su precio y stock mínimo.</p>
        <div className="diza-create-grid">
          <FormField controlId="create-sku" label="Código SKU" required>
            <input id="create-sku" required maxLength={50} value={sku} onChange={e=>setSku(e.target.value)} placeholder="Ej. P021" autoComplete="off" />
          </FormField>
          <FormField controlId="create-name" label="Nombre del producto" required>
            <input id="create-name" required maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre del producto" />
          </FormField>
          <FormField controlId="create-category" label="Categoría" required>
            <select id="create-category" required value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
              <option value="">Selecciona categoría</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </FormField>
          <FormField controlId="create-supplier" label="Proveedor" required>
            <select id="create-supplier" required value={supplierId} onChange={e=>setSupplierId(e.target.value)}>
              <option value="">Selecciona proveedor</option>
              {suppliers.map(provider=><option key={provider.id} value={provider.id}>{provider.nombre}</option>)}
            </select>
          </FormField>
          <FormField controlId="create-price" label="Precio de venta (S/)" required>
            <input id="create-price" required type="number" min="0" step="0.01" inputMode="decimal"
              value={salePrice} onChange={e=>setSalePrice(e.target.value)} />
          </FormField>
          <FormField controlId="create-minimum" label="Stock mínimo" required>
            <input id="create-minimum" required type="number" min="0" step="0.001" inputMode="decimal"
              value={minStock} onChange={e=>setMinStock(e.target.value)} />
          </FormField>
          <FormField controlId="create-unit" label="Unidad de medida" required>
            <select id="create-unit" value={unit} onChange={e=>setUnit(e.target.value as Unit)}>
              {UNITS.map(value=><option key={value} value={value}>{value}</option>)}
            </select>
          </FormField>
          <FormField controlId="create-description" label="Descripción" className="diza-create-wide"
            hint="Opcional, hasta 500 caracteres.">
            <textarea id="create-description" rows={3} maxLength={500} value={description}
              onChange={e=>setDescription(e.target.value)} />
          </FormField>
        </div>
      </section>
      <section className="diza-test-panel" aria-labelledby="create-product-stock">
        <h2 id="create-product-stock">Stock inicial</h2>
        <label className="diza-create-check" htmlFor="create-with-lot">
          <input id="create-with-lot" type="checkbox" checked={withLot} onChange={e=>setWithLot(e.target.checked)} />
          Registrar stock inicial con lote (opcional)
        </label>
        {withLot && <div className="diza-create-grid">
          <FormField controlId="create-lot-code" label="Código de lote" required>
            <input id="create-lot-code" required value={lotCode} onChange={e=>setLotCode(e.target.value)} />
          </FormField>
          <FormField controlId="create-lot-amount" label="Cantidad inicial" required>
            <input id="create-lot-amount" required type="number" min="0.001" step="0.001" inputMode="decimal"
              value={lotAmount} onChange={e=>setLotAmount(e.target.value)} />
          </FormField>
          <FormField controlId="create-lot-expiry" label="Fecha de vencimiento" required>
            <input id="create-lot-expiry" required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)} />
          </FormField>
        </div>}
        <p className="diza-kpi-note">Si no registras un lote, el producto se creará con stock 0. Identifica los lotes ficticios como DEMO.</p>
      </section>
      <div className="diza-create-actions">
        <Link to="/inventario" className="diza-period-link">Cancelar</Link>
        <Button type="submit" loading={saving} disabled={!ready || categories.length===0 || suppliers.length===0}>
          {saving ? 'Guardando...' : 'Guardar producto en TEST'}
        </Button>
      </div>
      {(!categories.length || !suppliers.length) && <p className="diza-test-error" role="alert">
        Necesitas al menos una categoría activa y un proveedor activo antes de registrar productos.
      </p>}
    </form>}
  </main>;
};
export default ProductCreatePage;
