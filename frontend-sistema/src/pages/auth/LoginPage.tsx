import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../types';
import { Button, FormField } from '../../components/ui';

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
    } catch (error: unknown) {
      setError(error instanceof ApiError ? error.message : 'No fue posible iniciar sesión.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Iniciar Sesión</h2>
      <p>Ingresa tus credenciales para acceder al sistema.</p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <FormField controlId="login-email" label="Correo electrónico" required className="form-group">
        <input
          id="login-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-input"
        />
      </FormField>

      <FormField controlId="login-password" label="Contraseña" required className="form-group">
        <input
          id="login-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-input"
        />
      </FormField>

      <Button type="submit" block loading={isLoading}>
        {isLoading ? 'Ingresando...' : 'Entrar al sistema'}
      </Button>
    </form>
  );
};

export default LoginPage;
