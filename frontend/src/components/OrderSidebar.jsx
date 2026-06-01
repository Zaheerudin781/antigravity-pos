import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';
import { queueMutation } from '../sync/offlineQueue';

export default function OrderSidebar() {
  const { state, dispatch, notify } = useApp();
  const { sidebarOrder, restaurant, user } = state;
  const [orderType, setOrderType] = useState('Dine-In');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  useEffect(() => {
    if (sidebarOrder) {
      setNotes(sidebarOrder.notes || '');
      setSelectedStaffId(sidebarOrder.staffId || '');
      setOrderType(sidebarOrder.orderType || (sidebarOrder.tableId ? 'Dine-In' : 'Takeaway'));
      setCustomerName(sidebarOrder.customerName || '');
      setCustomerPhone(sidebarOrder.customerPhone || '');
      setDeliveryAddress(sidebarOrder.deliveryAddress || '');
    }
  }, [sidebarOrder]);

  useEffect(() => {
    // Fetch active staff list for the selector
    const fetchStaff = async () => {
      try {
        const { data } = await api.get('/staff');
        setStaffList(data.staff || []);
      } catch (err) {
        console.error('Error fetching staff for sidebar', err);
      }
    };
    if (state.token) fetchStaff();
  }, [state.token]);

  if (!sidebarOrder) {
    return (
      <aside className="order-sidebar">
        <div className="sidebar-header">
          <h3>No Active Order</h3>
          <p>Select a table or click a menu item to start building an order</p>
        </div>
        <div className="sidebar-body flex-center" style={{ flexDirection: 'column' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <p className="text-muted text-sm">Cart is empty</p>
        </div>
      </aside>
    );
  }

  const sym = restaurant?.currencySymbol || '$';
  const taxRate = restaurant?.taxRate ?? 10;

  // Calculate totals
  const subtotal = sidebarOrder.items.reduce((sum, item) => {
    const modPrice = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
    return sum + (item.price + modPrice) * item.quantity;
  }, 0);
  const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
  const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

  const handleQtyChange = (index, delta) => {
    const updatedItems = [...sidebarOrder.items];
    const item = { ...updatedItems[index] };
    item.quantity += delta;
    if (item.quantity <= 0) {
      updatedItems.splice(index, 1);
    } else {
      const modPrice = (item.modifiers || []).reduce((s, m) => s + (m.price || 0), 0);
      item.subtotal = parseFloat(((item.price + modPrice) * item.quantity).toFixed(2));
      updatedItems[index] = item;
    }
    dispatch({
      type: 'SET_SIDEBAR_ORDER',
      payload: { ...sidebarOrder, items: updatedItems },
    });
  };

  const handleSaveOrder = async () => {
    if (sidebarOrder.items.length === 0) {
      notify('Cannot save an empty order', 'error');
      return;
    }

    const matchedStaff = staffList.find(s => s._id === selectedStaffId) || { name: user?.name || 'Manager', _id: user?.id || null };

    // Resolve tableName based on orderType
    let resolvedTableName = sidebarOrder.tableName;
    if (orderType === 'Takeaway') {
      resolvedTableName = 'Takeaway';
    } else if (orderType === 'Delivery') {
      resolvedTableName = 'Delivery';
    } else if (orderType === 'Dine-In' && !sidebarOrder.tableId) {
      resolvedTableName = 'Takeaway'; // fallback
    }

    const orderData = {
      tableId: orderType === 'Dine-In' ? (sidebarOrder.tableId || null) : null,
      tableName: resolvedTableName,
      orderType,
      customerName,
      customerPhone,
      deliveryAddress,
      items: sidebarOrder.items,
      notes,
      staffId: matchedStaff._id,
      staffName: matchedStaff.name,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
    };

    if (!state.isOnline) {
      // Offline mutation queueing
      const mutation = {
        method: sidebarOrder._id ? 'PATCH' : 'POST',
        url: sidebarOrder._id ? `/orders/${sidebarOrder._id}` : '/orders',
        data: orderData,
      };
      await queueMutation(mutation);
      notify('Offline: Order queued for sync!', 'info');
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null });
      return;
    }

    try {
      if (sidebarOrder._id) {
        await api.patch(`/orders/${sidebarOrder._id}`, orderData);
        notify(`Order ${sidebarOrder.orderNumber} updated!`);
      } else {
        const { data } = await api.post('/orders', orderData);
        notify(`Order ${data.order.orderNumber} created successfully!`);
      }
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to save order', 'error');
    }
  };

  const handleCancelOrder = async () => {
    if (!sidebarOrder._id) {
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null });
      return;
    }
    if (!window.confirm('Are you sure you want to delete/cancel this order?')) return;

    if (!state.isOnline) {
      notify('Cannot delete orders while offline', 'error');
      return;
    }

    try {
      await api.delete(`/orders/${sidebarOrder._id}`);
      notify('Order deleted!');
      dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null });
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to delete order', 'error');
    }
  };

  return (
    <aside className="order-sidebar">
      <div className="sidebar-header flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>{orderType === 'Dine-In' ? (sidebarOrder.tableName || 'Dine-In') : orderType}</h3>
          <p>{sidebarOrder._id ? `Editing ${sidebarOrder.orderNumber}` : 'New Order'}</p>
        </div>
        <button className="btn btn-sm btn-outline" onClick={() => dispatch({ type: 'SET_SIDEBAR_ORDER', payload: null })}>
          Clear
        </button>
      </div>

      <div className="sidebar-body">
        {sidebarOrder.items.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <p>Select items from MENU tab</p>
          </div>
        ) : (
          sidebarOrder.items.map((item, idx) => (
            <div key={idx} className="sidebar-item">
              <div className="sidebar-item__name">
                <div>{item.name}</div>
                {item.modifiers && item.modifiers.map((m, i) => (
                  <div key={i} className="sidebar-item__mods">
                    + {m.name} ({sym}{m.price.toFixed(2)})
                  </div>
                ))}
                {item.notes && <div className="sidebar-item__mods" style={{ fontStyle: 'italic' }}>* {item.notes}</div>}
              </div>
              <div className="sidebar-item__qty">
                <button className="qty-btn" onClick={() => handleQtyChange(idx, -1)}>-</button>
                <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                <button className="qty-btn" onClick={() => handleQtyChange(idx, 1)}>+</button>
              </div>
              <div className="sidebar-item__price">
                {sym}{item.subtotal.toFixed(2)}
              </div>
            </div>
          ))
        )}

        <div className="form-group mt-16" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '12px' }}>
          <label className="form-label">Order Type</label>
          <select className="form-select" value={orderType} onChange={e => setOrderType(e.target.value)}>
            <option value="Dine-In">🍽️ Dine-In</option>
            <option value="Takeaway">🛍️ Takeaway</option>
            <option value="Delivery">🛵 Delivery</option>
          </select>
        </div>

        {orderType !== 'Dine-In' && (
          <>
            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input className="form-input" placeholder="e.g. Jane Doe" value={customerName} onChange={e => setCustomerName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Customer Phone</label>
              <input className="form-input" placeholder="e.g. 555-0199" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
            </div>
          </>
        )}

        {orderType === 'Delivery' && (
          <div className="form-group">
            <label className="form-label">Delivery Address</label>
            <textarea
              className="form-input"
              rows="2"
              placeholder="Full physical address for driver"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              style={{ resize: 'none', height: 48 }}
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Order Notes</label>
          <textarea
            className="form-input"
            rows="2"
            placeholder="e.g. Allergy details, packaging instructions"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            style={{ resize: 'none', height: 48 }}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Served By</label>
          <select
            className="form-select"
            value={selectedStaffId}
            onChange={e => setSelectedStaffId(e.target.value)}
          >
            <option value="">{user?.name} (Current Account)</option>
            {staffList.map(s => (
              <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="totals-row">
          <span>Subtotal</span>
          <span>{sym}{subtotal.toFixed(2)}</span>
        </div>
        <div className="totals-row">
          <span>Tax ({taxRate}%)</span>
          <span>{sym}{taxAmount.toFixed(2)}</span>
        </div>
        <div className="totals-row total">
          <span>Total</span>
          <span>{sym}{totalAmount.toFixed(2)}</span>
        </div>

        <div className="flex gap-8 mt-12">
          <button className="btn btn-outline" style={{ flex: 1 }} onClick={handleCancelOrder}>
            {sidebarOrder._id ? 'Cancel Order' : 'Discard'}
          </button>
          <button className="btn btn-success" style={{ flex: 2, justifyContent: 'center' }} onClick={handleSaveOrder}>
            {sidebarOrder._id ? 'Update Order' : 'Send Order'}
          </button>
        </div>
      </div>
    </aside>
  );
}
