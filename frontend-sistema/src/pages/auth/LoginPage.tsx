import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await login({ email, password });
      navigate('/');
    } catch {
      setError('Correo o contraseña inválidos.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Iniciar Sesión</h2>
      <p>Ingresa tus credenciales para acceder al sistema.</p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <div className="form-group">
        <label htmlFor="login-email">Correo Electrónico</label>
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="login-password">Contraseña</label>
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-input"
        />
      </div>

        <button type="submit" className="btn-primary btn-block" disabled={isLoading}>
          {isLoading ? 'Ingresando...' : 'Entrar al Sistema'}
      </button>
    </form>
  );
};

export default LoginPage;
