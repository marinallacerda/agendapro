import { useState, useEffect, FormEvent } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Page from '../components/Page';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

interface WorkingHour {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  enabled: number;
}

interface BlockedSlot {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  reason: string;
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export default function Schedule() {
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [blocked, setBlocked] = useState<BlockedSlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [blockForm, setBlockForm] = useState({ date: '', start_time: '12:00', end_time: '13:00', reason: '' });
  const [showBlockModal, setShowBlockModal] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [h, b] = await Promise.all([
        api.get('/schedule/working-hours'),
        api.get('/schedule/blocked-slots'),
      ]);
      setHours(h.data);
      setBlocked(b.data);
    } catch { toast.error('Erro ao carregar horários'); }
  }

  function updateHour(dayOfWeek: number, field: string, value: string | boolean) {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
    ));
  }

  async function saveHours() {
    setSaving(true);
    try {
      await api.put('/schedule/working-hours', { hours });
      toast.success('Horários salvos!');
    } catch { toast.error('Erro ao salvar horários'); }
    finally { setSaving(false); }
  }

  async function addBlock(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/schedule/blocked-slots', blockForm);
      toast.success('Horário bloqueado!');
      setShowBlockModal(false);
      setBlockForm({ date: '', start_time: '12:00', end_time: '13:00', reason: '' });
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao bloquear');
    }
  }

  async function deleteBlock(id: number) {
    if (!confirm('Remover este bloqueio?')) return;
    try {
      await api.delete(`/schedule/blocked-slots/${id}`);
      toast.success('Bloqueio removido!');
      load();
    } catch { toast.error('Erro ao remover bloqueio'); }
  }

  return (
    <Page>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Horários</h1>
        <p className="text-gray-500 text-sm mt-1">Configure seus horários de atendimento</p>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Horários de funcionamento</h2>
          <button onClick={saveHours} className="btn-primary text-sm" disabled={saving}>
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾 Salvar'}
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {hours.map(h => (
            <div key={h.day_of_week} className="p-4 flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  onClick={() => updateHour(h.day_of_week, 'enabled', !h.enabled)}
                  className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${h.enabled ? 'bg-primary-600' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${h.enabled ? 'left-5' : 'left-1'}`} />
                </div>
              </label>
              <span className={`w-20 text-sm font-medium ${h.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                {DAYS[h.day_of_week]}
              </span>
              {h.enabled ? (
                <div className="flex items-center gap-2">
                  <input type="time" className="input w-28 text-sm" value={h.start_time}
                    onChange={e => updateHour(h.day_of_week, 'start_time', e.target.value)} />
                  <span className="text-gray-400 text-sm">até</span>
                  <input type="time" className="input w-28 text-sm" value={h.end_time}
                    onChange={e => updateHour(h.day_of_week, 'end_time', e.target.value)} />
                </div>
              ) : (
                <span className="text-sm text-gray-400">Fechado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Bloqueios de horário</h2>
          <button onClick={() => setShowBlockModal(true)} className="btn-primary text-sm">
            + Bloquear horário
          </button>
        </div>
        {blocked.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="text-3xl mb-2">🔓</p>
            <p className="text-sm">Nenhum horário bloqueado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {blocked.map(b => (
              <div key={b.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{formatDate(b.date)}</p>
                  <p className="text-sm text-gray-500">{b.start_time} – {b.end_time}</p>
                  {b.reason && <p className="text-xs text-gray-400">{b.reason}</p>}
                </div>
                <button onClick={() => deleteBlock(b.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors">
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">Bloquear horário</h2>
            <form onSubmit={addBlock} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                <input type="date" className="input" value={blockForm.date}
                  onChange={e => setBlockForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                  <input type="time" className="input" value={blockForm.start_time}
                    onChange={e => setBlockForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
                  <input type="time" className="input" value={blockForm.end_time}
                    onChange={e => setBlockForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
                <input className="input" placeholder="Ex: Consulta médica, folga..." value={blockForm.reason}
                  onChange={e => setBlockForm(f => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowBlockModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1">Bloquear</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </Page>
  );
}
