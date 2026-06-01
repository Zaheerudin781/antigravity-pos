import { useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';
import { io } from 'socket.io-client';

function timeAgo(date) {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `about ${Math.floor(diff / 60)} mins ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

const STATUS_COLORS = { pending: 'warning', preparing: 'blue', ready: 'success', served: 'gray', paid: 'success', cancelled: 'danger' };

// Next-step button configuration per status
const STATUS_ACTIONS = {
  pending:   { label: '▶ Mark Preparing',      next: 'preparing', btnClass: 'btn-warning' },
  preparing: { label: '✓ Ready to Serve',      next: 'ready',     btnClass: 'btn-blue'    },
  ready:     { label: '🍽 Mark as Served',     next: 'served',    btnClass: 'btn-success' },
};

// Web Audio "ting" for real-time alerts
function playTing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.45, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45);
  } catch (_) {}
}

// Print a formatted bill in a popup window
function printOrderBill(order, restaurant) {
  const sym = restaurant?.currencySymbol || '$';
  const taxRate = (restaurant?.taxRate || 0) / 100;
  const sub = (order.items || []).reduce((s, i) => s + i.subtotal, 0);
  const tax = +(sub * taxRate).toFixed(2);
  const total = order.totalAmount || sub + tax;
  const w = window.open('', '_blank', 'width=380,height=700');
  if (!w) { alert('Please allow popups to print.'); return; }
  w.document.write(`
    <html><head><title>Bill - ${order.orderNumber}</title>
    <style>body{font-family:monospace;padding:16px;font-size:13px}h2{text-align:center;font-size:16px}hr{border:1px dashed #000}td{padding:2px 4px}.ttl{font-size:15px;font-weight:bold}</style></head>
    <body>
      <h2>${restaurant?.businessName || 'Restaurant'}</h2>
      <div style="text-align:center">${restaurant?.address || ''} ${restaurant?.phone ? '· ' + restaurant.phone : ''}</div>
      <hr/>
      <div>Bill #: <b>${order.orderNumber}</b></div>
      <div>${order.orderType}${order.tableName ? ' · Table: ' + order.tableName : ''}</div>
      ${order.customerName ? `<div>Customer: ${order.customerName}</div>` : ''}
      <div>${new Date(order.createdAt).toLocaleString()}</div>
      <hr/>
      <table width="100%">
        <tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th></tr>
        ${(order.items || []).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${sym}${i.subtotal.toFixed(2)}</td></tr>`).join('')}
      </table>
      <hr/>
      <div style="text-align:right">Subtotal: ${sym}${sub.toFixed(2)}</div>
      <div style="text-align:right">Tax (${restaurant?.taxRate || 0}%): ${sym}${tax.toFixed(2)}</div>
      <div class="ttl" style="text-align:right">TOTAL: ${sym}${total.toFixed(2)}</div>
      <hr/>
      <div style="text-align:center">${restaurant?.receiptFooter || 'Thank you!'}</div>
      <script>window.print();window.close();</script>
    </body></html>
  `);
  w.document.close();
}

export default function OrdersPage() {
  const { state, dispatch, notify } = useApp();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const socketRef = useRef(null);
  const isFirstFetch = useRef(true);

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders);
    } catch { } finally { setLoading(false); }
  };

  // Socket.io real-time updates
  useEffect(() => {
    fetchOrders();

    const socket = io('http://localhost:5000', { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      const tenantId = state.user?.tenantId || state.restaurant?.tenantId;
      if (tenantId) socket.emit('join_tenant', tenantId);
    });

    socket.on('order_update', (data) => {
      setLiveIndicator(true);
      setTimeout(() => setLiveIndicator(false), 1200);
      // Don't ting on very first page load, and don't ting on payments
      if (!isFirstFetch.current && data?.type !== 'payment') playTing();
      isFirstFetch.current = false;
      fetchOrders();
    });

    // Fallback polling every 20 seconds
    const t = setInterval(fetchOrders, 20000);

    return () => {
      socket.disconnect();
      clearInterval(t);
    };
  }, [state.user?.tenantId, state.restaurant?._id]);

  const handlePayment = async (order) => {
    try {
      const { data } = await api.post(`/orders/${order._id}/payment`);
      setOrders(prev => prev.map(o => o._id === order._id ? data.order : o));
    } catch (err) { notify(err.response?.data?.message || 'Payment failed', 'error'); }
  };

  const handleStatusChange = async (orderId, status) => {
    try {
      const { data } = await api.patch(`/orders/${orderId}`, { status });
      setOrders(prev => prev.map(o => o._id === orderId ? data.order : o));
    } catch { }
  };

  const handleCancel = async (order, e) => {
    e.stopPropagation();
    if (!window.confirm(`Cancel order ${order.orderNumber}? This cannot be undone.`)) return;
    try {
      await api.patch(`/orders/${order._id}`, { status: 'cancelled' });
      setOrders(prev => prev.map(o => o._id === order._id ? { ...o, status: 'cancelled' } : o));
      notify(`Order ${order.orderNumber} cancelled`);
    } catch { notify('Failed to cancel order', 'error'); }
  };

  const loadOrderToSidebar = (order) => dispatch({ type: 'SET_SIDEBAR_ORDER', payload: order });

  const goToNewOrder = () => dispatch({ type: 'SET_TAB', payload: 'ORDER' });

  const sym = state.restaurant?.currencySymbol || '$';
  const filtered = filter === 'active'
    ? orders.filter(o => !o.isPaid && o.status !== 'cancelled')
    : filter === 'paid' ? orders.filter(o => o.isPaid)
    : orders;

  if (loading) return <div className="spinner" />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Orders</h1>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`live-dot ${liveIndicator ? 'pulse' : ''}`} />
            Live order feed
          </p>
        </div>
        <div className="flex gap-8" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
          {['active','paid','all'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className="btn btn-primary" onClick={goToNewOrder} style={{ fontWeight: 700 }}>
            ➕ Add New Order
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🧾</div>
          <p>No {filter} orders</p>
          <small>New orders will appear here in real-time</small>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={goToNewOrder}>
            ➕ Place First Order
          </button>
        </div>
      ) : (
        <div className="orders-masonry">
          {filtered.map(order => {
            const action = STATUS_ACTIONS[order.status];
            const isExpanded = expandedCardId === order._id;
            const itemsSummary = order.items.map(i => `${i.quantity}× ${i.name}`).join(', ');

            return (
              <div key={order._id} className="order-card-masonry-item">
              <div 
                className={`order-card-collapsible ${isExpanded ? 'expanded' : ''}`} 
                onClick={() => setExpandedCardId(isExpanded ? null : order._id)}
                style={{ 
                  position: 'relative', 
                  cursor: 'pointer',
                  backgroundColor: 'white',
                  borderRadius: 'var(--radius)',
                  border: isExpanded ? '2px solid var(--primary)' : '1px solid var(--gray-200)',
                  overflow: 'hidden',
                  boxShadow: isExpanded ? 'var(--shadow-md)' : 'var(--shadow)',
                  transition: 'all 0.2s ease',
                  padding: '12px 14px'
                }}
              >
                {/* Collapsed/Header View */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>
                      {order.orderNumber}
                    </span>
                    <span className={`badge badge-${STATUS_COLORS[order.status] || 'gray'}`}>
                      {order.status}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{timeAgo(order.createdAt)} · {order.staffName}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary-dark)' }}>
                      {order.orderType === 'Delivery' ? 'Delivery' : order.orderType === 'Takeaway' ? 'Takeaway' : 'Dine-In'}
                      {order.orderType === 'Dine-In' && order.tableName && ` (${order.tableName})`}
                    </span>
                  </div>

                  {/* Items Summary — one per line when collapsed */}
                  {!isExpanded && (
                    <div style={{ margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {order.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-600)' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>{item.name}</span>
                          <span style={{ flexShrink: 0, color: 'var(--gray-400)' }}>×{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)' }}>
                      Total: {sym}{order.totalAmount.toFixed(2)}
                    </span>
                    {/* Action button always visible on card — stops click-through to expand */}
                    <div onClick={e => e.stopPropagation()}>
                      {action ? (
                        <button
                          className={`btn btn-sm ${action.btnClass}`}
                          style={{ padding: '4px 10px', fontSize: '10px', minHeight: 'unset', height: '26px', fontWeight: 700 }}
                          onClick={() => handleStatusChange(order._id, action.next)}
                        >
                          {order.status === 'pending' ? 'Preparing' : order.status === 'preparing' ? 'Ready' : 'Serve'}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 600 }}>
                          {order.isPaid ? 'Paid' : order.status === 'cancelled' ? 'Cancelled' : 'Served'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Animated Drawer/Tray */}
                <div className={`order-tray-wrapper ${isExpanded ? 'open' : ''}`} style={{ marginTop: isExpanded ? 10 : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: '1px solid var(--gray-200)' }} onClick={e => e.stopPropagation()}>
                    
                    {/* Full Items list — one item per row */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {order.items.map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--gray-700)', padding: '3px 0', borderBottom: '1px solid var(--gray-100)' }}>
                          <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 6 }}>{item.name}</span>
                          <span style={{ color: 'var(--gray-400)', flexShrink: 0, marginRight: 8, fontSize: 11 }}>x{item.quantity}</span>
                          <span style={{ fontWeight: 700, flexShrink: 0, color: 'var(--gray-800)' }}>{sym}{item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {order.notes && (
                      <div style={{ fontSize: 11, color: 'var(--primary)', fontStyle: 'italic', padding: '5px 8px', background: 'var(--primary-light)', borderRadius: 'var(--radius-sm)' }}>
                        <b>Notes:</b> {order.notes}
                      </div>
                    )}

                    {order.customerName && (
                      <div style={{ fontSize: 11, color: 'var(--gray-600)', background: 'var(--gray-50)', padding: '5px 8px', borderRadius: 'var(--radius-sm)' }}>
                        <b>Customer:</b> {order.customerName} {order.customerPhone && `· ${order.customerPhone}`}
                        {order.orderType === 'Delivery' && order.deliveryAddress && (
                          <div style={{ marginTop: 3, fontStyle: 'italic' }}><b>Address:</b> {order.deliveryAddress}</div>
                        )}
                      </div>
                    )}

                    {/* 4-Button Tray: Edit · Print · Paid · Cancel */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>

                      <button
                        className="btn btn-sm btn-outline"
                        style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'unset', height: '26px' }}
                        onClick={() => { loadOrderToSidebar(order); dispatch({ type: 'SET_TAB', payload: 'ORDER' }); }}
                      >
                        Edit
                      </button>

                      <button
                        className="btn btn-sm btn-outline"
                        style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'unset', height: '26px' }}
                        onClick={() => printOrderBill(order, state.restaurant)}
                      >
                        Print
                      </button>

                      <button
                        className="btn btn-sm btn-success"
                        style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'unset', height: '26px' }}
                        onClick={() => handlePayment(order)}
                        disabled={order.isPaid}
                      >
                        Paid
                      </button>

                      <button
                        className="btn btn-sm btn-danger"
                        style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'unset', height: '26px' }}
                        onClick={(e) => handleCancel(order, e)}
                        disabled={order.status === 'cancelled' || order.status === 'paid'}
                      >
                        Cancel
                      </button>

                    </div>
                  </div>
                </div>

              </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
