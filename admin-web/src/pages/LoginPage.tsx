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
        background:
          'radial-gradient(circle at 20% 20%, rgba(176,141,87,0.12), transparent 45%), var(--alilu-brand-primary)',
        padding: 16,
      }}
    >
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="card"
        style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: 'var(--shadow-md)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            aria-hidden
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: 'var(--alilu-brand-accent)',
              color: 'var(--alilu-neutral-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div>
            <h1 style={{ fontSize: 22, margin: 0 }}>ALILU</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
              Painel administrativo — CondominiumAdmin/SuperAdmin
            </p>
          </div>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500 }}>
          E-mail
          <input
            type="email"
            required
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 500 }}>
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
          <div className="error-banner" role="alert" style={{ marginBottom: 0 }}>
            {error}
          </div>
        )}

        <button type="submit" className="btn" disabled={isSubmitting} style={{ padding: '11px 16px' }}>
          {isSubmitting && <span className="spinner" aria-hidden />}
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
