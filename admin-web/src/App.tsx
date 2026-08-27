import { Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './modules/auth/AuthProvider';
import { CondominiumScopeProvider } from './modules/condominium/CondominiumScopeContext';
import { CondominiosPage } from './pages/CondominiosPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MoradoresPage } from './pages/MoradoresPage';
import { MuralPage } from './pages/MuralPage';
import { ProfissionaisPage } from './pages/ProfissionaisPage';
import { RecomendacoesPage } from './pages/RecomendacoesPage';
import { UnidadesPage } from './pages/UnidadesPage';

/**
 * Raiz do admin-web (PROMPT 12 — "criar um painel web administrativo
 * separado"). `AuthProvider` cuida da sessão; `CondominiumScopeProvider`
 * (só monta DENTRO de uma rota protegida, já autenticado) resolve qual
 * condomínio está sendo administrado — ver comentário de design lá.
 */
function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <CondominiumScopeProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/condominios" element={<CondominiosPage />} />
                    <Route path="/moradores" element={<MoradoresPage />} />
                    <Route path="/unidades" element={<UnidadesPage />} />
                    <Route path="/profissionais" element={<ProfissionaisPage />} />
                    <Route path="/recomendacoes" element={<RecomendacoesPage />} />
                    <Route path="/mural" element={<MuralPage />} />
                  </Routes>
                </Layout>
              </CondominiumScopeProvider>
            </ProtectedRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
