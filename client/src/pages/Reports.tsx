import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../lib/api';
import Page from '../components/Page';

interface Overview {
  total: number;
  completed: number;
  cancelled: number;
  confirmed: number;
  pending: number;
  revenue: number;
  avg_ticket: number;
  unique_clients: number;
}

interface DayRevenue {
  date: string;
  revenue: number;
  count: number;
}

interface TopService {
  name: string;
  color: string;
  count: number;
  revenue: number;
}

interface ByProfessional {
  name: string;
  color: string;
  commission_pct: number;
  count: number;
  revenue: number;
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(m: string) {
  const [y, mo] = m.split('-');
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  return `${names[Number(mo) - 1]}/${y}`;
}

function daysInMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}

function prevMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function barChart(canvas: HTMLCanvasElement, days: DayRevenue[], month: string) {
  const total = daysInMonth(month);
  const [y, mo] = month.split('-').map(Number);
  const byDate: Record<string, number> = {};
  days.forEach(d => { byDate[d.date] = d.revenue; });

  const data = Array.from({ length: total }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, '0')}`;
    return byDate[d] ?? 0;
  });

  const W = canvas.parentElement!.offsetWidth;
  const H = 160;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);

  const maxV = Math.max(...data, 1);
  const pad = { l: 4, r: 4, t: 12, b: 20 };
  const barW = (W - pad.l - pad.r) / total;
  const gap = Math.max(barW * 0.15, 1);
  const today = new Date();

  // horizontal guide lines
  ctx.strokeStyle = '#f0f0ef';
  ctx.lineWidth = 1;
  [0.25, 0.5, 0.75, 1].forEach(pct => {
    const y = pad.t + (H - pad.t - pad.b) * (1 - pct);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
  });

  data.forEach((v, i) => {
    const x = pad.l + i * barW;
    const barH = ((v / maxV) * (H - pad.t - pad.b));
    const y2 = H - pad.b;
    const isToday = (y === today.getFullYear() &&
      mo - 1 === today.getMonth() && i + 1 === today.getDate());

    // bar
    const barX = x + gap / 2;
    const bW = barW - gap;
    ctx.fillStyle = isToday ? '#3A6650' : (v > 0 ? '#6BAA88' : '#e5e7e6');
    ctx.fillRect(barX, y2 - barH, bW, barH);

    // day label every 5 days
    if ((i + 1) % 5 === 0 || i === 0 || i === total - 1) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), barX + bW / 2, H - 4);
    }
  });
}

export default function Reports() {
  const [month, setMonth] = useState(currentMonth);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dayRevenue, setDayRevenue] = useState<DayRevenue[]>([]);
  const [topServices, setTopServices] = useState<TopService[]>([]);
  const [byPro, setByPro] = useState<ByProfessional[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRef = useRef<HTMLCanvasElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [y, mo] = month.split('-').map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(y, mo, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;

    try {
      const [ov, dr, ts, bp] = await Promise.all([
        api.get('/reports/overview', { params: { from, to } }),
        api.get('/reports/revenue-by-day', { params: { month } }),
        api.get('/reports/top-services', { params: { from, to } }),
        api.get('/reports/by-professional', { params: { from, to } }),
      ]);
      setOverview(ov.data);
      setDayRevenue(dr.data);
      setTopServices(ts.data);
      setByPro(bp.data);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (chartRef.current && !loading) {
      try {
        barChart(chartRef.current, dayRevenue, month);
      } catch (e) {
        console.error('Chart render error:', e);
      }
    }
  }, [dayRevenue, loading, month]);

  useEffect(() => {
    const onResize = () => {
      if (chartRef.current && dayRevenue.length >= 0) barChart(chartRef.current, dayRevenue, month);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dayRevenue, month]);

  const occupancy = overview
    ? overview.total > 0 ? Math.round((overview.completed / Math.max(overview.total, 1)) * 100) : 0
    : 0;

  const maxRevenue = Math.max(...topServices.map(s => s.revenue), 1);

  return (
    <Page>
      <div className="space-y-6">
        {/* header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500 mt-1">Desempenho da clínica por período</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <button onClick={() => setMonth(prevMonth(month))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 font-bold">‹</button>
            <span className="text-sm font-semibold text-gray-900 w-20 text-center tabular-nums">{monthLabel(month)}</span>
            <button
              onClick={() => setMonth(nextMonth(month))}
              disabled={month >= currentMonth()}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 text-gray-500 font-bold disabled:opacity-30"
            >›</button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Faturamento', value: formatCurrency(overview?.revenue ?? 0), sub: `${overview?.completed ?? 0} realizados`, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'Ticket médio', value: formatCurrency(overview?.avg_ticket ?? 0), sub: `${overview?.total ?? 0} agendamentos`, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Taxa de realização', value: `${occupancy}%`, sub: `${overview?.cancelled ?? 0} cancelados`, color: 'text-primary-700', bg: 'bg-primary-50' },
            { label: 'Clientes únicas', value: String(overview?.unique_clients ?? 0), sub: `${overview?.pending ?? 0} aguardando`, color: 'text-purple-700', bg: 'bg-purple-50' },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className={`text-xs font-bold uppercase tracking-wide mb-2 ${k.color}`}>{k.label}</div>
              <div className="text-2xl font-bold text-gray-900 tabular-nums">{loading ? '—' : k.value}</div>
              <div className="text-xs text-gray-400 mt-1">{loading ? '' : k.sub}</div>
            </div>
          ))}
        </div>

        {/* Revenue chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">Faturamento diário — {monthLabel(month)}</h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-700 inline-block" />
                Hoje
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-green-300 inline-block" />
                Com atendimento
              </span>
            </div>
          </div>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-gray-300 text-sm">Carregando…</div>
          ) : (
            <canvas ref={chartRef} style={{ width: '100%', height: 160, display: 'block' }} />
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top services */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Top serviços por faturamento</h2>
            {loading ? (
              <div className="text-center text-gray-300 text-sm py-8">Carregando…</div>
            ) : topServices.length === 0 ? (
              <div className="text-center text-gray-300 text-sm py-8">Nenhum serviço realizado</div>
            ) : (
              <div className="space-y-3">
                {topServices.map((s, i) => (
                  <div key={s.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color || '#6D5BBA' }} />
                        <span className="font-medium text-gray-900 truncate">{s.name}</span>
                        <span className="text-gray-400 text-xs flex-shrink-0">{s.count}×</span>
                      </div>
                      <span className="font-semibold text-primary-700 tabular-nums ml-3 flex-shrink-0">
                        {formatCurrency(s.revenue)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(s.revenue / maxRevenue) * 100}%`, background: s.color || '#6D5BBA', opacity: 0.7 + (0.3 * (1 - i / topServices.length)) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* By professional */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Por profissional</h2>
            {loading ? (
              <div className="text-center text-gray-300 text-sm py-8">Carregando…</div>
            ) : byPro.length === 0 ? (
              <div className="text-center text-gray-300 text-sm py-8">Nenhum dado disponível</div>
            ) : (
              <div className="space-y-3">
                {byPro.map(p => {
                  const commission = p.revenue * ((p.commission_pct || 0) / 100);
                  return (
                    <div key={p.name} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                        style={{ background: p.color || '#3A6650' }}
                      >
                        {p.name.split(' ').slice(0, 2).map((w: string) => w[0]).join('')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.count} atend. · comissão {p.commission_pct || 0}%</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(p.revenue)}</div>
                        <div className="text-xs text-green-600 font-semibold tabular-nums">{formatCurrency(commission)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        {overview && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="text-sm font-bold text-gray-900 mb-4">Distribuição de status — {overview.total} agendamentos</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Realizados',   val: overview.completed,  color: '#16a34a', bg: '#dcfce7' },
                { label: 'Confirmados',  val: overview.confirmed,  color: '#2563eb', bg: '#dbeafe' },
                { label: 'Aguardando',   val: overview.pending,    color: '#d97706', bg: '#fef3c7' },
                { label: 'Cancelados',   val: overview.cancelled,  color: '#dc2626', bg: '#fee2e2' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: s.bg }}>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-xs font-semibold mt-1" style={{ color: s.color }}>{s.label}</div>
                  {overview.total > 0 && (
                    <div className="text-xs mt-0.5" style={{ color: s.color, opacity: 0.7 }}>
                      {Math.round((s.val / overview.total) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
