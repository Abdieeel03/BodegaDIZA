import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@bodegadiza.com');
  const [password, setPassword] = useState('123456');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Simulación de login exitoso recibiendo token JWT
    const simulatedJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${btoa(
      JSON.stringify({ sub: email, iat: Date.now() })
    )}.simulatedSignature`;

    login(simulatedJwt, {
      id: 1,
      nombre: 'Administrador Diza',
      email,
      rol: 'ADMIN',
    });

    navigate('/');
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Iniciar Sesión</h2>
      <p>Ingresa tus credenciales para acceder al sistema.</p>

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

      <button type="submit" className="btn-primary btn-block">
        Entrar al Sistema
      </button>
    </form>
  );
};

export default LoginPage;
