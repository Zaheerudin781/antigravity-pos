import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useApp } from '../store/AppContext';

export default function CEODashboardPage() {
  const { notify } = useApp();
  const [metrics, setMetrics] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manage modal states
  const [manageTarget, setManageTarget] = useState(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states for manual override
  const [overrideTier, setOverrideTier] = useState('Free');
  const [overrideInterval, setOverrideInterval] = useState('monthly');
  const [overrideExpiryDays, setOverrideExpiryDays] = useState('30');

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/saas/ceo-metrics');
      if (data.success) {
        setMetrics(data.metrics);
        setRestaurants(data.restaurants || []);
      }
    } catch (err) {
      console.error('Failed to fetch SaaS CEO metrics:', err);
      notify('Failed to load SaaS CEO metrics. Access denied.', 'danger');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleOpenManage = (restaurant) => {
    setManageTarget(restaurant);
    setOverrideTier(restaurant.subscriptionTier);
    setOverrideInterval(restaurant.billingInterval);
    setOverrideExpiryDays('30');
    setManageOpen(true);
  };

  const handleSaveOverride = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put('/saas/update-restaurant-subscription', {
        restaurantId: manageTarget._id,
        tier: overrideTier,
        billingInterval: overrideInterval,
        expiryDays: overrideExpiryDays
      });
      if (data.success) {
        notify(`Subscription for "${manageTarget.businessName}" updated successfully!`);
        setManageOpen(false);
        fetchMetrics();
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Override update failed.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !metrics) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--text-muted)' }}>
        <div>Loading SaaS CEO Metrics Dashboard...</div>
      </div>
    );
  }

  // Filter restaurants based on search
  const filteredRestaurants = restaurants.filter(r => 
    r.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.email && r.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    r.tenantId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="ceo-dashboard-page" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      
      {/* SaaS Admin Banner */}
      <div className="card" style={{ padding: '20px 24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1b4b', border: '1px solid #312e81', borderRadius: '12px' }}>
        <div>
          <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', color: '#818cf8' }}>👑 SaaS Platform Administration Portal</span>
          <h1 style={{ fontSize: '28px', color: '#ffffff', marginTop: '4px', margin: 0 }}>CEO Business Decisions Dashboard</h1>
        </div>
        <button className="btn btn-outline" style={{ borderColor: '#818cf8', color: '#e0e7ff' }} onClick={fetchMetrics}>
          🔄 Refresh Metrics
        </button>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Registered Customers</div>
            <div style={{ fontSize: '36px', fontWeight: 'extrabold', color: 'var(--primary)', marginTop: '8px' }}>{metrics.totalRestaurants}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Active SaaS storefronts online</div>
          </div>
          
          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Recurring Revenue (MRR)</div>
            <div style={{ fontSize: '36px', fontWeight: 'extrabold', color: 'var(--success)', marginTop: '8px' }}>${metrics.mrr.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Normalized active billing volume</div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Annual Recurring Revenue (ARR)</div>
            <div style={{ fontSize: '36px', fontWeight: 'extrabold', color: '#06b6d4', marginTop: '8px' }}>${metrics.arr.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Projected run-rate based on active users</div>
          </div>

          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform-Wide Orders</div>
            <div style={{ fontSize: '36px', fontWeight: 'extrabold', color: 'var(--text-primary)', marginTop: '8px' }}>{metrics.totalOrders.toLocaleString()}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Total transactions processed successfully</div>
          </div>
        </div>
      )}

      {/* Subscription Breakdown & Visual Splits */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px', marginBottom: '40px' }}>
          
          {/* Subscription Tiers Distribution */}
          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Subscription Tier Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(metrics.plans).map(([tier, count]) => {
                const percent = metrics.totalRestaurants > 0 ? Math.round((count / metrics.totalRestaurants) * 100) : 0;
                let color = 'var(--primary)';
                if (tier === 'Free') color = 'var(--gray-500)';
                else if (tier === 'Small') color = '#fbbf24';
                else if (tier === 'Medium') color = '#22c55e';
                else if (tier === 'Large') color = '#ec4899';

                return (
                  <div key={tier}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                      <strong style={{ color }}>{tier} Plan</strong>
                      <span style={{ color: 'var(--text-muted)' }}>{count} Accounts ({percent}%)</span>
                    </div>
                    <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percent}%`, backgroundColor: color, borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subscription Expiry / Trial Status Splits */}
          <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <h2 style={{ fontSize: '18px', marginBottom: '20px' }}>Subscription Status Split</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <strong>Active (Paying) Accounts</strong>
                  <span style={{ color: 'var(--success)' }}>{metrics.status.active}</span>
                </div>
                <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.totalRestaurants > 0 ? (metrics.status.active / metrics.totalRestaurants) * 100 : 0}%`, backgroundColor: 'var(--success)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <strong>Free Trial Accounts</strong>
                  <span style={{ color: 'var(--primary)' }}>{metrics.status.trial}</span>
                </div>
                <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.totalRestaurants > 0 ? (metrics.status.trial / metrics.totalRestaurants) * 100 : 0}%`, backgroundColor: 'var(--primary)' }} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                  <strong>Expired / Suspended Accounts</strong>
                  <span style={{ color: 'var(--danger)' }}>{metrics.status.expired}</span>
                </div>
                <div style={{ height: '8px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${metrics.totalRestaurants > 0 ? (metrics.status.expired / metrics.totalRestaurants) * 100 : 0}%`, backgroundColor: 'var(--danger)' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Restaurants List Grid */}
      <div className="card" style={{ padding: '24px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', margin: 0 }}>All Registered Stores & Usage Logs</h2>
          <div style={{ width: '300px' }}>
            <input 
              className="form-input" 
              type="text" 
              placeholder="Search by restaurant name, email, slug..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              style={{ margin: 0 }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Store Name</th>
                <th style={{ padding: '12px 8px' }}>Email & Contacts</th>
                <th style={{ padding: '12px 8px' }}>Plan / Interval</th>
                <th style={{ padding: '12px 8px' }}>Monthly Usage</th>
                <th style={{ padding: '12px 8px' }}>Expiry Date</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRestaurants.length > 0 ? (
                filteredRestaurants.map((r) => {
                  let planLimit = r.subscriptionTier === 'Free' ? 50 : (r.subscriptionTier === 'Small' ? 700 : (r.subscriptionTier === 'Medium' ? 1200 : Infinity));
                  let limitDisplay = planLimit === Infinity ? 'Unlimited' : planLimit;
                  let percent = planLimit === Infinity ? 0 : Math.round((r.monthlyOrdersCount / planLimit) * 100);
                  let limitColor = percent > 85 ? 'var(--danger)' : (percent > 60 ? 'var(--warning)' : 'var(--text-primary)');

                  let planColor = '#818cf8';
                  if (r.subscriptionTier === 'Free') planColor = 'var(--text-muted)';
                  else if (r.subscriptionTier === 'Small') planColor = '#fbbf24';
                  else if (r.subscriptionTier === 'Medium') planColor = '#22c55e';
                  else if (r.subscriptionTier === 'Large') planColor = '#ec4899';

                  let statusText = r.subscriptionStatus;
                  let statusBg = 'rgba(99,102,241,0.1)';
                  let statusColor = 'var(--primary)';

                  if (statusText === 'expired') {
                    statusBg = 'rgba(239,68,68,0.1)';
                    statusColor = 'var(--danger)';
                  } else if (statusText === 'active') {
                    statusBg = 'rgba(34,197,94,0.1)';
                    statusColor = 'var(--success)';
                  }

                  return (
                    <tr key={r._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ fontWeight: 'bold' }}>{r.businessName}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {r.tenantId}</span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <div>{r.email || 'N/A'}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.phone || 'No phone'}</span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ fontWeight: 'bold', color: planColor }}>{r.subscriptionTier}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{r.billingInterval}</span>
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ color: limitColor, fontWeight: 'bold' }}>{r.monthlyOrdersCount} / {limitDisplay}</div>
                        {planLimit !== Infinity && (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{percent}% limit used</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 8px' }}>
                        <div>{r.subscriptionExpiry ? new Date(r.subscriptionExpiry).toLocaleDateString() : 'Never'}</div>
                        <span 
                          style={{
                            display: 'inline-block',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            marginTop: '4px',
                            backgroundColor: statusBg,
                            color: statusColor,
                            textTransform: 'uppercase'
                          }}
                        >
                          {statusText}
                        </span>
                      </td>
                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        <button className="btn btn-outline btn-sm" onClick={() => handleOpenManage(r)}>
                          ⚙️ Manage Plan
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No stores found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Subscription Override Modal */}
      {manageOpen && manageTarget && (
        <div className="modal-overlay" style={{ zIndex: 1400 }} onClick={() => !saving && setManageOpen(false)}>
          <div className="modal" style={{ maxWidth: '450px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '4px' }}>Manage Store Subscription</h2>
            <p className="text-muted text-sm" style={{ marginBottom: '24px' }}>
              Manually modify plan parameters for <strong>{manageTarget.businessName}</strong>.
            </p>

            <form onSubmit={handleSaveOverride}>
              <div className="form-group">
                <label className="form-label">Subscription Plan Tier</label>
                <select 
                  className="form-input" 
                  value={overrideTier} 
                  onChange={e => setOverrideTier(e.target.value)}
                  disabled={saving}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)' }}
                >
                  <option value="Free">Free Plan (50 orders)</option>
                  <option value="Small">Small Plan (700 orders)</option>
                  <option value="Medium">Medium Plan (1200 orders)</option>
                  <option value="Large">Large Plan (Unlimited)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Billing Interval Period</label>
                <select 
                  className="form-input" 
                  value={overrideInterval} 
                  onChange={e => setOverrideInterval(e.target.value)}
                  disabled={saving}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--surface-card)', color: 'var(--text-primary)' }}
                >
                  <option value="monthly">Monthly Cycle</option>
                  <option value="yearly">Yearly Cycle</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Extend Expiration By (Days from now)</label>
                <input 
                  className="form-input" 
                  type="number" 
                  min="0"
                  value={overrideExpiryDays} 
                  onChange={e => setOverrideExpiryDays(e.target.value)} 
                  required 
                  disabled={saving}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setManageOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={saving}>
                  {saving ? 'Saving changes...' : 'Apply Overrides'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
