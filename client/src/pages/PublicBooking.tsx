import { useState, useEffect, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api/public' });

interface BusinessInfo { name: string; business_name: string; bio: string; phone: string; slug: string; }
interface Service { id: number; name: string; description: string; duration_minutes: number; price: number; color: string; }

type Step = 'service' | 'datetime' | 'info' | 'payment' | 'done';

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(d: string) {
  const [y, m, day] = d.split('-');
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const dt = new Date(`${d}T12:00:00`);
  return `${days[dt.getDay()]}, ${day} ${months[Number(m) - 1]} ${y}`;
}

function getNext30Days(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 0; i < 45; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<BusinessInfo | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [step, setStep] = useState<Step>('service');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [booking, setBooking] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      api.get(`/${slug}/info`),
      api.get(`/${slug}/services`),
    ]).then(([i, s]) => {
      setInfo(i.data);
      setServices(s.data);
    }).catch(() => setError('Profissional não encontrado'));
  }, [slug]);

  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    setLoadingSlots(true);
    setSlots([]);
    setSelectedTime('');
    api.get(`/${slug}/available-slots?date=${selectedDate}&service_id=${selectedService.id}`)
      .then(r => setSlots(r.data))
      .finally(() => setLoadingSlots(false));
  }, [selectedDate, selectedService]);

  async function handleBook(e: FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedDate || !selectedTime) return;
    setSubmitting(true);
    try {
      const { data } = await api.post(`/${slug}/book`, {
        service_id: selectedService.id,
        date: selectedDate,
        start_time: selectedTime,
        client_name: clientForm.name,
        client_phone: clientForm.phone,
        client_email: clientForm.email,
        notes: clientForm.notes,
      });
      setBooking(data);
      setStep('payment');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Erro ao agendar');
    } finally {
      setSubmitting(false);
    }
  }

  function copyPix() {
    navigator.clipboard.writeText(booking.pix_payload);
    setCopied(true);
    toast.success('PIX copiado!');
    setTimeout(() => setCopied(false), 3000);
  }

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-5xl mb-4">😔</p>
        <h1 className="text-xl font-bold text-gray-800">{error}</h1>
        <p className="text-gray-500 mt-2">Verifique o link e tente novamente</p>
      </div>
    </div>
  );

  if (!info) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const days = getNext30Days();

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white pb-12">
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white px-4 py-8 text-center">
        <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-3">
          <span className="text-4xl font-bold text-white">{info.business_name.charAt(0)}</span>
        </div>
        <h1 className="text-2xl font-bold">{info.business_name}</h1>
        <p className="text-primary-200 text-sm mt-1">{info.name}</p>
        {info.bio && <p className="text-primary-100 text-sm mt-2 max-w-sm mx-auto">{info.bio}</p>}
      </div>

      <div className="max-w-lg mx-auto px-4 mt-6">
        {step !== 'done' && step !== 'payment' && (
          <div className="flex items-center justify-center gap-2 mb-6">
            {(['service', 'datetime', 'info'] as Step[]).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${step === s ? 'bg-primary-600 text-white' :
                    ['service', 'datetime', 'info'].indexOf(step) > i ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
                  {i + 1}
                </div>
                {i < 2 && <div className="w-8 h-0.5 bg-gray-200" />}
              </div>
            ))}
          </div>
        )}

        {step === 'service' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Escolha o serviço</h2>
            {services.length === 0 ? (
              <div className="card p-8 text-center text-gray-400">Nenhum serviço disponível</div>
            ) : (
              services.map(s => (
                <button key={s.id} onClick={() => { setSelectedService(s); setStep('datetime'); }}
                  className="w-full card p-4 text-left hover:border-primary-300 hover:shadow-md transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                      style={{ backgroundColor: s.color }}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 group-hover:text-primary-600">{s.name}</p>
                      {s.description && <p className="text-sm text-gray-500 truncate">{s.description}</p>}
                      <p className="text-xs text-gray-400 mt-0.5">⏱ {s.duration_minutes} minutos</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary-600">{formatCurrency(s.price)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {step === 'datetime' && selectedService && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('service')} className="text-primary-600 hover:text-primary-700 p-1">←</button>
              <h2 className="text-lg font-bold text-gray-900">Escolha a data e horário</h2>
            </div>

            <div className="card p-3 flex items-center gap-3 border-primary-200 bg-primary-50">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: selectedService.color }}>
                {selectedService.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{selectedService.name}</p>
                <p className="text-sm text-gray-500">{selectedService.duration_minutes} min · {formatCurrency(selectedService.price)}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Selecione a data</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {days.map(d => {
                  const dt = new Date(`${d}T12:00:00`);
                  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                  const [, m, day] = d.split('-');
                  return (
                    <button key={d} onClick={() => setSelectedDate(d)}
                      className={`flex-shrink-0 w-14 py-2 rounded-xl text-center transition-all border text-sm
                        ${selectedDate === d ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'}`}>
                      <p className="text-xs opacity-80">{dayNames[dt.getDay()]}</p>
                      <p className="font-bold">{day}</p>
                      <p className="text-xs opacity-80">{['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m)-1]}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">
                  Horários disponíveis — {formatDate(selectedDate)}
                </p>
                {loadingSlots ? (
                  <div className="flex justify-center py-6">
                    <div className="w-6 h-6 border-3 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : slots.length === 0 ? (
                  <div className="card p-6 text-center text-gray-400 text-sm">
                    😔 Nenhum horário disponível nesta data
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-2">
                    {slots.map(t => (
                      <button key={t} onClick={() => setSelectedTime(t)}
                        className={`py-2.5 rounded-xl text-sm font-medium transition-all border
                          ${selectedTime === t ? 'bg-primary-600 text-white border-primary-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {selectedDate && selectedTime && (
              <button onClick={() => setStep('info')} className="btn-primary w-full py-3 text-base">
                Continuar →
              </button>
            )}
          </div>
        )}

        {step === 'info' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep('datetime')} className="text-primary-600 hover:text-primary-700 p-1">←</button>
              <h2 className="text-lg font-bold text-gray-900">Seus dados</h2>
            </div>

            <div className="card p-3 space-y-1 bg-primary-50 border-primary-200">
              <p className="text-sm font-semibold text-gray-900">{selectedService?.name}</p>
              <p className="text-xs text-gray-500">{formatDate(selectedDate)} às {selectedTime}</p>
              <p className="text-sm font-bold text-primary-600">{formatCurrency(selectedService?.price || 0)}</p>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seu nome *</label>
                <input className="input" placeholder="Maria Silva" value={clientForm.name}
                  onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp *</label>
                <input className="input" placeholder="(11) 99999-9999" value={clientForm.phone}
                  onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" className="input" placeholder="seu@email.com" value={clientForm.email}
                  onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea className="input resize-none" rows={2} placeholder="Alguma observação especial..."
                  value={clientForm.notes} onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button type="submit" className="btn-primary w-full py-3 text-base" disabled={submitting}>
                {submitting
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : '✓ Confirmar agendamento'}
              </button>
            </form>
          </div>
        )}

        {step === 'payment' && booking && (
          <div className="space-y-5">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">✅</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Agendamento realizado!</h2>
              <p className="text-gray-500 text-sm mt-1">Aguarde a confirmação de {info.business_name}</p>
            </div>

            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-gray-900 mb-3">Resumo</h3>
              {[
                ['Serviço', booking.service_name],
                ['Data', formatDate(booking.date)],
                ['Horário', `${booking.start_time} – ${booking.end_time}`],
                ['Cliente', booking.client_name],
                ['Valor', formatCurrency(booking.service_price)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-sm">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>

            {booking.pix_qr_code ? (
              <div className="card p-5 text-center space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">💳 Pagamento via PIX</h3>
                  <p className="text-sm text-gray-500 mt-1">Valor: <strong>{formatCurrency(booking.service_price)}</strong></p>
                </div>

                <img src={booking.pix_qr_code} alt="QR Code PIX" className="w-48 h-48 mx-auto rounded-xl" />
                <p className="text-xs text-gray-400">Escaneie o QR Code com seu banco</p>

                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-500 mb-2 font-medium">PIX Copia e Cola</p>
                  <p className="text-xs text-gray-600 break-all font-mono leading-relaxed">{booking.pix_payload}</p>
                </div>

                <button onClick={copyPix}
                  className={`btn-primary w-full py-3 ${copied ? '!bg-green-600' : ''}`}>
                  {copied ? '✓ Copiado!' : '📋 Copiar código PIX'}
                </button>
              </div>
            ) : (
              <div className="card p-4 bg-yellow-50 border-yellow-200 text-center">
                <p className="text-sm text-yellow-700">
                  💬 Entre em contato com {info.business_name} para combinar o pagamento
                  {info.phone && (
                    <a href={`https://wa.me/55${info.phone.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer"
                      className="block mt-2 text-green-600 font-medium hover:underline">
                      📱 Chamar no WhatsApp
                    </a>
                  )}
                </p>
              </div>
            )}

            <button onClick={() => { setStep('service'); setSelectedService(null); setSelectedDate(''); setSelectedTime(''); setClientForm({ name: '', phone: '', email: '', notes: '' }); }}
              className="btn-secondary w-full">
              Fazer novo agendamento
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
