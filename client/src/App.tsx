import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Schedule from './pages/Schedule';
import Appointments from './pages/Appointments';
import Settings from './pages/Settings';
import PublicBooking from './pages/PublicBooking';
import Clients from './pages/Clients';
import Professionals from './pages/Professionals';
import AgendaWeek from './pages/AgendaWeek';
import Reports from './pages/Reports';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Register />} />
      <Route path="/agendar/:slug" element={<PublicBooking />} />

      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="agenda" element={<AgendaWeek />} />
        <Route path="agendamentos" element={<Appointments />} />
        <Route path="clientes" element={<Clients />} />
        <Route path="profissionais" element={<Professionals />} />
        <Route path="relatorios" element={<Reports />} />
        <Route path="servicos" element={<Services />} />
        <Route path="horarios" element={<Schedule />} />
        <Route path="configuracoes" element={<Settings />} />
      </Route>
    </Routes>
  );
}
