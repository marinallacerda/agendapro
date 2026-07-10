import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface Service {
  id: number;
  name: string;
  duration_minutes: number;
  price: number;
  color: string;
}

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
}

interface Professional {
  id: number;
  name: string;
  color: string;
  specialty: string;
}

interface Props {
  onClose: () => void;
  onCreated: (apt: any) => void;
  defaultDate?: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function NewAppointmentModal({ onClose, onCreated, defaultDate }: Props) {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(defaultDate || new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('');
  const [clientMode, setClientMode] = useState<'search' | 'manual'>('manual');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);

  const selectedService = services.find(s => s.id === Number(serviceId));

  useEffect(() => {
    Promise.all([
      api.get('/services').then(r => setServices(r.data.filter((s: any) => s.active))),
      api.get('/clients').then(r => setClients(r.data)),
      api.get('/professionals').then(r => setProfessionals(r.data.filter((p: any) => p.active))),
    ]).catch(() => {});
  }, []);

  useEffect(() => {
    if (!serviceId || !date || !user?.slug) { setSlots([]); return; }
    setSlotsLoading(true);
    api.get(`/public/${user.slug}/available-slots`, { params: { date, service_id: serviceId } })
      .then(r => setSlots(r.data))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
    setTime('');
  }, [serviceId, date, user?.slug]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch)
  );

  function selectClient(c: Client) {
    setSelectedClientId(c.id);
    setClientName(c.name);
    setClientPhone(c.phone);
    setClientEmail(c.email);
    setClientSearch(c.name);
  }

  async function handleSubmit() {
    setError('');
    if (!serviceId) { setError('Selecione um serviço'); return; }
    if (!date) { setError('Informe a data'); return; }
    if (!time) { setError('Selecione um horário'); return; }
    if (!clientName.trim()) { setError('Informe o nome do cliente'); return; }

    setSaving(true);
    try {
      const res = await api.post('/appointments', {
        service_id: Number(serviceId),
        client_name: clientName,
        client_phone: clientPhone,
        client_email: clientEmail,
        date,
        start_time: time,
        professional_id: professionalId ? Number(professionalId) : null,
        notes,
      });
      onCreated(res.data);
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Erro ao criar agendamento');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[92vh]">
        {/* header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Novo agendamento</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Service */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
              Serviço *
            </label>
            <select
              value={serviceId}
              onChange={e => setServiceId(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 bg-white"
            >
              <option value="">Selecionar serviço…</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.duration_minutes}min — {formatCurrency(s.price)}
                </option>
              ))}
            </select>
            {selectedService && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: selectedService.color }} />
                <span className="text-xs text-gray-500">
                  {selectedService.duration_minutes} minutos · {formatCurrency(selectedService.price)}
                </span>
              </div>
            )}
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Data *</label>
              <input
                type="date"
                value={date}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Horário *</label>
              {slots.length > 0 ? (
                <select
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 bg-white"
                >
                  <option value="">Selecionar…</option>
                  {slots.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input
                  type="time"
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                />
              )}
              {slotsLoading && <p className="text-xs text-gray-400 mt-1">Verificando disponibilidade…</p>}
              {serviceId && date && !slotsLoading && slots.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">Nenhum horário livre · use input manual</p>
              )}
            </div>
          </div>

          {/* Client */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente *</label>
              <div className="flex gap-1">
                {(['manual', 'search'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => { setClientMode(m); setClientName(''); setClientPhone(''); setSelectedClientId(null); setClientSearch(''); }}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${clientMode === m ? 'bg-primary-100 text-primary-700' : 'text-gray-400 hover:bg-gray-100'}`}
                  >
                    {m === 'manual' ? 'Digitar' : 'Buscar cadastro'}
                  </button>
                ))}
              </div>
            </div>

            {clientMode === 'search' ? (
              <div className="relative">
                <input
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setSelectedClientId(null); setClientName(e.target.value); }}
                  placeholder="Nome ou telefone…"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                />
                {clientSearch && !selectedClientId && filteredClients.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {filteredClients.slice(0, 6).map(c => (
                      <button
                        key={c.id}
                        onClick={() => selectClient(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2.5"
                      >
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                          style={{ background: '#6D5BBA' }}
                        >
                          {c.name[0]}
                        </div>
                        <div>
                          <div className="text-sm font-semibold">{c.name}</div>
                          <div className="text-xs text-gray-400">{c.phone}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {selectedClientId && (
                  <div className="mt-2 flex items-center gap-2 bg-primary-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-primary-700 font-semibold flex-1">{clientName} · {clientPhone}</span>
                    <button onClick={() => { setSelectedClientId(null); setClientSearch(''); setClientName(''); setClientPhone(''); }} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  placeholder="Nome completo *"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={clientPhone}
                    onChange={e => setClientPhone(e.target.value)}
                    placeholder="Telefone / WhatsApp"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                  />
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    placeholder="E-mail (opcional)"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Professional (optional) */}
          {professionals.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Profissional</label>
              <select
                value={professionalId}
                onChange={e => setProfessionalId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 bg-white"
              >
                <option value="">Sem profissional específica</option>
                {professionals.map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.specialty ? ` — ${p.specialty}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Observações</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Anotações internas sobre este agendamento…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary-400 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2.5 rounded-xl border border-red-100">
              {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            Agendado como <strong>Confirmado</strong> automaticamente
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="text-sm text-gray-600 font-medium px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Criando…' : 'Criar agendamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
