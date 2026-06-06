import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

const BACKEND = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

export default function RestaurantPage() {
  const { state, dispatch, notify } = useApp();
  const { restaurant } = state;
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    businessName: '',
    address: '',
    phone: '',
    email: '',
    taxRate: 10,
    currency: 'USD',
    currencySymbol: '$',
    receiptFooter: '',
    timezone: 'America/New_York',
    logoUrl: '',
    coverImageUrl: '',
    openingHours: '',
    socialInstagram: '',
    socialFacebook: '',
    socialTwitter: '',
  });
  const [logoPreview, setLogoPreview] = useState('');
  const [coverPreview, setCoverPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);

  useEffect(() => {
    const fetchRestaurantSettings = async () => {
      try {
        const { data } = await api.get('/restaurant');
        if (data.restaurant) {
          setForm({
            businessName: data.restaurant.businessName || '',
            address: data.restaurant.address || '',
            phone: data.restaurant.phone || '',
            email: data.restaurant.email || '',
            taxRate: data.restaurant.taxRate ?? 10,
            currency: data.restaurant.currency || 'USD',
            currencySymbol: data.restaurant.currencySymbol || '$',
            receiptFooter: data.restaurant.receiptFooter || '',
            timezone: data.restaurant.timezone || 'America/New_York',
            logoUrl: data.restaurant.logoUrl || '',
            coverImageUrl: data.restaurant.coverImageUrl || '',
            openingHours: data.restaurant.openingHours || '',
            socialInstagram: data.restaurant.socialInstagram || '',
            socialFacebook: data.restaurant.socialFacebook || '',
            socialTwitter: data.restaurant.socialTwitter || '',
          });
          setLogoPreview(data.restaurant.logoUrl || '');
          setCoverPreview(data.restaurant.coverImageUrl || '');
        }
      } catch {
        notify('Failed to load restaurant settings', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchRestaurantSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.businessName) {
      notify('Business name is required', 'error');
      return;
    }
    try {
      const { data } = await api.patch('/restaurant', form);
      dispatch({ type: 'SET_RESTAURANT', payload: data.restaurant });
      notify('Settings updated successfully!');
    } catch {
      notify('Failed to save settings', 'error');
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Image upload helper
  const handleImageUpload = async (file, field, setPreview, setUploading) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setForm(f => ({ ...f, [field]: data.url }));
      notify('Image uploaded!');
    } catch {
      notify('Image upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const resolveImg = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    return `${BACKEND}${url}`;
  };

  if (loading) return <div className="spinner" />;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>Restaurant Settings</h1>
          <p>Configure taxes, formatting, and company info</p>
        </div>
      </div>

      {/* Logo & Cover Image Upload */}
      <div className="card mb-12">
        <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Brand Images</h2>
        <div className="flex gap-20" style={{ flexWrap: 'wrap' }}>
          {/* Logo */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label">Restaurant Logo</label>
            <div
              className="image-upload-area"
              style={{ height: 120 }}
              onClick={() => logoInputRef.current?.click()}
            >
              {(logoPreview || form.logoUrl) ? (
                <img src={logoPreview || resolveImg(form.logoUrl)} alt="logo" className="image-upload-preview" />
              ) : (
                <div className="image-upload-placeholder">
                  <span>🏪</span>
                  <span>{uploadingLogo ? 'Uploading…' : 'Upload Logo'}</span>
                </div>
              )}
            </div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={e => handleImageUpload(e.target.files[0], 'logoUrl', setLogoPreview, setUploadingLogo)}
            />
          </div>

          {/* Cover Image */}
          <div style={{ flex: 2, minWidth: 260 }}>
            <label className="form-label">Cover Image</label>
            <div
              className="image-upload-area"
              style={{ height: 120 }}
              onClick={() => coverInputRef.current?.click()}
            >
              {(coverPreview || form.coverImageUrl) ? (
                <img src={coverPreview || resolveImg(form.coverImageUrl)} alt="cover" className="image-upload-preview" />
              ) : (
                <div className="image-upload-placeholder">
                  <span>🖼️</span>
                  <span>{uploadingCover ? 'Uploading…' : 'Upload Cover Image'}</span>
                </div>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={e => handleImageUpload(e.target.files[0], 'coverImageUrl', setCoverPreview, setUploadingCover)}
            />
          </div>
        </div>
        <p className="text-muted text-sm" style={{ marginTop: 10 }}>Images are saved when you click "Save Settings" below.</p>
      </div>

      <form onSubmit={handleSave} className="card">
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Store Profile</h2>
        
        <div className="form-group">
          <label className="form-label">Business Name</label>
          <input
            className="form-input"
            value={form.businessName}
            onChange={e => set('businessName', e.target.value)}
            required
          />
        </div>

        <div className="flex gap-12">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Contact Phone</label>
            <input
              className="form-input"
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Contact Email</label>
            <input
              className="form-input"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Street Address</label>
          <input
            className="form-input"
            value={form.address}
            onChange={e => set('address', e.target.value)}
            placeholder="e.g. 100 Main St, Suite A"
          />
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '24px 0 16px 0', borderTop: '1px solid var(--gray-200)', paddingTop: 16 }}>
          Tax & Localization Settings
        </h2>

        <div className="flex gap-12">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Tax Rate (%)</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0"
              value={form.taxRate}
              onChange={e => set('taxRate', +e.target.value)}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Currency Code</label>
            <select
              className="form-select"
              value={form.currency}
              onChange={e => set('currency', e.target.value)}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Currency Symbol</label>
            <input
              className="form-input"
              value={form.currencySymbol}
              onChange={e => set('currencySymbol', e.target.value)}
              placeholder="e.g. $"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Timezone</label>
          <select
            className="form-select"
            value={form.timezone}
            onChange={e => set('timezone', e.target.value)}
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Chicago">Central Time (CT)</option>
            <option value="America/Denver">Mountain Time (MT)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
          </select>
        </div>

        <div className="form-group">
          <label className="form-label">Receipt Footer Message</label>
          <textarea
            className="form-input"
            rows="3"
            value={form.receiptFooter}
            onChange={e => set('receiptFooter', e.target.value)}
            placeholder="e.g. Thanks for dining with us! Please review us on Google."
          />
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 700, margin: '24px 0 16px 0', borderTop: '1px solid var(--gray-200)', paddingTop: 16 }}>
          🌐 Public Menu — Online Presence
        </h2>

        <div className="form-group">
          <label className="form-label">Opening Hours (shown on public menu)</label>
          <input
            className="form-input"
            value={form.openingHours}
            onChange={e => set('openingHours', e.target.value)}
            placeholder="e.g. Mon–Fri: 10 AM – 10 PM · Sat–Sun: 9 AM – 11 PM"
          />
        </div>

        <div className="flex gap-12">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">📸 Instagram URL</label>
            <input
              className="form-input"
              type="url"
              value={form.socialInstagram}
              onChange={e => set('socialInstagram', e.target.value)}
              placeholder="https://instagram.com/yourpage"
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">👥 Facebook URL</label>
            <input
              className="form-input"
              type="url"
              value={form.socialFacebook}
              onChange={e => set('socialFacebook', e.target.value)}
              placeholder="https://facebook.com/yourpage"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">🐦 Twitter / X URL</label>
          <input
            className="form-input"
            type="url"
            value={form.socialTwitter}
            onChange={e => set('socialTwitter', e.target.value)}
            placeholder="https://x.com/yourhandle"
          />
        </div>

        <div className="flex" style={{ justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn btn-primary" type="submit">
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
