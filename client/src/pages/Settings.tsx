import { useState, useEffect, FormEvent } from 'react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Page from '../components/Page';
import toast from 'react-hot-toast';

const PIX_TYPES = [
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Telefone' },
  { value: 'random', label: 'Chave aleatória' },
];

export default function Settings() {
  const { refreshUser } = useAuth();
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'business' | 'pix' | 'whatsapp' | 'password'>('business');
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await api.get('/settings');
      setForm(data);
    } catch { toast.error('Erro ao carregar configurações'); }
    finally { setLoading(false); }
  }

  function set(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((f: any) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      await refreshUser();
      toast.success('Configurações salvas!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    try {
      await api.put('/auth/password', { current_password: pwForm.current_password, new_password: pwForm.new_password });
      toast.success('Senha alterada!');
      setPwForm({ current_password: '', new_password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao alterar senha');
    }
  }

  async function testWhatsapp() {
    try {
      await api.post('/settings/test-whatsapp', { phone: testPhone });
      toast.success('Mensagem de teste enviada!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao enviar teste');
    }
  }

  if (loading) return (
    <Page>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </Page>
  );

  const tabs = [
    { id: 'business', label: '🏪 Negócio' },
    { id: 'pix', label: '💰 PIX' },
    { id: 'whatsapp', label: '📱 WhatsApp' },
    { id: 'password', label: '🔒 Senha' },
  ] as const;

  return (
    <Page>
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Personalize seu perfil e integrações</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'business' && (
        <form onSubmit={handleSave} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Informações do negócio</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome</label>
              <input className="input" value={form.name || ''} onChange={set('name')} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do negócio</label>
              <input className="input" value={form.business_name || ''} onChange={set('business_name')} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
            <input className="input" placeholder="(11) 99999-9999" value={form.phone || ''} onChange={set('phone')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio / Apresentação</label>
            <textarea className="input resize-none" rows={3} placeholder="Conte um pouco sobre você e seus serviços..."
              value={form.bio || ''} onChange={set('bio') as any} />
          </div>
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">Seu link de agendamento</p>
            <p className="text-sm text-primary-600 font-medium break-all">
              {window.location.origin}/agendar/{form.slug}
            </p>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾 Salvar'}
          </button>
        </form>
      )}

      {tab === 'pix' && (
        <form onSubmit={handleSave} className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Configuração do PIX</h2>
            <p className="text-sm text-gray-500 mt-1">Seus clientes verão o QR Code para pagar na hora do agendamento</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de chave PIX</label>
            <select className="input" value={form.pix_key_type || 'cpf'} onChange={set('pix_key_type')}>
              {PIX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
            <input className="input" placeholder="Sua chave PIX" value={form.pix_key || ''} onChange={set('pix_key')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome no PIX</label>
              <input className="input" placeholder="Nome que aparece no PIX" value={form.pix_name || ''} onChange={set('pix_name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
              <input className="input" placeholder="Sua cidade" value={form.pix_city || ''} onChange={set('pix_city')} />
            </div>
          </div>
          {!form.pix_key && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-700">
              ⚠️ Configure sua chave PIX para receber pagamentos pelo app
            </div>
          )}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾 Salvar'}
          </button>
        </form>
      )}

      {tab === 'whatsapp' && (
        <div className="space-y-4">
          <form onSubmit={handleSave} className="card p-6 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Integração WhatsApp</h2>
              <p className="text-sm text-gray-500 mt-1">Envie lembretes automáticos via Evolution API (open source)</p>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm font-medium text-gray-900">Ativar WhatsApp</p>
                <p className="text-xs text-gray-500">Enviar mensagens automáticas</p>
              </div>
              <div onClick={() => setForm((f: any) => ({ ...f, whatsapp_enabled: !f.whatsapp_enabled }))}
                className={`w-12 h-7 rounded-full transition-colors cursor-pointer relative ${form.whatsapp_enabled ? 'bg-primary-600' : 'bg-gray-300'}`}>
                <div className={`absolute top-1.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.whatsapp_enabled ? 'left-7' : 'left-1.5'}`} />
              </div>
            </div>
            {form.whatsapp_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL da Evolution API</label>
                  <input className="input" placeholder="http://seu-servidor:8080" value={form.evolution_api_url || ''} onChange={set('evolution_api_url')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input className="input" placeholder="sua-api-key" value={form.evolution_api_key || ''} onChange={set('evolution_api_key')} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome da instância</label>
                  <input className="input" placeholder="minha-instancia" value={form.evolution_instance || ''} onChange={set('evolution_instance')} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'reminder_24h', label: 'Lembrete 24h antes' },
                    { key: 'reminder_1h', label: 'Lembrete 1h antes' },
                  ].map(r => (
                    <div key={r.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <p className="text-sm text-gray-700">{r.label}</p>
                      <div onClick={() => setForm((f: any) => ({ ...f, [r.key]: !f[r.key] }))}
                        className={`w-10 h-6 rounded-full transition-colors cursor-pointer relative ${form[r.key] ? 'bg-primary-600' : 'bg-gray-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form[r.key] ? 'left-5' : 'left-1'}`} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '💾 Salvar'}
            </button>
          </form>

          {form.whatsapp_enabled && (
            <div className="card p-6 space-y-3">
              <h3 className="font-medium text-gray-900">Testar conexão</h3>
              <div className="flex gap-3">
                <input className="input flex-1" placeholder="(11) 99999-9999" value={testPhone}
                  onChange={e => setTestPhone(e.target.value)} />
                <button type="button" onClick={testWhatsapp} className="btn-primary whitespace-nowrap">
                  📤 Testar
                </button>
              </div>
            </div>
          )}

          <div className="card p-4 bg-blue-50 border-blue-100">
            <p className="text-sm font-medium text-blue-800 mb-1">Como configurar a Evolution API</p>
            <p className="text-xs text-blue-700">
              1. Instale a Evolution API no seu servidor<br />
              2. Crie uma instância e conecte ao WhatsApp<br />
              3. Preencha a URL, API Key e nome da instância acima
            </p>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePassword} className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Alterar senha</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha atual</label>
            <input type="password" className="input" value={pwForm.current_password}
              onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <input type="password" className="input" placeholder="Mínimo 6 caracteres" value={pwForm.new_password}
              onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))} required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar nova senha</label>
            <input type="password" className="input" value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
          </div>
          <button type="submit" className="btn-primary">🔒 Alterar senha</button>
        </form>
      )}
    </div>
    </Page>
  );
}
