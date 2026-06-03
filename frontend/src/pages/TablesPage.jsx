import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';
import { io } from 'socket.io-client';

const STATUS_LABEL = { available: 'Available', ordering: 'Ordering', occupied: 'Occupied', 'bill-requested': 'Bill Requested' };
export default function TablesPage() {
  const { state, dispatch, notify } = useApp();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newTable, setNewTable] = useState({ name: '', section: 'Main Room', capacity: 4 });
  const [activeSection, setActiveSection] = useState('All');
  const [liveIndicator, setLiveIndicator] = useState(false);
  const socketRef = useRef(null);

  // Rooms CRUD State
  const [roomsList, setRoomsList] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: '', description: '' });
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  const fetchTables = async () => {
    try { const { data } = await api.get('/tables'); setTables(data.tables); }
    catch { } finally { setLoading(false); }
  };

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      const rooms = data.rooms || [];
      setRoomsList(rooms);
      setRoomsLoaded(true);
      if (rooms.length > 0) {
        setNewTable(p => ({ ...p, section: rooms[0].name }));
      }
    } catch (err) {
      console.error('Error fetching rooms', err);
      setRoomsLoaded(true);
    }
  };

  // Socket.io real-time updates
  useEffect(() => {
    fetchTables();
    fetchRooms();

    const socketUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace('/api', '')
      : 'http://localhost:5000';
    const socket = io(socketUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      const tenantId = state.user?.tenantId || state.restaurant?.tenantId;
      if (tenantId) socket.emit('join_tenant', tenantId);
    });

    socket.on('order_update', () => {
      setLiveIndicator(true);
      setTimeout(() => setLiveIndicator(false), 1200);
      fetchTables();
    });

    // Fallback polling every 15 seconds
    const t = setInterval(fetchTables, 15000);

    return () => {
      socket.disconnect();
      clearInterval(t);
    };
  }, [state.user?.tenantId, state.restaurant?._id]);

  // ---- Rooms CRUD ----
  const handleSaveRoom = async () => {
    if (!roomForm.name.trim()) { notify('Room name is required', 'error'); return; }
    try {
      if (editingRoom) {
        await api.patch(`/rooms/${editingRoom._id}`, roomForm);
        notify('Room/Floor updated!');
      } else {
        await api.post('/rooms', roomForm);
        notify('Room/Floor created!');
      }
      setRoomForm({ name: '', description: '' });
      setEditingRoom(null);
      fetchRooms();
      fetchTables();
    } catch (err) {
      notify(err.response?.data?.message || 'Error saving room', 'error');
    }
  };

  const handleEditRoomClick = (room) => {
    setEditingRoom(room);
    setRoomForm({ name: room.name, description: room.description || '' });
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm('Delete this room/floor? Any tables assigned here will fall back to Main Room.')) return;
    try {
      await api.delete(`/rooms/${roomId}`);
      notify('Room deleted');
      fetchRooms();
      fetchTables();
    } catch (err) {
      notify(err.response?.data?.message || 'Error deleting room', 'error');
    }
  };

  const handleTableClick = async (table) => {
    if (table.status === 'available') {
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: { tableId: table._id, tableName: table.name, orderType: 'Dine-In', items: [] } });
      dispatch({ type: 'SET_TAB', payload: 'ORDER' });
      return;
    }

    // Prompt user to start a new order or edit the existing one
    const startNew = window.confirm(`Table ${table.name} is occupied.\n\n- Click "OK" to start a NEW order.\n- Click "Cancel" to edit/view the existing order.`);
    
    if (startNew) {
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: { tableId: table._id, tableName: table.name, orderType: 'Dine-In', items: [] } });
      dispatch({ type: 'SET_TAB', payload: 'ORDER' });
      return;
    }

    try {
      const { data } = await api.get(`/tables/${table._id}/order`);
      if (data.order) {
        dispatch({ type: 'SET_SIDEBAR_ORDER', payload: data.order });
      } else {
        dispatch({ type: 'SET_SIDEBAR_ORDER', payload: { tableId: table._id, tableName: table.name, orderType: 'Dine-In', items: [] } });
      }
    } catch {
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: { tableId: table._id, tableName: table.name, orderType: 'Dine-In', items: [] } });
    }
    dispatch({ type: 'SET_TAB', payload: 'ORDER' });
  };

  const handleAdd = async () => {
    if (!newTable.name.trim()) { notify('Table name is required', 'error'); return; }
    try {
      const { data } = await api.post('/tables', newTable);
      setTables(prev => [...prev, data.table]);
      setShowModal(false); setNewTable({ name: '', section: 'Main Room', capacity: 4 });
      notify('Table added!');
    } catch (err) { notify(err.response?.data?.message || 'Error', 'error'); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this table?')) return;
    await api.delete(`/tables/${id}`);
    setTables(prev => prev.filter(t => t._id !== id)); notify('Table deleted');
  };

  const handleStatusChange = async (id, status, e) => {
    e.stopPropagation();
    const { data } = await api.patch(`/tables/${id}`, { status });
    setTables(prev => prev.map(t => t._id === id ? data.table : t));
  };

  // Build section tabs: rooms from DB + any orphaned table sections not in any room
  const roomNames = roomsList.map(r => r.name);
  const orphanSections = [...new Set(tables.map(t => t.section).filter(s => s && !roomNames.includes(s)))];
  const allSections = roomsLoaded
    ? ['All', ...roomNames, ...orphanSections]
    : ['All', ...new Set(tables.map(t => t.section).filter(Boolean))];
  const displayed = activeSection === 'All'
    ? tables
    : tables.filter(t => (t.section || '').toLowerCase().trim() === activeSection.toLowerCase().trim());

  const counts = { available: 0, ordering: 0, occupied: 0, 'bill-requested': 0 };
  tables.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tables</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`live-dot ${liveIndicator ? 'pulse' : ''}`} />
            Floor plan — tap a table to load its order
          </p>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-outline" onClick={() => setShowRoomModal(true)}>📁 Manage Rooms</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Table</button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 16 }}>
        {[['available','success','🟢'],['ordering','warning','🟡'],['occupied','danger','🔴'],['bill-requested','purple','🟣']].map(([s,c,icon]) => (
          <div key={s} className={`stat-card ${c}`}>
            <div className="stat-card__label">{icon} {STATUS_LABEL[s]}</div>
            <div className="stat-card__value">{counts[s] || 0}</div>
          </div>
        ))}
      </div>

      {/* Section filter */}
      <div className="room-filter-strip" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, padding: '10px 0' }}>
        {allSections.map(s => (
          <button
            key={s}
            className={`btn btn-sm ${activeSection === s ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveSection(s)}
            style={s !== 'All' && activeSection !== s ? { borderColor: 'var(--gray-300)' } : {}}
          >
            {s === 'All' ? '🏠 All Rooms' : `🚪 ${s}`}
            {s !== 'All' && (
              <span style={{
                marginLeft: 5, background: activeSection === s ? 'rgba(255,255,255,0.25)' : 'var(--gray-200)',
                borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700,
                color: activeSection === s ? 'white' : 'var(--gray-600)'
              }}>
                {tables.filter(t => (t.section || '').toLowerCase().trim() === s.toLowerCase().trim()).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-12 mb-12 text-sm text-muted" style={{ flexWrap: 'wrap' }}>
        <span>🟢 Available</span><span>🟡 Ordering</span><span>🔴 Occupied</span><span>🟣 Bill Requested</span>
      </div>

      <div className="tables-grid">
        {displayed.map(table => (
          <div key={table._id} className={`table-tile ${table.status}`} onClick={() => handleTableClick(table)}>
            <div className="table-tile__name">{table.name}</div>
            <div className="table-tile__section">{table.section}</div>
            <div className="table-tile__capacity">👥 {table.capacity} seats</div>
            <div className="text-sm mt-8" style={{ color: '#666' }}>{STATUS_LABEL[table.status]}</div>
            <div className="flex gap-8 mt-8" style={{ justifyContent: 'center' }}>
              <select
                className="form-select" style={{ fontSize: 10, padding: '2px 4px', width: 'auto' }}
                value={table.status}
                onChange={e => handleStatusChange(table._id, e.target.value, e)}
                onClick={e => e.stopPropagation()}
              >
                <option value="available">Available</option>
                <option value="ordering">Ordering</option>
                <option value="occupied">Occupied</option>
                <option value="bill-requested">Bill Requested</option>
              </select>
              <button className="btn btn-sm btn-danger" onClick={(e) => handleDelete(table._id, e)}>✕</button>
            </div>
            <div className="table-tile__status-bar" />
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add New Table</h2>
            <div className="form-group"><label className="form-label">Table Name</label>
              <input className="form-input" placeholder="e.g. T7" value={newTable.name} onChange={e => setNewTable(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Section</label>
              <select className="form-select" value={newTable.section} onChange={e => setNewTable(p => ({ ...p, section: e.target.value }))}>
                {(roomsList.length > 0 ? roomsList.map(r => r.name) : ['Main Room', 'Patio', 'Bar']).map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select></div>
            <div className="form-group"><label className="form-label">Capacity</label>
              <input className="form-input" type="number" min={1} max={20} value={newTable.capacity} onChange={e => setNewTable(p => ({ ...p, capacity: +e.target.value }))} /></div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAdd}>Add Table</button>
            </div>
          </div>
        </div>
      )}

      {/* ROOMS CRUD MODAL */}
      {showRoomModal && (
        <div className="modal-overlay" onClick={() => setShowRoomModal(false)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2>Manage Rooms / Floors</h2>
              <button className="btn btn-sm btn-outline" onClick={() => { setEditingRoom(null); setRoomForm({ name: '', description: '' }); }}>Clear Form</button>
            </div>

            <div className="card mb-16" style={{ background: 'var(--gray-50)', padding: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{editingRoom ? '✏️ Edit Room/Floor' : '➕ Create Room/Floor'}</h3>
              <div className="flex gap-12" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
                  <label className="form-label">Room/Floor Name</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Upstairs Hall"
                    value={roomForm.name}
                    onChange={e => setRoomForm(p => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="form-group" style={{ flex: '2 1 240px', marginBottom: 0 }}>
                  <label className="form-label">Description (optional)</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Second floor balcony"
                    value={roomForm.description}
                    onChange={e => setRoomForm(p => ({ ...p, description: e.target.value }))}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleSaveRoom} style={{ height: 42 }}>
                  {editingRoom ? 'Update' : 'Add'}
                </button>
              </div>
            </div>

            <div style={{ maxHeight: 250, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room Name</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {roomsList.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="text-center text-muted" style={{ padding: 12 }}>No custom rooms/floors configured yet.</td>
                    </tr>
                  ) : (
                    roomsList.map(room => (
                      <tr key={room._id}>
                        <td style={{ fontWeight: 600 }}>{room.name}</td>
                        <td className="text-muted text-sm">{room.description || '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex gap-4" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-sm btn-outline" onClick={() => handleEditRoomClick(room)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteRoom(room._id)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={() => setShowRoomModal(false)}>Close Rooms Manager</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
