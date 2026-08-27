import type { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { useAuth } from '../modules/auth/AuthProvider';
import { CondominiumPicker } from './CondominiumPicker';

/**
 * Ícones minimalistas (stroke, 16x16, `currentColor`) — só para dar um
 * ponto de referência visual rápido a cada item da sidebar. Inline SVG em
 * vez de uma biblioteca de ícones: zero dependência nova só para 5
 * glifos simples.
 */
const ICONS: Record<string, ReactNode> = {
  dashboard: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="1.5" width="6" height="6" rx="1.5" />
      <rect x="8.5" y="1.5" width="6" height="4" rx="1.5" />
      <rect x="8.5" y="7.5" width="6" height="7" rx="1.5" />
      <rect x="1.5" y="9.5" width="6" height="5" rx="1.5" />
    </svg>
  ),
  moradores: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="2.75" />
      <path d="M2.5 14c0-2.76 2.46-5 5.5-5s5.5 2.24 5.5 5" strokeLinecap="round" />
    </svg>
  ),
  unidades: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14V6.5L8 2l6 4.5V14" strokeLinejoin="round" />
      <path d="M6 14v-4h4v4" strokeLinejoin="round" />
    </svg>
  ),
  profissionais: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1.5" y="5" width="13" height="8.5" rx="1.5" />
      <path d="M5.5 5V3.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V5" />
    </svg>
  ),
  recomendacoes: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <path d="M8 1.5l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.3l-3.8 2 .7-4.3-3.1-3 4.3-.6L8 1.5z" />
    </svg>
  ),
  condominios: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
      <rect x="2" y="3.5" width="7" height="11" rx="1" />
      <rect x="9.5" y="6.5" width="4.5" height="8" rx="1" />
      <path d="M4 6.5h1M4 9h1M4 11.5h1" strokeLinecap="round" />
    </svg>
  ),
};

/** `adminOnly: true` só aparece para SuperAdmin (ver filtro em `Layout`) — hoje só "Condomínios" (criação é SuperAdmin-only, ver `CondominiosPage`). */
const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true, icon: 'dashboard' },
  { to: '/condominios', label: 'Condomínios', icon: 'condominios', adminOnly: true },
  { to: '/moradores', label: 'Moradores', icon: 'moradores' },
  { to: '/unidades', label: 'Unidades', icon: 'unidades' },
  { to: '/profissionais', label: 'Profissionais', icon: 'profissionais' },
  { to: '/recomendacoes', label: 'Recomendações', icon: 'recomendacoes' },
];

/** Iniciais do nome pro avatar do header (ex.: "Rodrigo Soares Leite" → "RS"). */
function initials(name: string | undefined): string {
  if (!name) {
    return '?';
  }

  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Casca comum de toda tela autenticada: barra lateral de navegação, seletor de condomínio e cabeçalho com o usuário logado. */
export function Layout({ children }: PropsWithChildren) {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: 'var(--alilu-brand-primary)',
          color: 'var(--text-on-brand)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--alilu-brand-accent)',
              color: 'var(--alilu-neutral-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 15,
              flexShrink: 0,
            }}
          >
            A
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '0.01em', lineHeight: 1.2 }}>ALILU</div>
            <div style={{ fontSize: 11, opacity: 0.65 }}>Painel administrativo</div>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === 'SuperAdmin').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}
            >
              <span style={{ opacity: 0.85, display: 'flex' }}>{ICONS[item.icon]}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 28px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <CondominiumPicker />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.role}</div>
            </div>
            <div
              aria-hidden
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'var(--alilu-brand-primary)',
                color: 'var(--text-on-brand)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initials(user?.name)}
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </header>

        <main style={{ flex: 1, padding: 28 }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
