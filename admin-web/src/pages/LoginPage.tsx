import { isAxiosError } from 'axios';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';

import { NotAnAdminError, useAuth } from '../modules/auth/AuthProvider';

/** Tela de login do admin-web. Reaproveita `POST /api/auth/login` — o mesmo endpoint do app mobile — não existe um login "separado" para administradores no backend. */
export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
    } catch (err) {
      if (err instanceof NotAnAdminError) {
        setError(err.message);
      } else if (isAxiosError(err) && err.response?.status === 401) {
        setError('E-mail ou senha inválidos.');
      } else if (isAxiosError(err) && err.response?.status === 403) {
        setError('Este usuário está bloqueado.');
      } else {
        setError('Não foi possível entrar. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--alilu-brand-primary)',
      }}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="card"
        style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div>
          <h1 style={{ fontSize: 24 }}>ALILU</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
            Painel administrativo — CondominiumAdmin/SuperAdmin
          </p>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          E-mail
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
          Senha
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && (
          <p style={{ color: 'var(--alilu-error)', fontSize: 14, margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
