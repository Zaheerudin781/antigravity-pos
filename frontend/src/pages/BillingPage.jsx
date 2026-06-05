import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useApp } from '../store/AppContext';

export default function BillingPage() {
  const { notify } = useApp();
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form states for checkout
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCVC, setCardCVC] = useState('');

  const fetchBillingStatus = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/restaurant/billing-status');
      if (data.success) {
        setBilling(data.billing);
        setIsYearly(data.billing.billingInterval === 'yearly');
      }
    } catch (err) {
      console.error('Failed to fetch billing status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingStatus();
  }, []);

  const handleOpenCheckout = (plan) => {
    setSelectedPlan(plan);
    setCheckoutOpen(true);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    
    // Simulate payment processing delay
    setTimeout(async () => {
      try {
        const { data } = await api.put('/restaurant/subscription', {
          tier: selectedPlan.tier,
          billingInterval: isYearly ? 'yearly' : 'monthly'
        });
        if (data.success) {
          notify(`Successfully upgraded to ${selectedPlan.tier} Plan!`);
          setCheckoutOpen(false);
          fetchBillingStatus();
          // Reset card info
          setCardName('');
          setCardNumber('');
          setCardExpiry('');
          setCardCVC('');
        }
      } catch (err) {
        notify(err.response?.data?.message || 'Upgrade failed. Please try again.', 'danger');
      } finally {
        setProcessing(false);
      }
    }, 1500);
  };

  if (loading && !billing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--text-muted)' }}>
        <div>Loading billing information...</div>
      </div>
    );
  }

  const plans = [
    {
      tier: 'Free',
      name: 'Free Trial',
      priceMonthly: 0,
      priceYearly: 0,
      limit: 50,
      features: ['Up to 50 monthly orders', 'Dynamic table management', 'Staff PIN authentication', 'Basic sales reporting', 'Online digital menu']
    },
    {
      tier: 'Small',
      name: 'Small Business',
      priceMonthly: 29,
      priceYearly: 290,
      limit: 700,
      features: ['Up to 700 monthly orders', 'Priority queue routing', 'Advanced inventory logging', 'Room & table layouts', 'Dynamic modifier add-ons', 'Daily sales reports']
    },
    {
      tier: 'Medium',
      name: 'Professional Bistro',
      priceMonthly: 59,
      priceYearly: 590,
      limit: 1200,
      features: ['Up to 1,200 monthly orders', 'Unlimited staff codes', 'Real-time WebSocket alerts', 'Detailed analytics reports', 'Custom receipts & logo branding', '24/7 Priority support']
    },
    {
      tier: 'Large',
      name: 'Enterprise / Large',
      priceMonthly: 129,
      priceYearly: 1290,
      limit: 'Unlimited',
      features: ['Unlimited monthly orders', 'Multiple dining sections', 'Complete multi-terminal sharding', 'Comprehensive CSV data exports', 'Dedicated account manager', '99.9% Server uptime SLA']
    }
  ];

  // Calculate order usage percentages
  const currentCount = billing?.monthlyOrdersCount || 0;
  const limitValue = billing?.limit === Infinity ? 'Unlimited' : (billing?.limit || 50);
  const isUnlimited = billing?.limit === Infinity;
  const percent = isUnlimited ? 0 : Math.min(100, Math.round((currentCount / billing?.limit) * 100));

  let progressColor = 'var(--success)';
  if (percent > 85) progressColor = 'var(--danger)';
  else if (percent > 60) progressColor = 'var(--warning)';

  return (
    <div className="billing-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="billing-header" style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', marginBottom: '8px', color: 'var(--text-primary)' }}>SaaS Subscriptions & Billing</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage your restaurant plan, check order limits, or renew subscriptions.</p>
      </div>

      {/* Usage card */}
      {billing && (
        <div className="card" style={{ padding: '24px', marginBottom: '40px', backgroundColor: 'var(--surface-card)', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Current Subscription & Monthly Usage</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Plan</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--primary)', marginTop: '4px' }}>
                {billing.tier} Plan <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-muted)' }}>({billing.billingInterval})</span>
              </div>
              <div style={{ marginTop: '8px', fontSize: '14px' }}>
                Status: <span style={{ color: billing.status === 'active' ? 'var(--success)' : 'var(--warning)', fontWeight: 'bold', textTransform: 'capitalize' }}>{billing.status}</span>
              </div>
              {billing.expiry && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Next renewal date: {new Date(billing.expiry).toLocaleDateString()}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monthly Order Consumption:</span>
                <strong style={{ color: progressColor }}>{currentCount} / {limitValue} orders</strong>
              </div>
              {!isUnlimited ? (
                <div style={{ height: '12px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${percent}%`, backgroundColor: progressColor, borderRadius: '6px', transition: 'width 0.4s ease' }} />
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--success)', fontWeight: 'bold' }}>✓ Unlimited orders included in Large Plan.</div>
              )}
              {!isUnlimited && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px', textAlign: 'right' }}>
                  {percent}% of monthly limit consumed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interval toggle */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <span style={{ fontWeight: !isYearly ? 'bold' : 'normal', color: !isYearly ? 'var(--text-primary)' : 'var(--text-muted)' }}>Monthly Billing</span>
        <button 
          onClick={() => setIsYearly(!isYearly)}
          style={{
            width: '56px',
            height: '28px',
            borderRadius: '14px',
            backgroundColor: 'var(--primary)',
            border: 'none',
            position: 'relative',
            cursor: 'pointer',
            padding: '2px',
            transition: 'background-color 0.2s'
          }}
        >
          <div 
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'white',
              position: 'absolute',
              top: '2px',
              left: isYearly ? '30px' : '2px',
              transition: 'left 0.2s ease-in-out'
            }}
          />
        </button>
        <span style={{ fontWeight: isYearly ? 'bold' : 'normal', color: isYearly ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          Yearly Billing <span style={{ color: 'var(--success)', fontSize: '12px', fontWeight: 'bold', marginLeft: '4px', padding: '2px 6px', backgroundColor: 'rgba(40,167,69,0.1)', borderRadius: '4px' }}>SAVE 20%</span>
        </span>
      </div>

      {/* Plans pricing grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
        {plans.map((p) => {
          const isCurrent = billing?.tier === p.tier;
          const price = isYearly ? p.priceYearly : p.priceMonthly;
          const priceText = p.tier === 'Free' ? 'Free' : `$${price}`;
          const periodText = p.tier === 'Free' ? '' : (isYearly ? '/yr' : '/mo');

          return (
            <div 
              key={p.tier} 
              className="card"
              style={{
                padding: '30px 24px',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                backgroundColor: 'var(--surface-card)',
                boxShadow: isCurrent ? '0 8px 24px rgba(99,102,241,0.15)' : '0 4px 12px rgba(0,0,0,0.05)',
                position: 'relative',
                transform: isCurrent ? 'scale(1.02)' : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              {isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Current Plan
                </div>
              )}
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{p.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: '16px', gap: '4px' }}>
                <span style={{ fontSize: '36px', fontWeight: 'extrabold', color: 'var(--text-primary)' }}>{priceText}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{periodText}</span>
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                Order Limit: <strong>{p.limit} orders/month</strong>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {p.features.map((f, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--success)' }}>✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button 
                className={`btn ${isCurrent ? 'btn-outline' : 'btn-primary'}`}
                disabled={isCurrent || p.tier === 'Free'}
                onClick={() => handleOpenCheckout(p)}
                style={{ width: '100%' }}
              >
                {isCurrent ? 'Current Plan' : (p.tier === 'Free' ? 'Sign up' : `Upgrade to ${p.tier}`)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && selectedPlan && (
        <div className="modal-overlay" style={{ zIndex: 1400 }} onClick={() => !processing && setCheckoutOpen(false)}>
          <div className="modal" style={{ maxWidth: '450px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '8px' }}>Checkout: Upgrade Restaurant</h2>
            <p className="text-muted text-sm" style={{ marginBottom: '24px' }}>
              Confirm your subscription to <strong>{selectedPlan.name}</strong> ({isYearly ? 'Yearly' : 'Monthly'} Plan).
            </p>

            <div style={{ padding: '16px', backgroundColor: 'var(--surface-hover)', borderRadius: '8px', marginBottom: '24px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}>
                <span>{selectedPlan.name} Plan:</span>
                <span>${isYearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly} / {isYearly ? 'yr' : 'mo'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Billing Cycle:</span>
                <span>{isYearly ? 'Yearly (20% discount included)' : 'Monthly'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                <span>Order Limit:</span>
                <span>{selectedPlan.limit} per month</span>
              </div>
            </div>

            <form onSubmit={handleCheckoutSubmit}>
              <div className="form-group">
                <label className="form-label">Cardholder Name</label>
                <input className="form-input" type="text" placeholder="Johnathan Doe" value={cardName} onChange={e => setCardName(e.target.value)} required disabled={processing} />
              </div>
              <div className="form-group">
                <label className="form-label">Card Number</label>
                <input className="form-input" type="text" placeholder="4111 2222 3333 4444" value={cardNumber} onChange={e => setCardNumber(e.target.value)} required disabled={processing} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Expiration (MM/YY)</label>
                  <input className="form-input" type="text" placeholder="12/28" value={cardExpiry} onChange={e => setCardExpiry(e.target.value)} required disabled={processing} />
                </div>
                <div className="form-group">
                  <label className="form-label">CVC</label>
                  <input className="form-input" type="text" placeholder="123" value={cardCVC} onChange={e => setCardCVC(e.target.value)} required disabled={processing} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => setCheckoutOpen(false)} disabled={processing}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={processing}>
                  {processing ? 'Processing Secure Payment...' : `Pay $${isYearly ? selectedPlan.priceYearly : selectedPlan.priceMonthly}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
