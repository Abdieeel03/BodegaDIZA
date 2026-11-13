import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { productosOperativos, ventasOperativas, type ProductoOperativo, type VentaOperativa } from '../../services/testDataService';
import { stockMovements, type StockMovement } from '../../services/periodReportService';
import { PeriodControls, dateInRange, formatMoney, formatNumber, getPeriodRange, todayLocal, type PeriodMode } from '../../components/period/PeriodControls';

/** Indicadores operativos reales. Se agregan sin reemplazar el Dashboard existente. */
export const OperationalOverview=()=>{
  const [period,setPeriod]=useState<PeriodMode>('mes');
  const [anchor,setAnchor]=useState(todayLocal());
  const [sales,setSales]=useState<VentaOperativa[]>([]);
  const [products,setProducts]=useState<ProductoOperativo[]>([]);
  const [moves,setMoves]=useState<StockMovement[]>([]);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    setLoading(true);
    void Promise.all([ventasOperativas(),productosOperativos(),stockMovements()]).then(([v,p,m])=>{
      if(active){setSales(v);setProducts(p);setMoves(m);setError('');}
    }).catch(e=>{if(active)setError(e instanceof Error?e.message:'No se pudieron consultar indicadores');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[refresh]);
  const range=useMemo(()=>getPeriodRange(period,anchor),[period,anchor]);
  const salesInRange=sales.filter(s=>dateInRange(s.fecha,range));
  const movesInRange=moves.filter(m=>dateInRange(m.fecha,range));
  const salesTotal=salesInRange.reduce((v,s)=>v+Number(s.total),0);
  const lowStock=products.filter(p=>p.activo&&p.stockTotal<=0).length;
  const incomeCount=movesInRange.filter(m=>m.tipo==='ENTRADA').reduce((v,m)=>v+Number(m.cantidad),0);
  const outCount=movesInRange.filter(m=>m.tipo==='SALIDA').reduce((v,m)=>v+Number(m.cantidad),0);
  return <section className="diza-live-summary" style={{marginBottom:22,padding:20,border:'1px solid #c8dafa',borderRadius:16,background:'#f7faff'}} aria-label="Resumen operativo real por período">
    <div style={{display:'flex',justifyContent:'space-between',gap:10,alignItems:'center',flexWrap:'wrap'}}><div><strong style={{color:'#17489d',fontSize:18}}>Resumen operativo</strong><p style={{fontSize:12,color:'#69778b',margin:'6px 0 0'}}>Indicadores del inventario y las ventas actuales; no incluyen CSV históricos.</p></div><button onClick={()=>setRefresh(n=>n+1)} className="diza-period-link" type="button">Actualizar</button></div>
    <PeriodControls mode={period} setMode={setPeriod} anchor={anchor} setAnchor={setAnchor}/>
    {error&&<p style={{color:'#b5223a'}} role="alert">{error}</p>}
    {loading?<p>Consultando la API...</p>:<div className="diza-stat-grid">
      <div className="diza-stat"><span>Tickets en el período</span><strong>{salesInRange.length}</strong></div>
      <div className="diza-stat"><span>Ventas operativas</span><strong>{formatMoney(salesTotal)}</strong></div>
      <div className="diza-stat"><span>Entradas en el período</span><strong>{formatNumber(incomeCount)}</strong></div>
      <div className="diza-stat"><span>Salidas en el período</span><strong>{formatNumber(outCount)}</strong></div>
    </div>}
    <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}><span style={{fontSize:12,color:'#516786'}}>Productos en catálogo: <b>{products.length}</b> · Sin stock actual: <b>{lowStock}</b></span><Link className="diza-period-link" to="/ventas">Ver ventas →</Link><Link className="diza-period-link" to="/inventario/movimientos">Movimientos de inventario →</Link></div>
    <p style={{fontSize:11,color:'#75839b',margin:'12px 0 0'}}>El stock es una fotografía del momento; los filtros afectan solo ventas y movimientos. Las predicciones se consultan por separado al servicio ML.</p>
  </section>;
};
export default OperationalOverview;
