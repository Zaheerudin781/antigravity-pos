import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

const BACKEND = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

export default function AccountPage() {
  const { state, dispatch, notify } = useApp();
  const [loading, setLoading] = useState(true);
  const [accountInfo, setAccountInfo] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // Form states
  const [credForm, setCredForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '' });
  const [saving, setSaving] = useState(false);

  const fetchAccount = async () => {
    try {
      const { data } = await api.get('/account');
      setAccountInfo(data.account);
      setCredForm({
        name: data.account.adminUser?.name || '',
        email: data.account.adminUser?.email || '',
        currentPassword: '',
        newPassword: ''
      });
    } catch {
      notify('Failed to load account details', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccount();
  }, []);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show preview immediately
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
    // Upload
    setSavingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data: uploadData } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.patch('/account/avatar', { avatarUrl: uploadData.url });
      dispatch({ type: 'LOGIN', payload: { token: state.token, user: { ...state.user, avatarUrl: uploadData.url }, restaurant: state.restaurant } });
      notify('Profile picture updated!');
    } catch {
      notify('Failed to upload avatar', 'error');
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleUpdateCredentials = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/account/credentials', credForm);
      notify('Account credentials updated!');
      setCredForm(f => ({ ...f, currentPassword: '', newPassword: '' }));
      
      // Update local storage and context name if changed
      dispatch({
        type: 'LOGIN',
        payload: {
          token: state.token,
          user: { ...state.user, name: credForm.name, email: credForm.email },
          restaurant: state.restaurant
        }
      });
    } catch (err) {
      notify(err.response?.data?.message || 'Error updating credentials', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await api.get('/account/backup', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${state.user?.tenantId || 'pos'}-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      notify('Backup file downloaded successfully!');
    } catch {
      notify('Backup failed', 'error');
    }
  };

  if (loading) return <div className="spinner" />;

  const expiryDate = accountInfo?.subscriptionExpiry 
    ? new Date(accountInfo.subscriptionExpiry).toLocaleDateString()
    : 'N/A';

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>My Account</h1>
          <p>Subscription tier details, profile credentials, and data backup</p>
        </div>
      </div>

      {/* Profile Picture */}
      <div className="card mb-12">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Profile Picture</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
              background: 'var(--gray-100)', border: '3px solid var(--primary-light)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, cursor: 'pointer', flexShrink: 0
            }}
            onClick={() => avatarInputRef.current?.click()}
            title="Click to change photo"
          >
            {(avatarPreview || state.user?.avatarUrl) ? (
              <img
                src={avatarPreview || (state.user.avatarUrl.startsWith('http') ? state.user.avatarUrl : `${BACKEND}${state.user.avatarUrl}`)}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : '👤'}
          </div>
          <div>
            <button className="btn btn-outline btn-sm" onClick={() => avatarInputRef.current?.click()} disabled={savingAvatar}>
              {savingAvatar ? 'Uploading…' : '📷 Change Photo'}
            </button>
            <p className="text-muted text-sm" style={{ marginTop: 6 }}>JPEG or PNG · max 2 MB</p>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Subscription Tier Info */}
      <div className="card mb-12" style={{ borderLeft: '4px solid var(--purple)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge badge-purple" style={{ marginBottom: 4 }}>
              {accountInfo?.subscriptionTier} SaaS plan
            </span>
            <h2 style={{ fontSize: 18, fontWeight: 800 }}>{state.restaurant?.businessName}</h2>
            <div className="text-muted text-sm mt-8">Tenant ID: <code>{accountInfo?.tenantId}</code></div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-sm text-muted">Expires On</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>{expiryDate}</div>
          </div>
        </div>
      </div>

      {/* Backup and export */}
      <div className="card mb-12">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Database Backup & Portability</h2>
        <p className="text-muted text-sm mb-12">
          Download a complete snapshot of your restaurant profile, menu categories, active tables, staff records, and completed checkout orders. This JSON file can be used for compliance, auditing, or migration.
        </p>
        <button className="btn btn-success" onClick={handleDownloadBackup}>
          💾 Export Full JSON Backup
        </button>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleUpdateCredentials} className="card">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Admin Profile Credentials</h2>
        
        <div className="form-group">
          <label className="form-label">Full Name</label>
          <input
            className="form-input"
            value={credForm.name}
            onChange={e => setCredForm(f => ({ ...f, name: e.target.value }))}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Email Address</label>
          <input
            className="form-input"
            type="email"
            value={credForm.email}
            onChange={e => setCredForm(f => ({ ...f, email: e.target.value }))}
            required
          />
        </div>

        <h3 style={{ fontSize: 12, fontWeight: 700, margin: '20px 0 10px 0', color: 'var(--gray-600)' }}>Change Password</h3>

        <div className="form-group">
          <label className="form-label">Current Password (required for password changes)</label>
          <input
            className="form-input"
            type="password"
            placeholder="••••••••"
            value={credForm.currentPassword}
            onChange={e => setCredForm(f => ({ ...f, currentPassword: e.target.value }))}
          />
        </div>

        <div className="form-group">
          <label className="form-label">New Password</label>
          <input
            className="form-input"
            type="password"
            placeholder="Min 6 characters"
            value={credForm.newPassword}
            onChange={e => setCredForm(f => ({ ...f, newPassword: e.target.value }))}
          />
        </div>

        <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Update Account'}
          </button>
        </div>
      </form>
    </div>
  );
}
