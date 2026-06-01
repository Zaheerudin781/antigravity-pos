import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

const ROLES = ['Waiter', 'Chef', 'Cashier', 'Admin'];

export default function StaffPage() {
  const { state, dispatch, notify } = useApp();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('list'); // list | pinpad
  
  // PIN Pad state
  const [pinInput, setPinInput] = useState('');
  
  // CRUD Modal state
  const [showCrudModal, setShowCrudModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', pin: '', role: 'Waiter', color: '#2196f3', isActive: true });

  const fetchStaff = async () => {
    try {
      const { data } = await api.get('/staff');
      setStaff(data.staff || []);
    } catch {
      notify('Failed to load staff list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  // PIN Pad handlers
  const handlePinDigit = (digit) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + digit;
      setPinInput(newPin);
      if (newPin.length === 4) {
        submitPin(newPin);
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
    try {
      const { data } = await api.post('/auth/staff-pin', { pin, tenantId: state.user.tenantId });
      
      // Log staff member in
      dispatch({
        type: 'LOGIN',
        payload: {
          token: data.token,
          user: { id: data.staff.id, name: data.staff.name, role: data.staff.role, tenantId: state.user.tenantId },
          restaurant: state.restaurant
        }
      });
      notify(`Staff switched to ${data.staff.name} (${data.staff.role})`);
      setPinInput('');
      setMode('list');
      fetchStaff();
    } catch (err) {
      notify(err.response?.data?.message || 'Invalid PIN', 'error');
      setPinInput('');
    }
  };

  // CRUD Handlers
  const handleCreateClick = () => {
    setEditingMember(null);
    setMemberForm({ name: '', pin: '', role: 'Waiter', color: '#2196f3', isActive: true });
    setShowCrudModal(true);
  };

  const handleEditClick = (member) => {
    setEditingMember(member);
    setMemberForm({ name: member.name, pin: '', role: member.role, color: member.color || '#2196f3', isActive: member.isActive });
    setShowCrudModal(true);
  };

  const handleSaveMember = async () => {
    if (!memberForm.name || (!editingMember && !memberForm.pin)) {
      notify('Name and PIN are required', 'error');
      return;
    }

    const payload = { ...memberForm };
    if (!payload.pin) delete payload.pin; // don't send empty PIN for edits

    try {
      if (editingMember) {
        const { data } = await api.patch(`/staff/${editingMember._id}`, payload);
        setStaff(prev => prev.map(s => s._id === editingMember._id ? data.staff : s));
        notify('Staff member updated!');
      } else {
        const { data } = await api.post('/staff', payload);
        setStaff(prev => [...prev, data.staff]);
        notify('Staff member added!');
      }
      setShowCrudModal(false);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save staff member', 'error');
    }
  };

  const handleDeleteMember = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff member?')) return;
    try {
      await api.delete(`/staff/${id}`);
      setStaff(prev => prev.filter(s => s._id !== id));
      notify('Staff member deleted');
      setShowCrudModal(false);
    } catch {
      notify('Failed to delete staff member', 'error');
    }
  };

  const sym = state.restaurant?.currencySymbol || '$';

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Staff & Access</h1>
          <p>Manage staff details or quickly switch user accounts via PIN</p>
        </div>
        <div className="flex gap-8">
          <button className={`btn btn-sm ${mode === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('list')}>
            Staff List
          </button>
          <button className={`btn btn-sm ${mode === 'pinpad' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setMode('pinpad')}>
            PIN Login Switcher
          </button>
        </div>
      </div>

      {mode === 'list' ? (
        <div>
          <div className="flex" style={{ justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-primary btn-sm" onClick={handleCreateClick}>+ Add Staff Member</button>
          </div>

          {staff.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <p>No staff members found</p>
            </div>
          ) : (
            <div className="staff-grid">
              {staff.map(member => (
                <div key={member._id} className="staff-card">
                  <div
                    className="staff-avatar"
                    style={{ backgroundColor: member.color || '#2196f3' }}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="staff-card__name">{member.name}</div>
                  <div className="staff-card__role">
                    <span className={`badge badge-${member.role === 'Admin' ? 'purple' : member.role === 'Chef' ? 'warning' : 'blue'}`}>
                      {member.role}
                    </span>
                  </div>
                  <div className="staff-card__sales">
                    Sales: {sym}{(member.totalSales || 0).toFixed(2)}
                  </div>
                  
                  {state.user?.role === 'Admin' && (
                    <div className="staff-card__actions">
                      <button className="btn btn-sm btn-outline" onClick={() => handleEditClick(member)}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 360, margin: '20px auto', padding: '24px 20px' }}>
          <h2 className="text-center" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Staff PIN Check-in</h2>
          <p className="text-center text-muted text-sm mb-16">Enter your 4-digit PIN to switch accounts</p>
          
          <div className="pin-display">
            {pinInput.padEnd(4, '•')}
          </div>

          <div className="pin-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} className="pin-btn" onClick={() => handlePinDigit(num.toString())}>
                {num}
              </button>
            ))}
            <button className="pin-btn" style={{ fontSize: 12, color: 'var(--danger)' }} onClick={handlePinClear}>
              CLEAR
            </button>
            <button className="pin-btn" onClick={() => handlePinDigit('0')}>
              0
            </button>
            <button className="pin-btn" style={{ fontSize: 12, color: 'var(--gray-600)' }} onClick={handlePinBackspace}>
              ⌫
            </button>
          </div>
        </div>
      )}

      {/* CRUD Modal */}
      {showCrudModal && (
        <div className="modal-overlay" onClick={() => setShowCrudModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingMember ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
            
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                placeholder="e.g. Sarah Connor"
                value={memberForm.name}
                onChange={e => setMemberForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                value={memberForm.role}
                onChange={e => setMemberForm(p => ({ ...p, role: e.target.value }))}
              >
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{editingMember ? 'New PIN (leave blank to keep current)' : 'PIN (4-digits)'}</label>
              <input
                className="form-input"
                type="password"
                maxLength="4"
                placeholder={editingMember ? '••••' : 'e.g. 2580'}
                value={memberForm.pin}
                onChange={e => setMemberForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Avatar Color</label>
              <div className="flex gap-8" style={{ alignItems: 'center' }}>
                <input
                  type="color"
                  className="form-input"
                  value={memberForm.color}
                  onChange={e => setMemberForm(p => ({ ...p, color: e.target.value }))}
                  style={{ width: 60, height: 38, padding: 2, cursor: 'pointer' }}
                />
                <span className="text-sm text-muted">Pick a theme color for this member</span>
              </div>
            </div>

            <div className="modal-footer">
              {editingMember && (
                <button
                  className="btn btn-danger"
                  style={{ marginRight: 'auto' }}
                  onClick={() => handleDeleteMember(editingMember._id)}
                >
                  Delete Staff
                </button>
              )}
              <button className="btn btn-outline" onClick={() => setShowCrudModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveMember}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
