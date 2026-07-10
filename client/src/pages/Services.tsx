import { useState, useEffect, FormEvent } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import Page from '../components/Page';

interface Service {
  id: number;
  name: string;
  description: string;
  duration_minutes: number;
  price: number;
  active: number;
  color: string;
}

const COLORS = ['#7C3AED', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4', '#3B82F6'];

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const emptyForm = { name: '', description: '', duration_minutes: 60, price: 0, color: '#7C3AED', active: true };

export default function Services() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/services');
      setServices(data);
    } catch { toast.error('Erro ao carregar serviços'); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditing(null);
    setForm(emptyForm);
    setModal(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setForm({ name: s.name, description: s.description, duration_minutes: s.duration_minutes, price: s.price, color: s.color, active: !!s.active });
    setModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/services/${editing.id}`, form);
        toast.success('Serviço atualizado!');
      } else {
        await api.post('/services', form);
        toast.success('Serviço criado!');
      }
      setModal(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Service) {
    try {
      await api.put(`/services/${s.id}`, { ...s, active: !s.active });
      toast.success(s.active ? 'Serviço desativado' : 'Serviço ativado');
      load();
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Excluir o serviço "${s.name}"?`)) return;
    try {
      await api.delete(`/services/${s.id}`);
      toast.success('Serviço excluído!');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao excluir');
    }
  }

  return (
    <Page>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Serviços</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie os procedimentos que você oferece</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          + Novo serviço
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : services.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-4xl mb-3">✂️</p>
          <p className="font-semibold text-gray-700">Nenhum serviço cadastrado</p>
          <p className="text-sm text-gray-500 mt-1">Adicione os procedimentos que você realiza</p>
          <button onClick={openNew} className="btn-primary mt-4 mx-auto">+ Adicionar primeiro serviço</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map(s => (
            <div key={s.id} className={`card p-5 ${!s.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                    style={{ backgroundColor: s.color }}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{s.name}</h3>
                    <p className="text-xs text-gray-400">{s.duration_minutes} min</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {s.description && <p className="text-sm text-gray-500 mb-3">{s.description}</p>}
              <p className="text-xl font-bold text-primary-600 mb-4">{formatCurrency(s.price)}</p>
              <div className="flex gap-2">
                <button onClick={() => openEdit(s)} className="btn-secondary text-xs flex-1">✏️ Editar</button>
                <button onClick={() => toggleActive(s)} className="btn-secondary text-xs flex-1">
                  {s.active ? '🚫 Desativar' : '✅ Ativar'}
                </button>
                <button onClick={() => handleDelete(s)} className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-5">
              {editing ? 'Editar serviço' : 'Novo serviço'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do serviço *</label>
                <input className="input" placeholder="Ex: Manicure, Pedicure..." value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input className="input" placeholder="Descrição opcional..." value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duração (min) *</label>
                  <input type="number" className="input" min="15" step="15" value={form.duration_minutes}
                    onChange={e => setForm(f => ({ ...f, duration_minutes: Number(e.target.value) }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$) *</label>
                  <input type="number" className="input" min="0" step="0.01" value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cor</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button type="button" key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-8 h-8 rounded-lg transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </Page>
  );
}
