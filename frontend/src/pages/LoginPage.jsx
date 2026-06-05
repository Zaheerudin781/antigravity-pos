import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

export default function LoginPage() {
  const { dispatch, notify } = useApp();
  const [tab, setTab] = useState('login'); // login | pin | register
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', businessName: '', tenantId: '' });

  // PIN Login States
  const [tenantId, setTenantId] = useState(localStorage.getItem('pos_last_tenant') || '');
  const [pinInput, setPinInput] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email: form.email, password: form.password, tenantId: form.tenantId });
      if (!data.success) throw new Error(data.message || 'Login failed');
      dispatch({ type: 'LOGIN', payload: data });
      notify(`Welcome back, ${data.user.name}!`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(`${msg} (email: ${form.email})`);
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      if (!data.success) throw new Error(data.message || 'Registration failed');
      dispatch({ type: 'LOGIN', payload: data });
      notify(`Restaurant "${form.businessName}" registered! Your Restaurant ID: ${data.user.tenantId}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      setError(msg);
    } finally { setLoading(false); }
  };

  const handlePinDigit = (digit) => {
    if (!tenantId) {
      setError('Please enter your Restaurant ID first.');
      return;
    }
    setError('');
    if (pinInput.length < 4) {
      const nextPin = pinInput + digit;
      setPinInput(nextPin);
      if (nextPin.length === 4) {
        submitPin(nextPin);
      }
    }
  };

  const handlePinBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    setPinInput('');
  };

  const submitPin = async (pin) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/staff-pin', { pin, tenantId });
      
      // Save last used tenant slug for quick check-in next time
      localStorage.setItem('pos_last_tenant', tenantId);

      // Dispatch unified user context mapping staff key
      dispatch({
        type: 'LOGIN',
        payload: {
          token: data.token,
          user: { id: data.staff.id, name: data.staff.name, role: data.staff.role, tenantId },
          restaurant: data.restaurant
        }
      });
      notify(`Checked in: ${data.staff.name} (${data.staff.role})`);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid PIN or Tenant ID');
      setPinInput('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: tab === 'pin' ? '440px' : '420px' }}>
        <div className="login-card__logo">
          <div className="login-card__logo-icon">AG</div>
          <h1>Antigravity POS</h1>
          <p>Restaurant Management Platform</p>
        </div>

        <div className="login-tabs" style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
          <button className={`login-tab ${tab === 'login' ? 'active' : ''}`} style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => { setTab('login'); setError(''); }}>Sign In</button>
          <button className={`login-tab ${tab === 'pin' ? 'active' : ''}`} style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => { setTab('pin'); setError(''); setPinInput(''); }}>Staff PIN</button>
          <button className={`login-tab ${tab === 'register' ? 'active' : ''}`} style={{ flex: 1, whiteSpace: 'nowrap' }} onClick={() => { setTab('register'); setError(''); }}>New Store</button>
        </div>

        {error && <div className="login-error">{error}</div>}

        {tab === 'login' && (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="admin@myrestaurant.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Restaurant ID / Slug (Optional)</label>
              <input className="form-input" type="text" placeholder="e.g. standard-bistro-1234" value={form.tenantId} onChange={e => set('tenantId', e.target.value)} />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {tab === 'pin' && (
          <div>
            <div className="form-group">
              <label className="form-label">Restaurant ID / Slug</label>
              <input 
                className="form-input" 
                placeholder="e.g. standard-bistro-1234" 
                value={tenantId} 
                onChange={e => {
                  setTenantId(e.target.value);
                  setError('');
                }} 
              />
            </div>
            
            <div className="pin-display" style={{ marginBottom: '14px' }}>
              {pinInput.padEnd(4, '•')}
            </div>

            <div className="pin-pad" style={{ maxWidth: '280px', margin: '0 auto' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} className="pin-btn" style={{ fontSize: '22px', height: '54px' }} onClick={() => handlePinDigit(num.toString())}>
                  {num}
                </button>
              ))}
              <button className="pin-btn" style={{ fontSize: '11px', color: 'var(--danger)', height: '54px' }} onClick={handlePinClear}>
                CLEAR
              </button>
              <button className="pin-btn" style={{ fontSize: '22px', height: '54px' }} onClick={() => handlePinDigit('0')}>
                0
              </button>
              <button className="pin-btn" style={{ fontSize: '14px', color: 'var(--gray-600)', height: '54px' }} onClick={handlePinBackspace}>
                ⌫
              </button>
            </div>
          </div>
        )}

        {tab === 'register' && (
          <form onSubmit={handleRegister}>
            <div className="form-group">
              <label className="form-label">Restaurant Name</label>
              <input className="form-input" type="text" placeholder="The Grand Bistro" value={form.businessName} onChange={e => set('businessName', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Your Name</label>
              <input className="form-input" type="text" placeholder="John Smith" value={form.name} onChange={e => set('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" placeholder="admin@myrestaurant.com" value={form.email} onChange={e => set('email', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" placeholder="Create a password" value={form.password} onChange={e => set('password', e.target.value)} required />
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
              {loading ? 'Creating Restaurant...' : 'Create Restaurant Account'}
            </button>
          </form>
        )}

        <p className="text-sm text-muted text-center mt-16">
          Multi-tenant POS · Isolated Database Sharding
        </p>
      </div>
    </div>
  );
}
