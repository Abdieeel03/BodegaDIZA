import type { ClassificationSummary } from '../../types';

type Bin = { from: number; to: number; n: number; meanProbability: number; observedRate: number };
type Candidate = { n: number; metrics: { f1: number; accuracy: number; rocAuc: number | null; brierScore?: number } };
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const names: Record<string, string> = { logistic_regression: 'Regresión logística', decision_tree: 'Árbol de decisión', random_forest: 'Random Forest', hist_gradient_boosting: 'HistGradientBoosting' };

export function ClassificationDiagnostics({ classification }: { classification: ClassificationSummary }) {
  // El contrato Java conserva el mapa de clasificación completo. No se completan datos ausentes.
  const data = classification as ClassificationSummary & { candidates?: Record<string, Candidate> };
  const metrics = data.metrics as ClassificationSummary['metrics'] & { reliabilityBins?: Bin[] };
  const matrix = metrics.confusionMatrix;
  const bins = (metrics.reliabilityBins ?? []).filter(b => b.n > 0 && [b.meanProbability, b.observedRate, b.from, b.to].every(v => Number.isFinite(v) && v >= 0 && v <= 1)).sort((a,b) => a.from - b.from);
  const candidates = Object.entries(data.candidates ?? {}).filter(([,v]) => v.metrics && Number.isFinite(v.metrics.f1)).sort((a,b) => b[1].metrics.f1 - a[1].metrics.f1);
  const x = (v: number) => 54 + v * 260;
  const y = (v: number) => 280 - v * 240;
  return <>
    {data.source === 'ACADEMIC_INVENTORY_SCENARIOS' && <p className="diza-diagnostic-note">Evaluación de riesgo basada en escenarios de inventario reproducibles; no representa una calibración con agotamientos reales observados.</p>}
    <div className="diza-diagnostic-grid">
      <section className="diza-diagnostic-card">
        <h3>Matriz de confusión</h3><p>Prueba final · casos por clase real y predicha.</p>
        {matrix ? <div className="diza-diagnostic-scroll"><table className="diza-confusion"><thead><tr><th scope="col">Real / predicho</th><th scope="col">Sin riesgo</th><th scope="col">Con riesgo</th></tr></thead><tbody>
          <tr><th scope="row">Sin riesgo</th><td className="is-correct"><strong>{matrix.tn}</strong><small>Verdaderos negativos</small></td><td className="is-error"><strong>{matrix.fp}</strong><small>Falsos positivos</small></td></tr>
          <tr><th scope="row">Con riesgo</th><td className="is-error"><strong>{matrix.fn}</strong><small>Falsos negativos</small></td><td className="is-correct"><strong>{matrix.tp}</strong><small>Verdaderos positivos</small></td></tr>
        </tbody></table></div> : <p>No hay matriz disponible en este entrenamiento.</p>}
      </section>
      <section className="diza-diagnostic-card">
        <h3>Calibración de probabilidades</h3><p>Probabilidad media estimada frente a frecuencia observada en la prueba final.</p>
        {bins.length ? <><svg className="diza-calibration" viewBox="0 0 350 326" role="img" aria-label="Calibración: probabilidad estimada en eje horizontal, frecuencia observada en eje vertical">
          {[0,.25,.5,.75,1].map(v => <g key={v}><line x1={x(0)} y1={y(v)} x2={x(1)} y2={y(v)} stroke="#dce4ee"/><text x={x(0)-8} y={y(v)+4} textAnchor="end">{Math.round(v*100)}%</text><text x={x(v)} y={y(0)+17} textAnchor="middle">{Math.round(v*100)}%</text></g>)}
          <path d={`M${x(0)} ${y(1)} V${y(0)} H${x(1)}`} fill="none" stroke="#64748b"/>
          <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="#64748b" strokeDasharray="5 4"/>
          <polyline points={bins.map(b => `${x(b.meanProbability)},${y(b.observedRate)}`).join(' ')} fill="none" stroke="#315cc9" strokeWidth="2.5"/>
          {bins.map(b => <circle key={b.from} cx={x(b.meanProbability)} cy={y(b.observedRate)} r="5" fill="#315cc9"><title>{`Estimado ${pct(b.meanProbability)} · observado ${pct(b.observedRate)} · n=${b.n}`}</title></circle>)}
          <text x="184" y="319" textAnchor="middle">Probabilidad estimada</text><text transform="translate(13 160) rotate(-90)" textAnchor="middle">Frecuencia observada</text>
        </svg><p className="diza-calibration-legend">Línea azul: modelo · línea discontinua: calibración ideal</p>
        <details><summary>Consultar valores por intervalo</summary><div className="diza-diagnostic-scroll"><table className="diza-diagnostic-table"><thead><tr><th>Intervalo</th><th>Casos</th><th>Estimado</th><th>Observado</th></tr></thead><tbody>{bins.map(b => <tr key={b.from}><td>{Math.round(b.from*100)}–{Math.round(b.to*100)}%</td><td>{b.n}</td><td>{pct(b.meanProbability)}</td><td>{pct(b.observedRate)}</td></tr>)}</tbody></table></div></details></> : <p>No hay datos de calibración disponibles.</p>}
      </section>
    </div>
    {candidates.length > 0 && <section className="diza-diagnostic-card diza-candidates"><h3>Comparación de clasificadores</h3><p>Validación temporal: selección por F1, con ROC-AUC y Brier como criterios de desempate. No corresponde a la prueba final.</p><div className="diza-diagnostic-scroll"><table className="diza-diagnostic-table"><thead><tr><th>Algoritmo</th><th>F1</th><th>Exactitud</th><th>ROC-AUC</th><th>Brier</th><th>Casos</th></tr></thead><tbody>{candidates.map(([name,c]) => <tr key={name}><td>{names[name] ?? name.replaceAll('_',' ')}{name === data.modelName && <small className="diza-selected-model">Seleccionado</small>}</td><td>{pct(c.metrics.f1)}</td><td>{pct(c.metrics.accuracy)}</td><td>{c.metrics.rocAuc?.toFixed(3) ?? '—'}</td><td>{c.metrics.brierScore?.toFixed(3) ?? '—'}</td><td>{c.n}</td></tr>)}</tbody></table></div></section>}
  </>;
}
