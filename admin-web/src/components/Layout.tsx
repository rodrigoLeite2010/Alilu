import type { PropsWithChildren } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../modules/auth/AuthProvider';
import { CondominiumPicker } from './CondominiumPicker';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/moradores', label: 'Moradores' },
  { to: '/unidades', label: 'Unidades' },
  { to: '/profissionais', label: 'Profissionais' },
  { to: '/recomendacoes', label: 'Recomendações' },
];

/** Casca comum de toda tela autenticada: barra lateral de navegação, seletor de condomínio e cabeçalho com o usuário logado. */
export function Layout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: 'var(--alilu-brand-primary)',
          color: 'var(--text-inverse)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' }}>ALILU</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Painel administrativo</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                padding: '8px 10px',
                borderRadius: 6,
                textDecoration: 'none',
                color: 'var(--text-inverse)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                fontWeight: isActive ? 600 : 400,
                fontSize: 14,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
          }}
        >
          <CondominiumPicker />

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.role}</div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: 24 }}>{children}</main>
      </div>
    </div>
  );
}
