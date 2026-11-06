import { useState } from 'react';
import apiClient, { getAuthToken, setAuthToken } from '../../api/axios';
import { useAuth } from '../../hooks/useAuth';

export const ApiStatusPage = () => {
  const { token, login, logout } = useAuth();
  const [tokenInput, setTokenInput] = useState(token || getAuthToken() || '');
  const [requestLog, setRequestLog] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleUpdateToken = () => {
    setAuthToken(tokenInput || null);
    if (tokenInput) {
      login(tokenInput, {
        id: 99,
        nombre: 'Usuario Actualizado',
        email: 'admin@bodegadiza.com',
        rol: 'ADMIN',
      });
    } else {
      logout();
    }
  };

  const handleTestRequest = async () => {
    setLoading(true);
    setRequestLog('Enviando solicitud con Axios...');
    try {
      // Petición de prueba: el interceptor inyectará el JWT en Authorization: Bearer <token>
      const response = await apiClient.get('/test-auth-interceptor', {
        // En caso de que no haya backend corriendo en este puerto, se captura el error pero se ve la cabecera
        validateStatus: () => true,
      });
      setRequestLog(
        JSON.stringify(
          {
            status: response.status,
            statusText: response.statusText,
            urlSolicitada: response.config.url,
            headersEnviados: {
              Authorization: response.config.headers.Authorization || '(Sin cabecera Authorization)',
              'Content-Type': response.config.headers['Content-Type'],
            },
          },
          null,
          2
        )
      );
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setRequestLog(
        JSON.stringify(
          {
            resultado: 'Petición interceptada correctamente',
            tokenUtilizadoEnHeader: `Bearer ${getAuthToken() || 'ninguno'}`,
            nota: 'Si no hay backend activo en localhost:8000, es normal recibir error de conexión de red.',
            detalleError: errorMsg,
          },
          null,
          2
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>⚡ Conexión Axios & Middleware JWT</h1>
        <p>Prueba en vivo del interceptor y de la variable de token JWT.</p>
      </div>

      <div className="card">
        <h3>1. Variable de JWT Actual</h3>
        <p>
          El middleware intercepta cada petición saliente y adjunta automáticamente el header:{' '}
          <code>Authorization: Bearer [JWT]</code>.
        </p>

        <div className="form-group">
          <label htmlFor="jwt-input">
            <strong>Valor de la variable JWT:</strong>
          </label>
          <div className="flex-row">
            <input
              id="jwt-input"
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Escribe un token JWT..."
              className="text-input"
            />
            <button type="button" onClick={handleUpdateToken} className="btn-primary">
              Actualizar Token
            </button>
          </div>
        </div>

        <div className="token-preview">
          <span>Token activo actual:</span>
          <code>{getAuthToken() || '(Ninguno - Sin autenticar)'}</code>
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3>2. Probar Interceptor de Axios</h3>
        <p>
          Haz clic en el botón para ejecutar una petición con Axios y verificar en la consola o abajo
          cómo el interceptor añade el header de autorización.
        </p>

        <button
          type="button"
          onClick={handleTestRequest}
          disabled={loading}
          className="btn-secondary"
        >
          {loading ? 'Consultando...' : '🚀 Ejecutar Petición de Prueba con Axios'}
        </button>

        {requestLog && (
          <div className="log-output" style={{ marginTop: '1rem' }}>
            <strong>Resultado / Inspección de la Petición:</strong>
            <pre>{requestLog}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApiStatusPage;
