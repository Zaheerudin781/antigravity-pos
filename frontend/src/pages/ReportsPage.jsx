import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, gradient, pulse }) {
  return (
    <div style={{
      background: gradient || 'white',
      borderRadius: 14,
      padding: '18px 20px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.13)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute', right: -10, top: -10,
        width: 70, height: 70, borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
      }} />
      <div style={{ fontSize: 22, lineHeight: 1 }}>{icon}</div>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
        color: gradient ? 'rgba(255,255,255,0.85)' : 'var(--gray-500)',
      }}>{label}</div>
      <div style={{
        fontSize: 24, fontWeight: 800, lineHeight: 1.1,
        color: gradient ? 'white' : 'var(--gray-800)',
      }}>{value}</div>
      {sub && (
        <div style={{
          fontSize: 10, color: gradient ? 'rgba(255,255,255,0.7)' : 'var(--gray-400)',
        }}>{sub}</div>
      )}
    </div>
  );
}

// ── Inline Bar Chart ──────────────────────────────────────────────────────────
function BarChart({ data, sym }) {
  const max = data.length > 0 ? Math.max(...data.map(d => d.revenue)) : 1;
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 4px' }}>
      {data.map((item, idx) => {
        const pct = max > 0 ? Math.max(4, (item.revenue / max) * 100) : 4;
        const label = item.date ? item.date.split('-').slice(1).join('/') : '';
        const isHov = hovered === idx;
        return (
          <div
            key={idx}
            style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'flex-end', 
              alignItems: 'center', 
              gap: 4, 
              cursor: 'pointer', 
              position: 'relative',
              height: '100%'
            }}
            onMouseEnter={() => setHovered(idx)}
            onMouseLeave={() => setHovered(null)}
          >
            {isHov && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                background: '#1a1a2e', color: 'white', borderRadius: 6, padding: '4px 8px',
                fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', zIndex: 10, marginBottom: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>
                {sym}{item.revenue.toFixed(0)} · {item.orders || 0} orders
              </div>
            )}
            <div style={{
              width: '100%', height: `${pct}%`,
              background: isHov
                ? 'linear-gradient(to top, #1565c0, #42a5f5)'
                : 'linear-gradient(to top, #2196f3, #90caf9)',
              borderRadius: '4px 4px 0 0',
              transition: 'all 0.18s ease',
              boxShadow: isHov ? '0 4px 14px rgba(33,150,243,0.4)' : 'none',
            }} />
            <span style={{ fontSize: 9, color: 'var(--gray-500)', fontWeight: 600 }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Progress Bar Row ──────────────────────────────────────────────────────────
function ProgressRow({ label, value, max, sym, color, rank }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const rankColors = ['#f59e0b', '#94a3b8', '#cd7c54'];
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rank !== undefined && rank < 3 && (
            <span style={{
              width: 20, height: 20, borderRadius: '50%',
              background: rankColors[rank] || 'var(--gray-300)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 800, color: 'white', flexShrink: 0,
            }}>{rank + 1}</span>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>{label}</span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: color || 'var(--primary-dark)' }}>
          {sym}{value.toFixed(2)}
        </span>
      </div>
      <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`,
          background: color || 'var(--primary)',
          borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const { state, notify } = useApp();
  const { restaurant } = state;
  const [range, setRange] = useState('daily');
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);

  const [salesSummary, setSalesSummary] = useState({
    grossSales: 0, netSales: 0, taxCollected: 0,
    totalCOGS: 0, netProfit: 0, profitMargin: 0,
    totalOrders: 0, avgOrderValue: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [bestSellers, setBestSellers] = useState([]);
  const [deadStock, setDeadStock] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [tablePerformance, setTablePerformance] = useState([]);
  const [roomPerformance, setRoomPerformance] = useState([]);
  const [orderTypePerformance, setOrderTypePerformance] = useState([]);
  const [staffReport, setStaffReport] = useState([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let salesUrl = `/reports/sales?range=${range}`;
      let staffUrl = `/reports/staff?range=${range}`;
      if (useCustomDates && startDate && endDate) {
        salesUrl = `/reports/sales?startDate=${startDate}&endDate=${endDate}`;
        staffUrl = `/reports/staff?startDate=${startDate}&endDate=${endDate}`;
      }
      const [salesRes, staffRes] = await Promise.all([api.get(salesUrl), api.get(staffUrl)]);
      setSalesSummary(salesRes.data.summary);
      setChartData(salesRes.data.chartData || []);
      setBestSellers(salesRes.data.bestSellers || []);
      setDeadStock(salesRes.data.deadStock || []);
      setCategoryBreakdown(salesRes.data.categoryBreakdown || []);
      setTablePerformance(salesRes.data.tablePerformance || []);
      setRoomPerformance(salesRes.data.roomPerformance || []);
      setOrderTypePerformance(salesRes.data.orderTypePerformance || []);
      setStaffReport(staffRes.data.staffReport || []);
    } catch {
      notify('Error loading reports', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReports(); }, [range, startDate, endDate, useCustomDates]);

  const handleExportCSV = async () => {
    try {
      let url = `/reports/export?range=${range}`;
      if (useCustomDates && startDate && endDate) url = `/reports/export?startDate=${startDate}&endDate=${endDate}`;
      const res = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `report-${useCustomDates ? 'custom' : range}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('CSV exported!');
    } catch {
      notify('Export failed', 'error');
    }
  };

  const sym = restaurant?.currencySymbol || '$';
  const maxCatRevenue = categoryBreakdown.length > 0 ? Math.max(...categoryBreakdown.map(c => c.revenue)) : 1;
  const maxTableRevenue = tablePerformance.length > 0 ? Math.max(...tablePerformance.map(t => t.revenue)) : 1;
  const maxRoomRevenue = roomPerformance.length > 0 ? Math.max(...roomPerformance.map(r => r.revenue)) : 1;
  const maxBestSeller = bestSellers.length > 0 ? Math.max(...bestSellers.map(b => b.revenue)) : 1;

  const typeIcon = { 'Dine-In': '🍽️', 'Takeaway': '🛍️', 'Delivery': '🛵' };
  const typeColor = { 'Dine-In': '#2196f3', 'Takeaway': '#ff9800', 'Delivery': '#9c27b0' };
  const totalTypeRevenue = orderTypePerformance.reduce((s, t) => s + t.revenue, 0);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 14 }}>
      <div className="spinner" />
      <span style={{ fontSize: 12, color: 'var(--gray-400)', fontWeight: 600 }}>Loading analytics…</span>
    </div>
  );

  return (
    <div style={{ paddingBottom: 48 }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 4 }}>
            📊 Analytics &amp; Reports
          </h1>
          <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {useCustomDates && startDate && endDate
              ? `Showing data from ${startDate} to ${endDate}`
              : `${range.charAt(0).toUpperCase() + range.slice(1)} overview`}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Quick ranges */}
          <div style={{ display: 'flex', background: 'var(--gray-100)', borderRadius: 10, padding: 3, gap: 2 }}>
            {['daily', 'weekly', 'monthly'].map(r => (
              <button
                key={r}
                onClick={() => { setUseCustomDates(false); setRange(r); }}
                style={{
                  padding: '5px 14px', borderRadius: 8, border: 'none', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: !useCustomDates && range === r ? 'white' : 'transparent',
                  color: !useCustomDates && range === r ? 'var(--primary)' : 'var(--gray-500)',
                  boxShadow: !useCustomDates && range === r ? '0 1px 6px rgba(0,0,0,0.12)' : 'none',
                }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {/* Custom range */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="date"
              className="form-input"
              style={{ padding: '5px 8px', fontSize: 11, height: 34, width: 130 }}
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setUseCustomDates(true); }}
            />
            <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>→</span>
            <input
              type="date"
              className="form-input"
              style={{ padding: '5px 8px', fontSize: 11, height: 34, width: 130 }}
              value={endDate}
              onChange={e => { setEndDate(e.target.value); setUseCustomDates(true); }}
            />
            {useCustomDates && (
              <button
                className="btn btn-sm btn-outline"
                onClick={() => { setUseCustomDates(false); setStartDate(''); setEndDate(''); }}
                style={{ height: 34, fontSize: 10 }}
              >✕ Reset</button>
            )}
          </div>

          <button
            onClick={handleExportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #2e7d32, #4caf50)',
              color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(76,175,80,0.35)',
            }}
          >
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard
          icon="💰" label="Gross Sales" sub="Total check volume incl. tax"
          value={`${sym}${salesSummary.grossSales.toFixed(2)}`}
          gradient="linear-gradient(135deg, #1565c0, #2196f3)"
        />
        <KpiCard
          icon="📈" label="Net Sales" sub="Excl. collected sales tax"
          value={`${sym}${salesSummary.netSales.toFixed(2)}`}
          gradient="linear-gradient(135deg, #1b5e20, #4caf50)"
        />
        <KpiCard
          icon="🏷️" label="COGS" sub="Ingredient & item cost prices"
          value={`${sym}${salesSummary.totalCOGS.toFixed(2)}`}
          gradient="linear-gradient(135deg, #b71c1c, #f44336)"
        />
        <KpiCard
          icon="✨" label="Net Profit" sub="Net Sales − COGS"
          value={`${sym}${salesSummary.netProfit.toFixed(2)}`}
          gradient={salesSummary.netProfit >= 0
            ? 'linear-gradient(135deg, #4a148c, #9c27b0)'
            : 'linear-gradient(135deg, #b71c1c, #e53935)'}
        />
        <KpiCard
          icon="📊" label="Profit Margin" sub="Net Profit / Net Sales"
          value={`${salesSummary.profitMargin.toFixed(1)}%`}
          gradient="linear-gradient(135deg, #e65100, #ff9800)"
        />
        <KpiCard
          icon="🧾" label="Orders" sub="Completed transactions"
          value={salesSummary.totalOrders}
        />
        <KpiCard
          icon="💳" label="Avg. Order (AOV)" sub="Average check size"
          value={`${sym}${salesSummary.avgOrderValue.toFixed(2)}`}
        />
      </div>

      {/* ── Revenue Chart ─────────────────────────────────────────── */}
      <div style={{
        background: 'white', borderRadius: 14, padding: '20px 24px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 2 }}>
              📈 Revenue Trend
            </h2>
            <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>Hover bars for details</p>
          </div>
          <span style={{
            background: 'var(--primary-light)', color: 'var(--primary-dark)',
            borderRadius: 20, padding: '3px 12px', fontSize: 10, fontWeight: 700,
          }}>
            {chartData.length} data points
          </span>
        </div>
        {chartData.length === 0 ? (
          <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)', fontSize: 12 }}>
            📭 No sales data for this period
          </div>
        ) : (
          <BarChart data={chartData} sym={sym} />
        )}
      </div>

      {/* ── Row: Best Sellers + Order Type ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        
        {/* Best Sellers */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
            🔥 Best Selling Items
          </h2>
          {bestSellers.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No items sold yet</p>
          ) : (
            bestSellers.slice(0, 7).map((item, i) => (
              <ProgressRow key={i} rank={i} label={item.name} value={item.revenue} max={maxBestSeller} sym={sym} color="#2196f3" />
            ))
          )}
        </div>

        {/* Order Type Breakdown */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
            🛵 Order Type Breakdown
          </h2>
          {orderTypePerformance.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No order type data</p>
          ) : (
            <>
              {orderTypePerformance.map((item, i) => {
                const pct = totalTypeRevenue > 0 ? (item.revenue / totalTypeRevenue) * 100 : 0;
                const col = typeColor[item.type] || '#6c757d';
                return (
                  <div key={i} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ fontSize: 16 }}>{typeIcon[item.type] || '📦'}</span>
                        <span style={{ fontSize: 12, fontWeight: 700 }}>{item.type}</span>
                        <span style={{
                          background: 'var(--gray-100)', borderRadius: 10, padding: '1px 7px',
                          fontSize: 10, fontWeight: 700, color: 'var(--gray-600)',
                        }}>{item.count} orders</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: col }}>{sym}{item.revenue.toFixed(2)}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: col, borderRadius: 4, transition: 'width 0.6s ease' }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2 }}>{pct.toFixed(1)}% of total revenue</div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Row: Category + Dead Stock ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        
        {/* Category Breakdown */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
            📂 Revenue by Category
          </h2>
          {categoryBreakdown.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No category sales data</p>
          ) : (
            categoryBreakdown.map((cat, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: `hsl(${(i * 51) % 360}, 65%, 52%)`, flexShrink: 0,
                    }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>{cat.category}</span>
                    <span style={{
                      background: 'var(--gray-100)', borderRadius: 10, padding: '1px 6px',
                      fontSize: 10, fontWeight: 700, color: 'var(--gray-500)',
                    }}>{cat.qty} items</span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-800)' }}>{sym}{cat.revenue.toFixed(2)}</span>
                </div>
                <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${maxCatRevenue > 0 ? (cat.revenue / maxCatRevenue) * 100 : 0}%`,
                    background: `hsl(${(i * 51) % 360}, 65%, 52%)`,
                    borderRadius: 4, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Dead Stock */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>🧊 Dead Stock</h2>
            {deadStock.length > 0 && (
              <span style={{
                background: '#fff3e0', color: '#e65100', borderRadius: 20,
                padding: '2px 10px', fontSize: 10, fontWeight: 700,
              }}>{deadStock.length} items zero sales</span>
            )}
          </div>
          {deadStock.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
              <p style={{ color: 'var(--gray-400)', fontSize: 12 }}>All items have sold in this period!</p>
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {deadStock.map((item, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--gray-100)',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>{item.name}</div>
                    <div style={{
                      display: 'inline-block', marginTop: 2,
                      background: 'var(--gray-100)', borderRadius: 10, padding: '1px 7px',
                      fontSize: 9, fontWeight: 700, color: 'var(--gray-500)',
                    }}>{item.category}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)' }}>{sym}{item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row: Table + Room Performance ───────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
        
        {/* Table Performance */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
            🪑 Revenue by Table <span style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 500 }}>Dine-In only</span>
          </h2>
          {tablePerformance.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No table sales data</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {tablePerformance.map((table, i) => (
                <ProgressRow key={i} rank={i} label={table.tableName}
                  value={table.revenue} max={maxTableRevenue} sym={sym} color="#9c27b0" />
              ))}
            </div>
          )}
        </div>

        {/* Room Performance */}
        <div style={{ background: 'white', borderRadius: 14, padding: '20px 20px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
            🏢 Revenue by Room / Floor
          </h2>
          {roomPerformance.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No room sales data</p>
          ) : (
            roomPerformance.map((room, i) => (
              <ProgressRow key={i} rank={i} label={room.roomName}
                value={room.revenue} max={maxRoomRevenue} sym={sym} color="#ff9800" />
            ))
          )}
        </div>
      </div>

      {/* ── Staff Leaderboard ──────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 14, padding: '20px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
        <h2 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, color: 'var(--gray-800)' }}>
          🏆 Staff Performance Leaderboard
        </h2>
        {staffReport.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No staff sales in this period</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {staffReport.map((staff, i) => {
              const medals = ['🥇', '🥈', '🥉'];
              const gradients = [
                'linear-gradient(135deg, #f59e0b, #fbbf24)',
                'linear-gradient(135deg, #94a3b8, #cbd5e1)',
                'linear-gradient(135deg, #cd7c54, #d4956e)',
              ];
              return (
                <div key={i} style={{
                  background: i < 3 ? gradients[i] : 'var(--gray-50)',
                  borderRadius: 12, padding: '14px 16px',
                  boxShadow: i < 3 ? '0 4px 14px rgba(0,0,0,0.12)' : 'none',
                  border: i >= 3 ? '1px solid var(--gray-200)' : 'none',
                }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>{medals[i] || '👤'}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: i < 3 ? 'white' : 'var(--gray-800)', marginBottom: 2 }}>
                    {staff.name}
                  </div>
                  <div style={{ fontSize: 11, color: i < 3 ? 'rgba(255,255,255,0.8)' : 'var(--gray-500)', marginBottom: 8 }}>
                    {staff.orders} orders handled
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: i < 3 ? 'white' : 'var(--primary-dark)' }}>
                    {sym}{staff.revenue.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
