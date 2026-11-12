
import { Link } from 'react-router-dom';
import './dashboard.css';

const indicadores = [
  {
    titulo: 'Ventas del día',
    valor: 'S/ 840.50',
    detalle: '▲ +12.4% vs. ayer',
    icono: '▦',
    estado: 'positivo',
  },
  {
    titulo: 'Unidades vendidas',
    valor: '142 uds',
    detalle: '▲ +18 uds',
    icono: '▣',
    estado: 'neutro',
  },
  {
    titulo: 'En riesgo',
    valor: '8 SKUs',
    detalle: '✕ Stock crítico',
    icono: '⚠',
    estado: 'peligro',
  },
  {
    titulo: 'Cobertura promedio',
    valor: '14 días',
    detalle: '✓ Estable',
    icono: '▤',
    estado: 'positivo',
  },
];

const productos = [
  { nombre: 'Arroz Costeño 1kg', ventas: 48, estado: 'Óptimo', tipo: 'positivo' },
  { nombre: 'Leche Gloria Azul 400g', ventas: 42, estado: 'Bajo', tipo: 'advertencia' },
  { nombre: 'Inca Kola 1.5L', ventas: 36, estado: 'Normal', tipo: 'positivo' },
  { nombre: 'Aceite Primor 1L', ventas: 28, estado: 'Normal', tipo: 'positivo' },
  { nombre: 'Fideos Don Vittorio', ventas: 24, estado: 'Crítico', tipo: 'peligro' },
];

const horas = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];

const reales = [80, 250, 560, 840];
const estimados = [80, 220, 510, 790, 840, 900, 960, 1020];

const x = (indice: number) => 55 + indice * 76;
const y = (valor: number) => 225 - (valor / 1200) * 190;

const puntos = (valores: number[], inicio = 0) =>
  valores
    .map((valor, i) => `${x(i + inicio)},${y(valor)}`)
    .join(' ');

function GraficoVentas() {
  return (
    <div className="diza-chart-card">
      <div className="diza-chart-header">
        <h3>Ventas vs. predicciones — Hoy, por hora</h3>
        <div className="diza-legend">
          <span><i className="diza-real" /> Ventas</span>
          <span><i className="diza-estimado" /> Estimado</span>
        </div>
      </div>

      <div className="diza-chart-container">
        <svg
          viewBox="0 0 640 280"
          role="img"
          aria-label="Gráfico demostrativo de ventas y estimación de demanda por hora"
        >
          {[0, 200, 400, 600, 800, 1000, 1200].map((valor) => (
            <g key={valor}>
              <line
                x1="55"
                y1={y(valor)}
                x2="600"
                y2={y(valor)}
                stroke="#e4e9f2"
              />
              <text x="47" y={y(valor) + 4} textAnchor="end" fontSize="11" fill="#66738d">
                {valor === 0 ? 'S/ 0' : `S/ ${valor}`}
              </text>
            </g>
          ))}

          {horas.map((hora, i) => (
            <text
              key={hora}
              x={x(i)}
              y="254"
              textAnchor="middle"
              fontSize="11"
              fill="#66738d"
            >
              {hora}
            </text>
          ))}

          <line
            x1={x(3)}
            x2={x(3)}
            y1={y(840)}
            y2="225"
            stroke="#294c9c"
            strokeDasharray="3 4"
          />

          <polyline
            fill="none"
            stroke="#8da0c3"
            strokeWidth="2"
            strokeDasharray="5 5"
            strokeLinejoin="round"
            points={puntos(estimados)}
          />

          <polyline
            fill="none"
            stroke="#244695"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={puntos(reales)}
          />

          {reales.map((valor, i) => (
            <circle
              key={i}
              cx={x(i)}
              cy={y(valor)}
              r="5"
              fill="#fff"
              stroke="#244695"
              strokeWidth="3"
            />
          ))}

          <rect
            x={x(3) - 78}
            y={y(840) - 37}
            width="156"
            height="25"
            rx="5"
            fill="#101a32"
          />
          <text
            x={x(3)}
            y={y(840) - 20}
            textAnchor="middle"
            fontSize="10"
            fill="#fff"
            fontWeight="bold"
          >
            Ventas de ejemplo: S/ 840.50
          </text>
        </svg>
      </div>

      <div className="diza-chart-footer">
        <span>↗ Crecimiento estimado en bebidas y abarrotes.</span>
        <strong>Meta estimada: S/ 1,020.00</strong>
      </div>
    </div>
  );
}

function RankingProductos() {
  return (
    <section className="diza-ranking">
      <div className="diza-ranking-header">
        <h3>Ranking de productos</h3>
        <span>Top 5 del día</span>
      </div>

      <div className="diza-ranking-list">
        {productos.map((producto, i) => (
          <div className="diza-ranking-item" key={producto.nombre}>
            <span className="diza-ranking-number">{i + 1}</span>

            <div className="diza-ranking-info">
              <strong title={producto.nombre}>{producto.nombre}</strong>
              <small>{producto.ventas} uds vendidas</small>
              <div className="diza-ranking-track">
                <div style={{ width: `${producto.ventas / 48 * 100}%` }} />
              </div>
            </div>

            <span className={`diza-chip diza-${producto.tipo}`}>
              {producto.estado}
            </span>
          </div>
        ))}
      </div>

      <Link to="/inventario" className="diza-ranking-link">
        Ver inventario completo <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

export const DashboardPage = () => {
  return (
    <div className="diza-dashboard">
      <div className="diza-dashboard-heading">
        <div>
          <p className="diza-location">BODEGA DIZA · VILLA EL SALVADOR</p>
          <h1>Dashboard</h1>
          <p>Resumen de la operación de tu bodega</p>
        </div>
        <span className="diza-demo">● Datos de demostración</span>
      </div>

      <section className="diza-indicators" aria-label="Resumen de indicadores">
        {indicadores.map((item) => (
          <article
            key={item.titulo}
            className={`diza-kpi ${item.estado === 'peligro' ? 'diza-kpi-risk' : ''}`}
          >
            <span className="diza-kpi-icon" aria-hidden="true">{item.icono}</span>
            <div className="diza-kpi-info">
              <span className="diza-kpi-title">{item.titulo}</span>
              <strong className="diza-kpi-value">{item.valor}</strong>
              <span className={`diza-chip diza-${item.estado}`}>
                {item.detalle}
              </span>
            </div>
          </article>
        ))}
      </section>

      <h2 className="diza-section-title">¿Qué se está vendiendo?</h2>

      <div className="diza-analytics">
        <GraficoVentas />
        <RankingProductos />
      </div>

      <p className="diza-disclaimer">
        Las cifras y predicciones mostradas son ejemplos de diseño.
        Se reemplazarán al conectar los servicios reales del sistema.
      </p>
    </div>
  );
};

export default DashboardPage;
