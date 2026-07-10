import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Page from '../components/Page';

interface Appointment {
  id: number;
  client_name: string;
  client_phone: string;
  client_email: string;
  date: string;
  start_time: string;
  end_time: string;
  service_name: string;
  service_color: string;
  service_price: number;
  status: string;
  payment_status: string;
  notes: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', completed: 'Concluído', cancelled: 'Cancelado',
};
const STATUS_NEXT: Record<string, { label: string; status: string }[]> = {
  pending: [{ label: '✓ Confirmar', status: 'confirmed' }, { label: '✓ Concluir', status: 'completed' }, { label: '✕ Cancelar', status: 'cancelled' }],
  confirmed: [{ label: '✓ Concluir', status: 'completed' }, { label: '✕ Cancelar', status: 'cancelled' }],
  completed: [],
  cancelled: [],
};

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function Appointments() {
  const [apts, setApts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ from: todayStr(), to: '', status: '' });
  const [selected, setSelected] = useState<Appointment | null>(null);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.from) params.set('from', filter.from);
      if (filter.to) params.set('to', filter.to);
      if (filter.status) params.set('status', filter.status);
      const { data } = await api.get(`/appointments?${params}`);
      setApts(data);
    } catch { toast.error('Erro ao carregar agendamentos'); }
    finally { setLoading(false); }
  }

  async function setStatus(id: number, status: string) {
    try {
      await api.put(`/appointments/${id}/status`, { status });
      toast.success('Status atualizado!');
      setSelected(null);
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function setPayment(id: number, payment_status: string) {
    try {
      await api.put(`/appointments/${id}/status`, { payment_status });
      toast.success('Pagamento atualizado!');
      if (selected?.id === id) setSelected(a => a ? { ...a, payment_status } : null);
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function deleteApt(id: number) {
    if (!confirm('Excluir este agendamento?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      toast.success('Agendamento excluído!');
      setSelected(null);
      load();
    } catch { toast.error('Erro ao excluir'); }
  }

  const whatsappLink = (phone: string, name: string) => {
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('55') ? clean : `55${clean}`;
    return `https://wa.me/${num}?text=Olá ${encodeURIComponent(name)}!`;
  };

  return (
    <Page>
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-gray-500 text-sm mt-1">{apts.length} resultado{apts.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
          <input type="date" className="input text-sm w-36" value={filter.from}
            onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
          <input type="date" className="input text-sm w-36" value={filter.to}
            onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select className="input text-sm w-36" value={filter.status}
            onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
            <option value="">Todos</option>
            <option value="pending">Pendente</option>
            <option value="confirmed">Confirmado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => setFilter({ from: '', to: '', status: '' })} className="btn-secondary text-sm">
            Limpar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : apts.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">📭</p>
          <p className="font-semibold text-gray-700">Nenhum agendamento encontrado</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-50">
          {apts.map(apt => (
            <div key={apt.id}
              className="p-4 flex items-center gap-4 hover:bg-gray-50 cursor-pointer transition-colors"
              onClick={() => setSelected(apt)}>
              <div className="text-center min-w-[70px]">
                <p className="text-xs text-gray-400 font-medium">{formatDate(apt.date)}</p>
                <p className="text-base font-bold text-gray-900">{apt.start_time}</p>
              </div>
              <div className="w-1 h-12 rounded-full flex-shrink-0" style={{ backgroundColor: apt.service_color || '#7c3aed' }} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{apt.client_name}</p>
                <p className="text-sm text-gray-500">{apt.service_name}</p>
                <p className="text-xs text-gray-400">{apt.client_phone}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(apt.service_price)}</p>
                <span className={`badge-${apt.status}`}>{STATUS_LABELS[apt.status]}</span>
                {apt.payment_status === 'paid' && <p className="text-xs text-green-600 mt-0.5">💰 Pago</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selected.client_name}</h2>
                <p className="text-sm text-gray-500">{formatDate(selected.date)} às {selected.start_time}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Serviço</span>
                <span className="font-medium">{selected.service_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Horário</span>
                <span className="font-medium">{selected.start_time} – {selected.end_time}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Telefone</span>
                <a href={whatsappLink(selected.client_phone, selected.client_name)} target="_blank" rel="noopener noreferrer"
                  className="font-medium text-green-600 hover:underline">
                  📱 {selected.client_phone}
                </a>
              </div>
              {selected.client_email && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium">{selected.client_email}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Valor</span>
                <span className="font-bold text-primary-600">{formatCurrency(selected.service_price)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Pagamento</span>
                <button onClick={() => setPayment(selected.id, selected.payment_status === 'paid' ? 'pending' : 'paid')}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${selected.payment_status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {selected.payment_status === 'paid' ? '✓ Pago' : 'Marcar como pago'}
                </button>
              </div>
              {selected.notes && (
                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-600">
                  <p className="font-medium text-gray-700 mb-1">Observações</p>
                  {selected.notes}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {STATUS_NEXT[selected.status]?.map(next => (
                <button key={next.status} onClick={() => setStatus(selected.id, next.status)}
                  className={`text-sm px-3 py-2 rounded-xl font-medium transition-colors ${next.status === 'cancelled' ? 'bg-red-50 text-red-600 hover:bg-red-100' : next.status === 'completed' ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                  {next.label}
                </button>
              ))}
              <button onClick={() => deleteApt(selected.id)}
                className="text-sm px-3 py-2 rounded-xl font-medium bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors col-span-full">
                🗑️ Excluir agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </Page>
  );
}
