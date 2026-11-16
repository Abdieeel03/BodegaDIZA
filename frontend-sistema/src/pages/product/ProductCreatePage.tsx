import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/axios';
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
    <header className="diza-test-heading"><div><span className="diza-test-eyebrow">INVENTARIO · BASE TEST</span><h1>Agregar producto</h1><p>Registro individual de productos, vinculado a categorías y proveedores de PostgreSQL.</p></div><Link className="diza-test-link" to="/inventario">← Volver al inventario</Link></header>
    <p className="diza-test-note">El registro se guarda realmente en la base bodega_diza_test. No crea proveedores ficticios automáticamente ni altera ventas históricas.</p>
    {error&&<p className="diza-test-error" role="alert">{error}</p>}
    {!ready?<p className="diza-test-muted">Verificando conexión a la base TEST y cargando listas...</p>:<form className="diza-create-form" onSubmit={e=>{void save(e);}}>
      <section className="diza-test-panel"><h2>Información del producto</h2>
        <div className="diza-create-grid">
          <label>SKU *<input required maxLength={50} value={sku} onChange={e=>setSku(e.target.value)} placeholder="P021" /></label>
          <label>Nombre *<input required maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder="Nuevo producto" /></label>
          <label>Categoría *<select required value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Selecciona categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></label>
          <label>Proveedor *<select required value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Selecciona proveedor</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>
          <label>Precio de venta (S/) *<input required type="number" min="0" step="0.01" value={salePrice} onChange={e=>setSalePrice(e.target.value)}/></label>
          <label>Stock mínimo *<input required type="number" min="0" step="0.001" value={minStock} onChange={e=>setMinStock(e.target.value)}/></label>
          <label>Unidad de medida *<select value={unit} onChange={e=>setUnit(e.target.value as Unit)}>{UNITS.map(u=><option key={u} value={u}>{u}</option>)}</select></label>
          <label className="diza-create-wide">Descripción<textarea rows={3} maxLength={500} value={description} onChange={e=>setDescription(e.target.value)}/></label>
        </div>
      </section>
      <section className="diza-test-panel"><label className="diza-create-check"><input type="checkbox" checked={withLot} onChange={e=>setWithLot(e.target.checked)}/> Registrar stock inicial con lote (opcional)</label>
        {withLot&&<div className="diza-create-grid"><label>Código del lote *<input required value={lotCode} onChange={e=>setLotCode(e.target.value)}/></label><label>Cantidad *<input required type="number" min="0.001" step="0.001" value={lotAmount} onChange={e=>setLotAmount(e.target.value)}/></label><label>Vencimiento futuro *<input required type="date" value={expiry} onChange={e=>setExpiry(e.target.value)}/></label></div>}
        <p className="diza-kpi-note">Si no registras lote, el producto se crea con stock 0. Para fines de prueba, identifica claramente cualquier lote ficticio como DEMO.</p>
      </section>
      <div className="diza-create-actions"><Link to="/inventario" className="diza-period-link">Cancelar</Link><button className="btn-primary" disabled={!ready||saving||categories.length===0||suppliers.length===0} type="submit">{saving?'Guardando...':'Guardar producto en TEST'}</button></div>
      {(!categories.length||!suppliers.length)&&<p className="diza-test-error">Necesitas al menos una categoría activa y un proveedor activo. Puedes crearlos mediante Carga Masiva.</p>}
    </form>}
  </main>;
};
export default ProductCreatePage;
