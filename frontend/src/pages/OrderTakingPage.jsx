import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

const BACKEND = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

// Tiny Web Audio "ting" helper
function playTing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, ctx.currentTime); // C6
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch (_) {}
}

const ORDER_TYPES = ['Dine-In', 'Takeaway', 'Delivery'];

export default function OrderTakingPage() {
  const { state, dispatch, notify } = useApp();
  const sym = state.restaurant?.currencySymbol || '$';

  // Menu & categories
  const [menuItems, setMenuItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  // Active order (local state — fully self-contained)
  const [orderItems, setOrderItems] = useState([]);
  const [orderType, setOrderType] = useState('Dine-In');
  const [selectedTable, setSelectedTable] = useState('');
  const [tableId, setTableId] = useState('');        // actual DB _id of selected table
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [orderNotes, setOrderNotes] = useState('');

  // Modifier drawer
  const [selectedItem, setSelectedItem] = useState(null);
  const [chosenMods, setChosenMods] = useState([]);
  const [itemNotes, setItemNotes] = useState('');
  const [itemQty, setItemQty] = useState(1);
  const [editingCartIndex, setEditingCartIndex] = useState(null);

  // Submitting
  const [submitting, setSubmitting] = useState(false);

  // Fetch menu + tables + categories
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [menuRes, tablesRes, categoriesRes] = await Promise.all([
          api.get('/menu'),
          api.get('/tables'),
          api.get('/categories').catch(() => ({ data: { categories: [] } })),
        ]);
        setMenuItems(menuRes.data.items || []);
        setTables(tablesRes.data.tables || []);
        
        const dbCats = categoriesRes.data?.categories || [];
        if (dbCats.length > 0) {
          const catNames = dbCats.map(c => c.name);
          setCategories(['All', ...catNames]);
          setActiveCategory(catNames[0]); // default to first real category
        } else {
          const derived = [...new Set((menuRes.data.items || []).map(m => m.category))];
          setCategories(['All', ...derived]);
          if (derived.length > 0) setActiveCategory(derived[0]);
        }
      } catch (err) {
        console.error('OrderTaking fetch error', err);
      } finally {
        setLoadingMenu(false);
      }
    };
    fetchAll();
  }, []);

  // Watch active editing order from global state
  useEffect(() => {
    if (state.sidebarOrder) {
      setOrderItems(state.sidebarOrder.items || []);
      setOrderType(state.sidebarOrder.orderType || 'Dine-In');
      const tName = state.sidebarOrder.orderType === 'Dine-In' ? (state.sidebarOrder.tableName || '') : '';
      setSelectedTable(tName);
      // Resolve tableId: prefer explicit tableId from sidebarOrder, else look up by name
      setTableId(state.sidebarOrder.tableId || state.sidebarOrder.tableId || '');
      setCustomerName(state.sidebarOrder.customerName || '');
      setCustomerPhone(state.sidebarOrder.customerPhone || '');
      setDeliveryAddress(state.sidebarOrder.deliveryAddress || '');
      setOrderNotes(state.sidebarOrder.notes || '');
    } else {
      setOrderItems([]);
      setOrderType('Dine-In');
      setSelectedTable('');
      setTableId('');
      setCustomerName('');
      setCustomerPhone('');
      setDeliveryAddress('');
      setOrderNotes('');
    }
  }, [state.sidebarOrder]);

  // Whenever selectedTable name changes, resolve its _id from the tables list
  useEffect(() => {
    if (!selectedTable || tables.length === 0) {
      // Only clear if not already set by sidebarOrder.tableId
      if (!state.sidebarOrder?.tableId) setTableId('');
      return;
    }
    const found = tables.find(t => t.name === selectedTable);
    if (found) setTableId(found._id);
  }, [selectedTable, tables]);

  // Derived
  const filtered = activeCategory === 'All' ? menuItems : menuItems.filter(m => m.category === activeCategory);
  const subtotal = orderItems.reduce((s, i) => s + i.subtotal, 0);
  const taxRate = (state.restaurant?.taxRate || 0) / 100;
  const tax = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);

  // Handle item card click → instantly add 1 unit to cart
  const handleItemClick = (item) => {
    if (!item.isAvailable) return;
    const newLine = {
      menuItemId: item._id,
      name: item.name,
      price: item.price,
      quantity: 1,
      modifiers: [],
      notes: '',
      subtotal: item.price,
    };
    setOrderItems(prev => {
      const idx = prev.findIndex(
        i => i.menuItemId === newLine.menuItemId &&
          i.modifiers.length === 0 &&
          i.notes === ''
      );
      if (idx > -1) {
        const updated = [...prev];
        const updatedItem = { ...updated[idx] };
        updatedItem.quantity += 1;
        updatedItem.subtotal = +(updatedItem.price * updatedItem.quantity).toFixed(2);
        updated[idx] = updatedItem;
        return updated;
      }
      return [...prev, newLine];
    });
    notify(`Added ${item.name} to cart`);
  };

  const handleEditCartItem = (idx) => {
    const cartItem = orderItems[idx];
    const matchedItem = menuItems.find(m => m._id === cartItem.menuItemId);
    if (!matchedItem) return;
    
    setEditingCartIndex(idx);
    setSelectedItem(matchedItem);
    setChosenMods(cartItem.modifiers || []);
    setItemNotes(cartItem.notes || '');
    setItemQty(cartItem.quantity || 1);
  };

  const toggleMod = (mod) => {
    setChosenMods(prev =>
      prev.some(m => m.name === mod.name) ? prev.filter(m => m.name !== mod.name) : [...prev, mod]
    );
  };

  const confirmAddItem = () => {
    if (!selectedItem) return;
    const modTotal = chosenMods.reduce((s, m) => s + m.price, 0);
    const unitPrice = selectedItem.price + modTotal;
    const subtotalLine = +(unitPrice * itemQty).toFixed(2);
    const newLine = {
      menuItemId: selectedItem._id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity: itemQty,
      modifiers: chosenMods,
      notes: itemNotes,
      subtotal: subtotalLine,
    };

    if (editingCartIndex !== null) {
      setOrderItems(prev => {
        const updated = [...prev];
        updated[editingCartIndex] = newLine;
        return updated;
      });
      notify(`Updated ${selectedItem.name}`);
      setEditingCartIndex(null);
    } else {
      setOrderItems(prev => {
        const idx = prev.findIndex(
          i => i.menuItemId === newLine.menuItemId &&
            JSON.stringify(i.modifiers) === JSON.stringify(newLine.modifiers) &&
            i.notes === newLine.notes
        );
        if (idx > -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + itemQty, subtotal: +((updated[idx].price + modTotal) * (updated[idx].quantity + itemQty)).toFixed(2) };
          return updated;
        }
        return [...prev, newLine];
      });
      notify(`Added ${itemQty}× ${selectedItem.name}`);
    }
    setSelectedItem(null);
  };

  const removeOrderItem = (idx) => {
    setOrderItems(prev => prev.filter((_, i) => i !== idx));
  };

  const changeQty = (idx, delta) => {
    setOrderItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      item.quantity = Math.max(1, item.quantity + delta);
      const modTotal = item.modifiers.reduce((s, m) => s + m.price, 0);
      item.subtotal = +((item.price + modTotal) * item.quantity).toFixed(2);
      updated[idx] = item;
      return updated;
    });
  };

  const clearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDeliveryAddress('');
    setOrderNotes('');
    setSelectedTable('');
    setTableId('');
    if (state.sidebarOrder) {
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null });
    }
  };

  const handleSubmitOrder = async () => {
    if (orderItems.length === 0) { notify('Add at least one item', 'error'); return; }
    if (orderType === 'Dine-In' && !selectedTable) { notify('Select a table', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = {
        orderType,
        tableId: orderType === 'Dine-In' ? tableId : '',
        tableName: orderType === 'Dine-In' ? selectedTable : '',
        items: orderItems,
        customerName,
        customerPhone,
        deliveryAddress: orderType === 'Delivery' ? deliveryAddress : '',
        notes: orderNotes,
        totalAmount: total,
        staffName: state.user?.name || 'Staff',
        staffId: state.user?._id || '',
      };

      let res;
      const isEditingExisting = state.sidebarOrder?._id;
      if (isEditingExisting) {
        // Edit mode: PATCH existing order
        res = await api.patch(`/orders/${state.sidebarOrder._id}`, payload);
        playTing();
        notify(`Order ${res.data.order?.orderNumber || ''} updated!`);
      } else {
        // New order (including table-originated orders)
        res = await api.post('/orders', payload);
        playTing();
        notify(`Order ${res.data.order?.orderNumber || ''} sent!`);
      }

      dispatch({ type: 'SET_PRINT_PROMPT', payload: res.data.order });
      clearOrder();
      setTimeout(() => {
        dispatch({ type: 'SET_TAB', payload: 'ORDERS' });
      }, 400);
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to process order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMenu) return <div className="spinner" />;

  return (
    <div className="order-taking-shell">
      {/* LEFT PANEL: menu */}
      <div className="ot-menu-panel">
        {/* Category strip */}
        <div className="ot-category-strip">
          {categories.map(cat => (
            <button
              key={cat}
              className={`ot-cat-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
              {cat !== 'All' && (
                <span style={{
                  marginLeft: 4,
                  background: activeCategory === cat ? 'rgba(255,255,255,0.25)' : 'var(--gray-200)',
                  borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 700,
                  color: activeCategory === cat ? 'white' : 'var(--gray-500)'
                }}>
                  {menuItems.filter(m => m.category === cat).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Item grid */}
        <div className="ot-item-grid">
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon">🍽️</div>
              <p>No items in this category</p>
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item._id}
                className={`ot-item-card ${!item.isAvailable ? 'ot-item-unavailable' : ''}`}
                onClick={() => handleItemClick(item)}
                disabled={!item.isAvailable}
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl.startsWith('http') ? item.imageUrl : `${BACKEND}${item.imageUrl}`}
                    alt={item.name}
                    className="ot-item-img"
                  />
                ) : (
                  <div className="ot-item-img ot-item-img-placeholder">🍴</div>
                )}
                <div className="ot-item-info">
                  <span className="ot-item-name">{item.name}</span>
                  <span className="ot-item-price">{sym}{item.price.toFixed(2)}</span>
                  {!item.isAvailable && <span className="ot-item-badge">Unavailable</span>}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* RIGHT PANEL: order */}
      {(orderItems.length > 0 || state.sidebarOrder) && (
        <div className="ot-order-panel">
          <div className="ot-order-header" style={{ position: 'relative' }}>
            <h2>
              {state.sidebarOrder?._id
                ? `Edit Order: ${state.sidebarOrder.orderNumber}`
                : state.sidebarOrder?.tableName
                ? `New Order — ${state.sidebarOrder.tableName}`
                : 'New Order'}
            </h2>
            {state.sidebarOrder?._id && (
              <button 
                className="btn btn-sm btn-outline" 
                style={{ position: 'absolute', top: 12, right: 12, fontSize: 10, padding: '2px 8px', minHeight: 'unset', height: '24px' }}
                onClick={() => dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null })}
              >
                ✕ Cancel Edit
              </button>
            )}

            {/* Order Type */}
            <div className="ot-type-tabs">
              {ORDER_TYPES.map(t => (
                <button
                  key={t}
                  className={`ot-type-btn ${orderType === t ? 'active' : ''}`}
                  onClick={() => setOrderType(t)}
                >
                  {t === 'Dine-In' ? '🍽️' : t === 'Takeaway' ? '🛍️' : '🛵'} {t}
                </button>
              ))}
            </div>

            {/* Table selector for Dine-In */}
            {orderType === 'Dine-In' && (
              <select
                className="form-select"
                value={selectedTable}
                onChange={e => setSelectedTable(e.target.value)}
                style={{ marginTop: 8 }}
              >
                <option value="">— Select Table —</option>
                {tables.map(t => (
                  <option key={t._id} value={t.name}>{t.name}{t.status === 'occupied' ? ' (Occupied)' : ''}</option>
                ))}
              </select>
            )}

            {/* Customer fields for Takeaway/Delivery */}
            {(orderType === 'Takeaway' || orderType === 'Delivery') && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input className="form-input" placeholder="Customer Name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                <input className="form-input" placeholder="Phone Number" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
                {orderType === 'Delivery' && (
                  <input className="form-input" placeholder="Delivery Address" value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
                )}
              </div>
            )}
          </div>

          {/* Order items list */}
          <div className="ot-order-items">
            {orderItems.map((item, idx) => (
              <div
                key={idx}
                className="ot-order-line"
                onClick={() => handleEditCartItem(idx)}
                style={{ cursor: 'pointer', transition: 'background-color 0.15s' }}
                title="Click to customize modifiers & notes"
              >
                <div className="ot-order-line__info">
                  <span className="ot-order-line__name">{item.name} <span style={{ fontSize: 10, color: 'var(--primary)' }}>✏️</span></span>
                  {item.modifiers.length > 0 && (
                    <span className="ot-order-line__mods">+{item.modifiers.map(m => m.name).join(', ')}</span>
                  )}
                  {item.notes && <span className="ot-order-line__note">"{item.notes}"</span>}
                </div>
                <div className="ot-order-line__controls" onClick={e => e.stopPropagation()}>
                  <button className="qty-btn" onClick={() => changeQty(idx, -1)}>−</button>
                  <span className="ot-order-line__qty">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => changeQty(idx, 1)}>+</button>
                  <span className="ot-order-line__price">{sym}{item.subtotal.toFixed(2)}</span>
                  <button className="ot-remove-btn" onClick={() => removeOrderItem(idx)}>✕</button>
                </div>
              </div>
            ))}
          </div>

          {/* Order notes */}
          <div className="ot-order-footer">
            <textarea
              className="form-input"
              placeholder="Order notes (optional)…"
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
              style={{ height: 52, resize: 'none', fontSize: 12 }}
            />

            {/* Totals */}
            <div className="ot-totals">
              <div className="ot-total-row"><span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span></div>
              <div className="ot-total-row"><span>Tax ({state.restaurant?.taxRate || 0}%)</span><span>{sym}{tax.toFixed(2)}</span></div>
              <div className="ot-total-row ot-total-final"><span>TOTAL</span><span>{sym}{total.toFixed(2)}</span></div>
            </div>

            <div className="ot-action-row">
              <button className="btn btn-outline" onClick={clearOrder} style={{ flex: 1 }}>{state.sidebarOrder?._id ? 'Discard' : 'Clear'}</button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitOrder}
                disabled={submitting}
                style={{ flex: 2, justifyContent: 'center', fontSize: 15, fontWeight: 700 }}
              >
                {submitting ? 'Saving…' : state.sidebarOrder?._id ? '✓ Update Order' : '✓ Send Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modifier Drawer */}
      {selectedItem && (
        <div className="drawer-overlay" onClick={() => setSelectedItem(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Customize: {selectedItem.name}</h3>
              <p>{selectedItem.category} · {sym}{selectedItem.price.toFixed(2)}</p>
            </div>
            <div className="drawer-body">
              {selectedItem.modifiers?.length > 0 ? (
                <div className="form-group">
                  <label className="form-label">Select Extras</label>
                  {selectedItem.modifiers.map((mod, i) => {
                    const isChecked = chosenMods.some(m => m.name === mod.name);
                    return (
                      <div
                        key={i}
                        className="flex"
                        style={{
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          border: `1px solid ${isChecked ? 'var(--primary)' : 'var(--gray-200)'}`,
                          borderRadius: 'var(--radius-sm)',
                          marginBottom: 8,
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'var(--primary-light)' : 'transparent',
                        }}
                        onClick={() => toggleMod(mod)}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{mod.name}</span>
                        <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>+{sym}{mod.price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted text-sm mb-12">No extras for this item.</p>
              )}
              <div className="form-group">
                <label className="form-label">Item Note</label>
                <textarea className="form-input" placeholder="e.g. No onions" value={itemNotes} onChange={e => setItemNotes(e.target.value)} style={{ height: 52 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <div className="flex gap-12" style={{ alignItems: 'center' }}>
                  <button className="qty-btn" style={{ width: 36, height: 36, fontSize: 20 }} onClick={() => setItemQty(q => Math.max(1, q - 1))}>−</button>
                  <span style={{ fontSize: 20, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{itemQty}</span>
                  <button className="qty-btn" style={{ width: 36, height: 36, fontSize: 20 }} onClick={() => setItemQty(q => q + 1)}>+</button>
                </div>
              </div>
            </div>
            <div className="drawer-footer">
              <div className="flex gap-8">
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setSelectedItem(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={confirmAddItem}>
                  Add {itemQty}× — {sym}{((selectedItem.price + chosenMods.reduce((s, m) => s + m.price, 0)) * itemQty).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
