import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Page from '../components/Page';
import NewAppointmentModal from '../components/NewAppointmentModal';
import toast from 'react-hot-toast';

interface Appointment {
  id: number;
  client_name: string;
  client_phone: string;
  date: string;
  start_time: string;
  end_time: string;
  service_name: string;
  service_color: string;
  service_price: number;
  status: string;
  payment_status: string;
}

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [today, setToday] = useState<Appointment[]>([]);
  const [stats, setStats] = useState({ month: 0, revenue: 0, pending: 0, week: 0 });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const td = todayStr();
      const [todayRes, allRes] = await Promise.all([
        api.get(`/appointments?date=${td}`),
        api.get(`/appointments?from=${td.slice(0, 8)}01&to=${td}`),
      ]);

      setToday(todayRes.data);

      const month = allRes.data.filter((a: Appointment) => a.status !== 'cancelled').length;
      const revenue = allRes.data
        .filter((a: Appointment) => a.payment_status === 'paid')
        .reduce((s: number, a: Appointment) => s + a.service_price, 0);
      const pending = allRes.data.filter((a: Appointment) => a.status === 'pending').length;

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekApts = allRes.data.filter((a: Appointment) => a.date >= weekStart.toISOString().split('T')[0]);

      setStats({ month, revenue, pending, week: weekApts.length });
    } catch {
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: number, status: string) {
    try {
      await api.put(`/appointments/${id}/status`, { status });
      toast.success('Status atualizado!');
      loadData();
    } catch {
      toast.error('Erro ao atualizar');
    }
  }

  const bookingUrl = `${window.location.origin}/agendar/${user?.slug}`;

  if (loading) return (
    <Page>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </Page>
  );

  return (
    <Page>
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bom dia, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-1">Aqui está o resumo do seu dia</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors flex-shrink-0"
        >
          <span className="text-base leading-none">+</span> Novo agendamento
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Hoje', value: today.length, icon: '📅', color: 'bg-blue-50 text-blue-700' },
          { label: 'Esta semana', value: stats.week, icon: '📆', color: 'bg-purple-50 text-purple-700' },
          { label: 'Este mês', value: stats.month, icon: '📊', color: 'bg-green-50 text-green-700' },
          { label: 'Pendentes', value: stats.pending, icon: '⏳', color: 'bg-yellow-50 text-yellow-700' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center text-xl mb-3`}>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700">Seu link de agendamento</p>
            <p className="text-sm text-primary-600 truncate">{bookingUrl}</p>
          </div>
          <button
            onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success('Link copiado!'); }}
            className="btn-secondary text-sm whitespace-nowrap"
          >
            📋 Copiar
          </button>
          <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-sm whitespace-nowrap">
            👁️ Ver
          </a>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Agendamentos de hoje</h2>
        </div>
        {today.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-4xl mb-2">🌟</p>
            <p className="font-medium">Nenhum agendamento hoje</p>
            <p className="text-sm">Compartilhe seu link para receber agendamentos</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {today.sort((a, b) => a.start_time.localeCompare(b.start_time)).map(apt => (
              <div key={apt.id} className="p-4 flex items-center gap-4">
                <div className="text-center min-w-[50px]">
                  <p className="text-lg font-bold text-gray-900">{apt.start_time}</p>
                  <p className="text-xs text-gray-400">{apt.end_time}</p>
                </div>
                <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: apt.service_color || '#7c3aed' }} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900">{apt.client_name}</p>
                  <p className="text-sm text-gray-500">{apt.service_name}</p>
                  <p className="text-xs text-gray-400">{apt.client_phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(apt.service_price)}</p>
                  <span className={`badge-${apt.status}`}>{statusLabel[apt.status]}</span>
                </div>
                {apt.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(apt.id, 'confirmed')}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200 transition-colors">
                      ✓ Confirmar
                    </button>
                    <button onClick={() => updateStatus(apt.id, 'completed')}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 transition-colors">
                      ✓ Concluir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {showModal && (
      <NewAppointmentModal
        onClose={() => setShowModal(false)}
        onCreated={(apt) => setToday(ts => [apt, ...ts].filter(a => a.date === todayStr()).sort((a, b) => a.start_time.localeCompare(b.start_time)))}
      />
    )}
    </Page>
  );
}
