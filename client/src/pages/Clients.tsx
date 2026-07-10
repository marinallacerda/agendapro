import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  birth_date: string;
  notes: string;
  skin_type: string;
  allergies: string;
  medications: string;
  pregnant: number;
  conditions: string;
  avatar_color: string;
  created_at: string;
}

interface ClientHistory {
  appointments: any[];
  stats: { total_visits: number; total_spent: number; last_visit: string };
}

const COLORS = [
  '#6D5BBA', '#3A6BAA', '#1A7A5A', '#C4603A',
  '#B04A7A', '#8A6A2A', '#0891b2', '#16a34a',
];

const SKIN_TYPES = ['Normal', 'Seca', 'Oleosa', 'Mista', 'Sensível', 'Acneica'];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function formatDate(d: string) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function daysSince(d: string) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  return `${diff}d atrás`;
}

function birthAge(d: string) {
  if (!d) return null;
  const bday = new Date(d);
  const now = new Date();
  let age = now.getFullYear() - bday.getFullYear();
  const m = now.getMonth() - bday.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bday.getDate())) age--;
  const mmdd = `${String(bday.getMonth() + 1).padStart(2, '0')}-${String(bday.getDate()).padStart(2, '0')}`;
  const todayMmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { age, isToday: mmdd === todayMmdd };
}

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [history, setHistory] = useState<ClientHistory | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Client>>({});

  const load = useCallback(async () => {
    try {
      const res = await api.get('/clients', { params: search ? { search } : {} });
      setClients(res.data);
      if (!selected && res.data.length > 0) setSelected(res.data[0]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) { setHistory(null); return; }
    api.get(`/clients/${selected.id}/history`).then(r => setHistory(r.data));
  }, [selected]);

  function openNew() {
    setEditing(null);
    setForm({ avatar_color: COLORS[0] });
    setShowForm(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({ ...c });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/clients/${editing.id}`, form);
        setClients(cs => cs.map(c => c.id === editing.id ? res.data : c));
        setSelected(res.data);
      } else {
        const res = await api.post('/clients', form);
        setClients(cs => [res.data, ...cs]);
        setSelected(res.data);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(c: Client) {
    if (!confirm(`Excluir ${c.name}?`)) return;
    await api.delete(`/clients/${c.id}`);
    setClients(cs => cs.filter(x => x.id !== c.id));
    setSelected(null);
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── LIST PANEL ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-gray-100">
        {/* header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          <h1 className="text-lg font-bold text-gray-900 flex-1">
            Clientes
            <span className="ml-2 text-sm font-normal text-gray-400">{clients.length} cadastradas</span>
          </h1>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone…"
            className="hidden sm:block border border-gray-200 rounded-xl px-3 py-2 text-sm w-52 focus:outline-none focus:border-primary-400 bg-gray-50"
          />
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors"
          >
            <span className="text-base leading-none">+</span> Nova cliente
          </button>
        </div>

        {/* mobile search */}
        <div className="sm:hidden px-4 py-2 border-b border-gray-100">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-gray-50"
          />
        </div>

        {/* table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
              <span className="text-3xl">👥</span>
              <p className="text-sm">{search ? 'Nenhuma cliente encontrada' : 'Nenhuma cliente cadastrada ainda'}</p>
              {!search && <button onClick={openNew} className="text-primary-600 text-sm font-semibold hover:underline">Cadastrar primeira cliente</button>}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 sticky top-0 z-10">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Telefone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden lg:table-cell">Último atend.</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide hidden md:table-cell">Gasto total</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const bday = c.birth_date ? birthAge(c.birth_date) : null;
                  const isSelected = selected?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelected(c)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                            style={{ background: c.avatar_color }}
                          >
                            {initials(c.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                              {c.name}
                              {bday?.isToday && <span className="text-xs">🎂</span>}
                            </div>
                            <div className="text-xs text-gray-400 md:hidden">{c.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 border-b border-gray-50 text-gray-500 hidden md:table-cell">{c.phone || '—'}</td>
                      <td className="px-4 py-3 border-b border-gray-50 text-gray-400 text-xs hidden lg:table-cell">—</td>
                      <td className="px-4 py-3 border-b border-gray-50 text-right hidden md:table-cell">
                        <span className="text-primary-700 font-semibold">—</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── PROFILE PANEL ──────────────────────────────────────── */}
      {selected && (
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col overflow-y-auto bg-white">
          {/* head */}
          <div className="px-5 pt-6 pb-4 border-b border-gray-100 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto mb-3"
              style={{ background: selected.avatar_color }}
            >
              {initials(selected.name)}
            </div>
            <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Cliente desde {formatDate(selected.created_at?.slice(0, 10))}
            </p>
            {selected.birth_date && (() => {
              const b = birthAge(selected.birth_date);
              return (
                <p className="text-xs text-gray-400 mt-0.5">
                  {b?.isToday ? '🎂 Aniversário hoje! ' : ''}{b?.age} anos
                </p>
              );
            })()}

            {/* action buttons */}
            <div className="flex gap-2 mt-3 justify-center">
              <button
                onClick={() => openEdit(selected)}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Editar
              </button>
              {selected.phone && (
                <a
                  href={`https://wa.me/55${selected.phone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs bg-green-100 hover:bg-green-200 text-green-700 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  WhatsApp
                </a>
              )}
              <button
                onClick={() => handleDelete(selected)}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>

          {/* stats */}
          {history && (
            <div className="grid grid-cols-3 border-b border-gray-100">
              {[
                { val: history.stats?.total_visits ?? 0, label: 'Visitas' },
                { val: formatCurrency(history.stats?.total_spent ?? 0), label: 'Total gasto' },
                { val: history.stats?.last_visit ? daysSince(history.stats.last_visit) : '—', label: 'Último atend.' },
              ].map(s => (
                <div key={s.label} className="py-3 text-center border-r border-gray-100 last:border-r-0">
                  <div className="text-lg font-bold text-primary-700 tabular-nums">{s.val}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* contact info */}
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Informações</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Telefone', val: selected.phone },
                { label: 'E-mail', val: selected.email },
                { label: 'Aniversário', val: formatDate(selected.birth_date) },
              ].map(r => (
                r.val ? (
                  <div key={r.label} className="flex justify-between">
                    <span className="text-gray-400">{r.label}</span>
                    <span className="font-medium text-gray-900 text-right ml-4 break-all">{r.val}</span>
                  </div>
                ) : null
              ))}
            </div>
          </div>

          {/* anamnese */}
          {(selected.skin_type || selected.allergies || selected.medications || selected.conditions) && (
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Anamnese</h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.skin_type && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full">Pele {selected.skin_type}</span>}
                {selected.allergies && <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full">Alergias: {selected.allergies}</span>}
                {selected.medications && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">Medicamentos: {selected.medications}</span>}
                {selected.pregnant === 1 && <span className="text-xs bg-pink-50 text-pink-600 px-2 py-1 rounded-full">Gestante</span>}
                {selected.conditions && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full">{selected.conditions}</span>}
              </div>
            </div>
          )}

          {/* notes */}
          {selected.notes && (
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Observações</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
            </div>
          )}

          {/* appointment history */}
          {history && history.appointments.length > 0 && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Histórico de atendimentos</h3>
              <div className="space-y-2">
                {history.appointments.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-3 text-sm">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: a.service_color || '#6D5BBA' }}
                    />
                    <span className="text-gray-400 text-xs w-20 flex-shrink-0 tabular-nums">{formatDate(a.date)}</span>
                    <span className="text-gray-700 flex-1 truncate">{a.service_name}</span>
                    <span className="text-primary-600 font-semibold text-xs tabular-nums">
                      {formatCurrency(a.service_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Editar cliente' : 'Nova cliente'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">

              {/* avatar color picker */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Cor do avatar</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, avatar_color: c }))}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.avatar_color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              {/* name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome *</label>
                <input
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  placeholder="Nome completo"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Telefone</label>
                  <input
                    value={form.phone || ''}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Data de nascimento</label>
                  <input
                    type="date"
                    value={form.birth_date || ''}
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Anamnese</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tipo de pele</label>
                    <select
                      value={form.skin_type || ''}
                      onChange={e => setForm(f => ({ ...f, skin_type: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 bg-white"
                    >
                      <option value="">Selecionar…</option>
                      {SKIN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Alergias</label>
                    <input
                      value={form.allergies || ''}
                      onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                      placeholder="Ex: lidocaína, látex"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Medicamentos em uso</label>
                    <input
                      value={form.medications || ''}
                      onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                      placeholder="Ex: anticoagulantes, isotretinoína"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Condições / Doenças</label>
                    <input
                      value={form.conditions || ''}
                      onChange={e => setForm(f => ({ ...f, conditions: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                      placeholder="Ex: hipertensão, diabetes"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="pregnant"
                      checked={!!form.pregnant}
                      onChange={e => setForm(f => ({ ...f, pregnant: e.target.checked ? 1 : 0 }))}
                      className="w-4 h-4 accent-primary-600"
                    />
                    <label htmlFor="pregnant" className="text-sm text-gray-700">Gestante</label>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Observações internas</label>
                <textarea
                  value={form.notes || ''}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none"
                  placeholder="Notas privadas sobre a cliente…"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-xl hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name?.trim()}
                className="bg-primary-600 text-white text-sm font-semibold px-6 py-2 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
