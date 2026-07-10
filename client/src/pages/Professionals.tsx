import { useState, useEffect } from 'react';
import api from '../lib/api';

interface Professional {
  id: number;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  commission_pct: number;
  color: string;
  active: number;
}

const COLORS = [
  '#3A6650', '#6D5BBA', '#3A6BAA', '#C4603A',
  '#B04A7A', '#8A6A2A', '#0891b2', '#16a34a',
];

const SPECIALTIES = [
  'Esteticista', 'Biomédica', 'Enfermeira', 'Médica Dermatologista',
  'Médica Geral', 'Fisioterapeuta', 'Nutricionista', 'Massoterapeuta',
];

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

export default function Professionals() {
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Professional | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Professional>>({});

  async function load() {
    try {
      const res = await api.get('/professionals');
      setPros(res.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ color: COLORS[0], commission_pct: 40, active: 1 });
    setShowForm(true);
  }

  function openEdit(p: Professional) {
    setEditing(p);
    setForm({ ...p });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/professionals/${editing.id}`, form);
        setPros(ps => ps.map(p => p.id === editing.id ? res.data : p));
      } else {
        const res = await api.post('/professionals', form);
        setPros(ps => [...ps, res.data]);
      }
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Professional) {
    const res = await api.put(`/professionals/${p.id}`, { ...p, active: p.active ? 0 : 1 });
    setPros(ps => ps.map(x => x.id === p.id ? res.data : x));
  }

  async function handleDelete(p: Professional) {
    if (!confirm(`Excluir ${p.name}?`)) return;
    await api.delete(`/professionals/${p.id}`);
    setPros(ps => ps.filter(x => x.id !== p.id));
  }

  const active = pros.filter(p => p.active);
  const inactive = pros.filter(p => !p.active);

  return (
    <div>
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profissionais</h1>
          <p className="text-sm text-gray-500 mt-1">{active.length} ativas · {inactive.length} inativas</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-primary-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors"
        >
          <span className="text-base leading-none">+</span> Adicionar profissional
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400">Carregando…</div>
      ) : pros.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100 h-48 gap-3 text-gray-400">
          <span className="text-4xl">👩‍⚕️</span>
          <p className="text-sm">Nenhuma profissional cadastrada</p>
          <button onClick={openNew} className="text-primary-600 text-sm font-semibold hover:underline">Adicionar primeira</button>
        </div>
      ) : (
        <>
          {/* active grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {active.map(p => (
              <ProfCard
                key={p.id}
                pro={p}
                onEdit={() => openEdit(p)}
                onToggle={() => toggleActive(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
          </div>

          {/* inactive section */}
          {inactive.length > 0 && (
            <>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-3">Inativas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
                {inactive.map(p => (
                  <ProfCard
                    key={p.id}
                    pro={p}
                    onEdit={() => openEdit(p)}
                    onToggle={() => toggleActive(p)}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── FORM MODAL ─────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Editar profissional' : 'Nova profissional'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="px-6 py-4 space-y-4">

              {/* color picker */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Cor de identificação</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full transition-transform hover:scale-110 ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Nome completo *</label>
                <input
                  value={form.name || ''}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                  placeholder="Dra. Maria Silva"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Especialidade</label>
                <select
                  value={form.specialty || ''}
                  onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 bg-white"
                >
                  <option value="">Selecionar…</option>
                  {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
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
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Comissão (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.commission_pct ?? 40}
                    onChange={e => setForm(f => ({ ...f, commission_pct: Number(e.target.value) }))}
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
                  placeholder="profissional@clinica.com"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  type="checkbox"
                  id="pro-active"
                  checked={!!form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked ? 1 : 0 }))}
                  className="w-4 h-4 accent-primary-600"
                />
                <label htmlFor="pro-active" className="text-sm text-gray-700">Profissional ativa</label>
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

function ProfCard({
  pro, onEdit, onToggle, onDelete,
}: {
  pro: Professional;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 mb-4">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ background: pro.color }}
        >
          {initials(pro.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm truncate">{pro.name}</h3>
          {pro.specialty && <p className="text-xs text-gray-400 mt-0.5">{pro.specialty}</p>}
        </div>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
          style={{ background: pro.active ? '#16a34a' : '#d1d5db' }}
          title={pro.active ? 'Ativa' : 'Inativa'}
        />
      </div>

      <div className="space-y-1.5 mb-4 text-xs text-gray-500">
        {pro.phone && (
          <div className="flex items-center gap-2">
            <span className="text-gray-300">📞</span> {pro.phone}
          </div>
        )}
        {pro.email && (
          <div className="flex items-center gap-2 truncate">
            <span className="text-gray-300">✉️</span> <span className="truncate">{pro.email}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-300">💰</span>
          <span>Comissão: <strong className="text-gray-700">{pro.commission_pct}%</strong></span>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-50">
        <button
          onClick={onEdit}
          className="flex-1 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 py-1.5 rounded-lg transition-colors"
        >
          Editar
        </button>
        <button
          onClick={onToggle}
          className={`flex-1 text-xs font-semibold py-1.5 rounded-lg transition-colors ${
            pro.active
              ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
              : 'text-green-700 bg-green-50 hover:bg-green-100'
          }`}
        >
          {pro.active ? 'Desativar' : 'Ativar'}
        </button>
        <button
          onClick={onDelete}
          className="flex-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 py-1.5 rounded-lg transition-colors"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}
