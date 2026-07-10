import { useState, useEffect, useRef } from 'react';
import api from '../lib/api';
import NewAppointmentModal from '../components/NewAppointmentModal';

interface Appointment {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  client_name: string;
  client_phone: string;
  service_name: string;
  service_color: string;
  status: string;
  payment_status: string;
  notes: string;
  service_price: number;
  duration_minutes: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando',
  confirmed: 'Confirmado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-50 text-green-700',
  completed: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-red-50 text-red-400 line-through',
};

const HOUR_PX = 64;
const START_HOUR = 7;
const END_HOUR = 20;
const TOTAL_HOURS = END_HOUR - START_HOUR;

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToPx(minutes: number) {
  return ((minutes - START_HOUR * 60) / 60) * HOUR_PX;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  const dow = r.getDay(); // 0 = Sunday
  const diff = dow === 0 ? -6 : 1 - dow; // Monday start
  r.setDate(r.getDate() + diff);
  return r;
}

function formatDateBR(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const DOW_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function AgendaWeek() {
  const today = new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [view, setView] = useState<'week' | 'day'>('week');
  const [dayView, setDayView] = useState(() => new Date());
  const [showModal, setShowModal] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekFrom = toIso(weekStart);
  const weekTo = toIso(addDays(weekStart, 6));

  useEffect(() => {
    setLoading(true);
    const from = view === 'week' ? weekFrom : toIso(dayView);
    const to = view === 'week' ? weekTo : toIso(dayView);
    api.get('/appointments', { params: { from, to } })
      .then(r => setAppointments(r.data))
      .finally(() => setLoading(false));
  }, [weekFrom, weekTo, view, dayView]);

  // scroll to 8am on load
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = HOUR_PX * (8 - START_HOUR) - 20;
    }
  }, []);

  function prevWeek() {
    if (view === 'week') setWeekStart(d => addDays(d, -7));
    else setDayView(d => addDays(d, -1));
  }
  function nextWeek() {
    if (view === 'week') setWeekStart(d => addDays(d, 7));
    else setDayView(d => addDays(d, 1));
  }
  function goToday() {
    setWeekStart(startOfWeek(new Date()));
    setDayView(new Date());
  }

  async function updateStatus(id: number, status: string) {
    const res = await api.put(`/appointments/${id}/status`, { status });
    setAppointments(as => as.map(a => a.id === id ? { ...a, ...res.data } : a));
    setSelected(s => s?.id === id ? { ...s, ...res.data } : s);
  }

  function handleCreated(apt: any) {
    setAppointments(as => [...as, apt]);
  }

  const days = view === 'week' ? weekDays : [dayView];

  const apptsByDay: Record<string, Appointment[]> = {};
  for (const a of appointments) {
    if (!apptsByDay[a.date]) apptsByDay[a.date] = [];
    apptsByDay[a.date].push(a);
  }

  const todayStr = toIso(today);
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowPx = minutesToPx(nowMinutes);

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* ── TOPBAR ──────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 flex-shrink-0">
          {/* view toggle */}
          <div className="flex items-center bg-gray-100 rounded-xl p-0.5 text-xs font-semibold">
            {(['week', 'day'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {v === 'week' ? 'Semana' : 'Dia'}
              </button>
            ))}
          </div>

          {/* nav */}
          <div className="flex items-center gap-1">
            <button onClick={prevWeek} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">‹</button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Hoje</button>
            <button onClick={nextWeek} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-600 font-bold">›</button>
          </div>

          {/* date label */}
          <span className="text-sm font-semibold text-gray-700">
            {view === 'week'
              ? `${formatDateBR(weekStart)} – ${formatDateBR(addDays(weekStart, 6))}`
              : dayView.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>

          {loading && <span className="text-xs text-gray-400 ml-1">Carregando…</span>}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-400 hidden sm:block">
              {appointments.filter(a => a.status !== 'cancelled').length} agendamentos
            </span>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 bg-primary-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-primary-700 transition-colors"
            >
              <span className="text-base leading-none">+</span> Agendar
            </button>
          </div>
        </div>

        {/* ── GRID ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* day headers */}
          <div
            className="flex bg-white border-b border-gray-100 flex-shrink-0"
            style={{ paddingLeft: 48 }}
          >
            {days.map(day => {
              const iso = toIso(day);
              const isToday = iso === todayStr;
              const count = apptsByDay[iso]?.filter(a => a.status !== 'cancelled').length ?? 0;
              return (
                <div
                  key={iso}
                  className="flex-1 px-2 py-2 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => { setView('day'); setDayView(day); }}
                >
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    {DOW_SHORT[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                  </div>
                  <div className={`text-lg font-bold mt-0.5 w-9 h-9 flex items-center justify-center mx-auto rounded-full transition-colors ${isToday ? 'bg-primary-600 text-white' : 'text-gray-900 hover:bg-gray-100'}`}>
                    {day.getDate()}
                  </div>
                  {count > 0 && (
                    <div className="text-xs text-primary-600 font-semibold mt-0.5">{count}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* scrollable grid body */}
          <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="flex" style={{ minHeight: TOTAL_HOURS * HOUR_PX }}>
              {/* time gutter */}
              <div className="w-12 flex-shrink-0 relative" style={{ height: TOTAL_HOURS * HOUR_PX }}>
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute right-2 text-xs text-gray-300 font-medium tabular-nums"
                    style={{ top: i * HOUR_PX - 9 }}
                  >
                    {String(START_HOUR + i).padStart(2, '0')}h
                  </div>
                ))}
              </div>

              {/* day columns */}
              {days.map(day => {
                const iso = toIso(day);
                const isToday = iso === todayStr;
                const dayAppts = apptsByDay[iso] ?? [];

                return (
                  <div
                    key={iso}
                    className="flex-1 relative border-l border-gray-100"
                    style={{ height: TOTAL_HOURS * HOUR_PX }}
                  >
                    {/* hour lines */}
                    {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                      <div key={i}>
                        <div
                          className="absolute left-0 right-0 border-t border-gray-100"
                          style={{ top: i * HOUR_PX }}
                        />
                        <div
                          className="absolute left-0 right-0 border-t border-gray-50"
                          style={{ top: i * HOUR_PX + HOUR_PX / 2, borderTopStyle: 'dashed' }}
                        />
                      </div>
                    ))}

                    {/* now indicator */}
                    {isToday && nowPx > 0 && nowPx < TOTAL_HOURS * HOUR_PX && (
                      <div
                        className="absolute left-0 right-0 z-10 pointer-events-none"
                        style={{ top: nowPx }}
                      >
                        <div className="h-0.5 bg-primary-500 relative">
                          <div className="absolute -left-1 -top-1.5 w-3 h-3 rounded-full bg-primary-500" />
                        </div>
                      </div>
                    )}

                    {/* appointments */}
                    {dayAppts.map(a => {
                      const startMin = timeToMinutes(a.start_time);
                      const endMin = timeToMinutes(a.end_time);
                      const top = minutesToPx(startMin);
                      const height = Math.max(((endMin - startMin) / 60) * HOUR_PX - 2, 22);
                      const cancelled = a.status === 'cancelled';

                      return (
                        <div
                          key={a.id}
                          onClick={() => setSelected(a)}
                          className="absolute left-0.5 right-0.5 rounded-lg cursor-pointer hover:brightness-95 transition-all hover:-translate-y-px hover:shadow-md overflow-hidden z-5"
                          style={{
                            top,
                            height,
                            background: cancelled ? '#f3f4f6' : `${a.service_color}20`,
                            borderLeft: `3px solid ${cancelled ? '#d1d5db' : a.service_color}`,
                            opacity: cancelled ? 0.5 : 1,
                          }}
                        >
                          <div
                            className="px-1.5 pt-1 text-xs leading-tight font-semibold truncate"
                            style={{ color: cancelled ? '#9ca3af' : a.service_color }}
                          >
                            {height > 30 ? a.client_name : a.client_name.split(' ')[0]}
                          </div>
                          {height > 44 && (
                            <div
                              className="px-1.5 text-xs truncate opacity-70"
                              style={{ color: a.service_color }}
                            >
                              {a.service_name}
                            </div>
                          )}
                          {height > 58 && (
                            <div className="px-1.5 text-xs text-gray-400">
                              {a.start_time} – {a.end_time}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── DETAIL PANEL ─────────────────────────────────────── */}
      {selected && (
        <div className="w-72 flex-shrink-0 flex flex-col bg-white border-l border-gray-100 overflow-y-auto">
          <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Agendamento</div>
              <h3 className="font-bold text-gray-900 text-base leading-tight">{selected.client_name}</h3>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-600 text-xl leading-none mt-0.5">×</button>
          </div>

          <div className="px-5 py-4 space-y-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: selected.service_color }} />
              <span className="text-sm font-semibold text-gray-900">{selected.service_name}</span>
            </div>
            <div className="text-sm text-gray-500 space-y-1.5">
              <div>📅 {selected.date.split('-').reverse().join('/')} · {selected.start_time} – {selected.end_time}</div>
              {selected.client_phone && (
                <div className="flex items-center gap-2">
                  📱 {selected.client_phone}
                  <a
                    href={`https://wa.me/55${selected.client_phone.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-xs text-green-600 font-semibold hover:underline"
                  >
                    WhatsApp
                  </a>
                </div>
              )}
              <div>💰 {formatCurrency(selected.service_price)}</div>
            </div>
            <div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_STYLE[selected.status]}`}>
                {STATUS_LABEL[selected.status]}
              </span>
            </div>
          </div>

          {selected.notes && (
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Observações</div>
              <p className="text-sm text-gray-600 leading-relaxed">{selected.notes}</p>
            </div>
          )}

          {/* status actions */}
          {selected.status !== 'cancelled' && selected.status !== 'completed' && (
            <div className="px-5 py-4 space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ações</div>
              {selected.status === 'pending' && (
                <button
                  onClick={() => updateStatus(selected.id, 'confirmed')}
                  className="w-full text-sm font-semibold bg-green-600 text-white py-2 rounded-xl hover:bg-green-700 transition-colors"
                >
                  Confirmar agendamento
                </button>
              )}
              {selected.status === 'confirmed' && (
                <button
                  onClick={() => updateStatus(selected.id, 'completed')}
                  className="w-full text-sm font-semibold bg-primary-600 text-white py-2 rounded-xl hover:bg-primary-700 transition-colors"
                >
                  Marcar como realizado
                </button>
              )}
              <button
                onClick={() => updateStatus(selected.id, 'cancelled')}
                className="w-full text-sm font-semibold bg-red-50 text-red-600 py-2 rounded-xl hover:bg-red-100 transition-colors"
              >
                Cancelar agendamento
              </button>
            </div>
          )}

          {selected.status === 'completed' && (
            <div className="px-5 py-4">
              <div className="text-xs text-gray-400 text-center">Agendamento realizado ✓</div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <NewAppointmentModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
          defaultDate={view === 'day' ? toIso(dayView) : toIso(new Date())}
        />
      )}
    </div>
  );
}
