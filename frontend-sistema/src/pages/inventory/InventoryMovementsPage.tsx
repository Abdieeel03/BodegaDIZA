import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productosOperativos, type ProductoOperativo } from '../../services/testDataService';
import { stockMovements, type StockMovement } from '../../services/periodReportService';
import { PeriodControls, dateInRange, getPeriodRange, formatNumber, todayLocal, type PeriodMode } from '../../components/period/PeriodControls';
import '../demo/demo.css';

export const InventoryMovementsPage=()=>{
  const [period,setPeriod]=useState<PeriodMode>('mes');
  const [anchor,setAnchor]=useState(todayLocal());
  const [moves,setMoves]=useState<StockMovement[]>([]);
  const [products,setProducts]=useState<ProductoOperativo[]>([]);
  const [filter,setFilter]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    void Promise.all([stockMovements(),productosOperativos()]).then(([m,p])=>{
      if(active){setMoves(m);setProducts(p);}
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Error al consultar los movimientos');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[reload]);
  const range=useMemo(()=>getPeriodRange(period,anchor),[period,anchor]);
  const visible=useMemo(()=>moves.filter(m=>dateInRange(m.fecha,range)&&(!filter||String(m.productoId)===filter))
    .sort((a,b)=>b.fecha.localeCompare(a.fecha)),[moves,range,filter]);
  const total=(type:StockMovement['tipo'])=>visible.filter(m=>m.tipo===type).reduce((a,m)=>a+Number(m.cantidad),0);
  const low=products.filter(p=>p.activo&&p.stockTotal===0).length;
  return <main className="diza-test-page">
    <header className="diza-test-heading"><div><span className="diza-test-eyebrow">INVENTARIO · MOVIMIENTOS OPERATIVOS</span><h1>Historial de inventario</h1><p>Entradas, salidas y ajustes por día, semana, mes o año.</p></div><Link className="diza-test-link" to="/inventario">← Volver a inventario</Link></header>
    <p className="diza-test-note">Este reporte muestra únicamente operaciones reales de TEST. El stock de Inventario es el actual; los movimientos se filtran por fecha sin recalcular el stock histórico del CSV.</p>
    <PeriodControls mode={period} setMode={setPeriod} anchor={anchor} setAnchor={setAnchor}/>
    <div className="diza-test-heading"><label>Producto <select className="diza-test-input" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">Todos</option>{products.map(p=><option key={p.id} value={p.id}>{p.sku} · {p.nombre}</option>)}</select></label><button className="diza-period-link" onClick={()=>setReload(x=>x+1)}>Actualizar datos</button></div>
    {error&&<p className="diza-test-error" role="alert">{error}</p>}
    <section className="diza-stat-grid">
      <div className="diza-stat"><span>Movimientos del período</span><strong>{visible.length}</strong></div>
      <div className="diza-stat"><span>Entradas (unidades)</span><strong>{formatNumber(total('ENTRADA'))}</strong></div>
      <div className="diza-stat"><span>Salidas (unidades)</span><strong>{formatNumber(total('SALIDA'))}</strong></div>
      <div className="diza-stat"><span>Productos sin stock ahora</span><strong>{low}</strong></div>
    </section>
    <section className="diza-test-panel"><h2>Registro de movimientos</h2>
      {loading?<p>Consultando movimientos...</p>:<div className="diza-test-overflow"><table className="diza-test-table"><thead><tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>Lote</th><th>Unidades</th><th>Motivo</th></tr></thead><tbody>{visible.map(m=><tr key={m.id}><td>{m.fecha.replace('T',' ')}</td><td>{m.tipo}</td><td>{m.productoSku} · {m.productoNombre}</td><td>{m.codigoLote||'—'}</td><td>{formatNumber(Number(m.cantidad))}</td><td>{m.motivo||'—'}</td></tr>)}</tbody></table></div>}
      {!loading&&!visible.length&&<p className="diza-test-muted">No hay movimientos en el período seleccionado.</p>}
    </section>
  </main>;
};
export default InventoryMovementsPage;
