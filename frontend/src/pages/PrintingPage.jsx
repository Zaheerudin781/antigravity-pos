import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import api from '../api/axios';

export default function PrintingPage() {
  const { state, notify } = useApp();
  const { restaurant } = state;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [printType, setPrintType] = useState('receipt'); // receipt | kot

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders || []);
      if (data.orders?.length > 0 && !selectedOrder) {
        setSelectedOrder(data.orders[0]);
      }
    } catch {
      notify('Failed to load orders for printing', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handlePrint = () => {
    if (!selectedOrder) return;
    window.print();
  };

  const sym = restaurant?.currencySymbol || '$';

  if (loading) return <div className="spinner" />;

  return (
    <div>
      {/* EVERYTHING IN THIS BLOCK WILL BE HIDDEN ON THE PRINTER VIA .no-print */}
      <div className="no-print">
        <div className="page-header">
          <div>
            <h1>Receipt & KOT Printing</h1>
            <p>Select an order to preview and print its receipts/tickets</p>
          </div>
          <button className="btn btn-primary" onClick={handlePrint} disabled={!selectedOrder}>
            🖨️ Print Now
          </button>
        </div>

        <div className="flex gap-16" style={{ alignItems: 'flex-start' }}>
          {/* Order selection list */}
          <div className="card" style={{ flex: 1, maxHeight: '600px', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Orders Feed</h2>
            {orders.length === 0 ? (
              <p className="text-muted text-sm text-center">No orders available</p>
            ) : (
              orders.map(order => (
                <div
                  key={order._id}
                  className="order-card"
                  style={{
                    cursor: 'pointer',
                    borderColor: selectedOrder?._id === order._id ? 'var(--primary)' : 'var(--gray-200)',
                    backgroundColor: selectedOrder?._id === order._id ? 'var(--primary-light)' : 'white'
                  }}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="order-card__header" style={{ padding: '8px 10px' }}>
                    <span className="order-card__title" style={{ fontSize: 12 }}>{order.orderNumber}</span>
                    <span className="badge badge-gray">{order.tableName}</span>
                  </div>
                  <div className="order-card__body" style={{ padding: '8px 10px', fontSize: 11 }}>
                    <div>Total: {sym}{order.totalAmount.toFixed(2)}</div>
                    <div className="text-muted">{new Date(order.createdAt).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Settings & Live preview */}
          <div style={{ flex: 2 }}>
            <div className="card mb-12">
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Print Settings</h2>
              <div className="form-group">
                <label className="form-label">Template Type</label>
                <div className="flex gap-8">
                  <button
                    className={`btn btn-sm ${printType === 'receipt' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPrintType('receipt')}
                  >
                    Customer Receipt
                  </button>
                  <button
                    className={`btn btn-sm ${printType === 'kot' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setPrintType('kot')}
                  >
                    Kitchen Order Ticket (KOT)
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ backgroundColor: '#fcfcfc', border: '1px dashed #ccc' }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>Live Print Preview</h2>
              
              {selectedOrder ? (
                <div
                  style={{
                    backgroundColor: 'white',
                    padding: '24px 16px',
                    borderRadius: 4,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    maxWidth: 320,
                    margin: '0 auto',
                    fontFamily: 'monospace'
                  }}
                >
                  {printType === 'receipt' ? (
                    <div>
                      <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: 8, marginBottom: 8 }}>
                        <strong style={{ fontSize: 16 }}>{restaurant?.businessName}</strong>
                        <div style={{ fontSize: 11 }}>{restaurant?.address || '123 Main St, New York'}</div>
                        <div style={{ fontSize: 11 }}>Phone: {restaurant?.phone || '555-0199'}</div>
                      </div>
                      <div style={{ fontSize: 11, marginBottom: 8 }}>
                        <div>Order: {selectedOrder.orderNumber}</div>
                        <div>Date: {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                        <div>Table: {selectedOrder.tableName}</div>
                        <div>Server: {selectedOrder.staffName}</div>
                      </div>
                      <div style={{ borderBottom: '1px dashed #000', paddingBottom: 6, marginBottom: 6 }}>
                        {selectedOrder.items.map((item, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, margin: '2px 0' }}>
                            <span>{item.name} x{item.quantity}</span>
                            <span>{sym}{item.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, textAlign: 'right' }}>
                        <div>Subtotal: {sym}{selectedOrder.subtotal.toFixed(2)}</div>
                        <div>Tax ({selectedOrder.taxRate}%): {sym}{selectedOrder.taxAmount.toFixed(2)}</div>
                        <div style={{ fontSize: 13, fontWeight: 'bold', marginTop: 4 }}>
                          Total: {sym}{selectedOrder.totalAmount.toFixed(2)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: 8, marginTop: 8, fontSize: 11 }}>
                        {restaurant?.receiptFooter}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 6, marginBottom: 8 }}>
                        <strong style={{ fontSize: 18 }}>KITCHEN TICKET</strong>
                        <div style={{ fontSize: 12 }}>Order: {selectedOrder.orderNumber}</div>
                        <div style={{ fontSize: 12 }}>Table: {selectedOrder.tableName}</div>
                      </div>
                      <div style={{ fontSize: 12, marginBottom: 8 }}>
                        <div>Time: {new Date(selectedOrder.createdAt).toLocaleTimeString()}</div>
                        <div>Server: {selectedOrder.staffName}</div>
                      </div>
                      <div style={{ borderBottom: '2px solid #000', paddingBottom: 6 }}>
                        {selectedOrder.items.map((item, i) => (
                          <div key={i} style={{ margin: '6px 0', fontSize: 13 }}>
                            <div style={{ fontWeight: 'bold' }}>• {item.name} x{item.quantity}</div>
                            {item.modifiers?.map((m, idx) => (
                              <div key={idx} style={{ paddingLeft: 16, fontSize: 11, color: '#555' }}>
                                + {m.name}
                              </div>
                            ))}
                            {item.notes && (
                              <div style={{ paddingLeft: 16, fontSize: 11, fontStyle: 'italic', color: 'red' }}>
                                * {item.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      {selectedOrder.notes && (
                        <div style={{ marginTop: 8, fontSize: 12 }}>
                          <strong>Notes:</strong> {selectedOrder.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted text-sm text-center">Select an order to see preview</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PRINT-ONLY AREA: HIDDEN ON SCREEN, SHOWN ON PRINTER */}
      {selectedOrder && (
        <div className="print-only-element" style={{ display: 'none' }}>
          {printType === 'receipt' ? (
            <div className="print-receipt">
              <div className="receipt-header">
                <strong>{restaurant?.businessName}</strong><br />
                {restaurant?.address || '123 Main St, New York'}<br />
                Phone: {restaurant?.phone || '555-0199'}
              </div>
              <div style={{ marginBottom: 8 }}>
                <div>Order: {selectedOrder.orderNumber}</div>
                <div>Date: {new Date(selectedOrder.createdAt).toLocaleString()}</div>
                <div>Table: {selectedOrder.tableName}</div>
                <div>Server: {selectedOrder.staffName}</div>
              </div>
              <div style={{ borderBottom: '1px dashed #000', paddingBottom: 6, marginBottom: 6 }}>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="receipt-row">
                    <span>{item.name} x{item.quantity}</span>
                    <span>{sym}{item.subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>Subtotal: {sym}{selectedOrder.subtotal.toFixed(2)}</div>
                <div>Tax ({selectedOrder.taxRate}%): {sym}{selectedOrder.taxAmount.toFixed(2)}</div>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>Total: {sym}{selectedOrder.totalAmount.toFixed(2)}</div>
              </div>
              <div className="receipt-footer">
                {restaurant?.receiptFooter}
              </div>
            </div>
          ) : (
            <div className="print-kot">
              <div className="kot-header">
                <strong>KITCHEN TICKET</strong><br />
                Order: {selectedOrder.orderNumber}<br />
                Table: {selectedOrder.tableName}
              </div>
              <div style={{ margin: '8px 0' }}>
                <div>Time: {new Date(selectedOrder.createdAt).toLocaleTimeString()}</div>
                <div>Server: {selectedOrder.staffName}</div>
              </div>
              <div style={{ borderBottom: '2px solid #000', paddingBottom: 6 }}>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} className="kot-item">
                    {item.name} x{item.quantity}
                    {item.modifiers?.map((m, idx) => (
                      <div key={idx} className="kot-modifier">+ {m.name}</div>
                    ))}
                    {item.notes && (
                      <div className="kot-modifier" style={{ fontStyle: 'italic', color: 'red' }}>* {item.notes}</div>
                    )}
                  </div>
                ))}
              </div>
              {selectedOrder.notes && (
                <div style={{ marginTop: 8, fontSize: 12 }}>
                  <strong>Notes:</strong> {selectedOrder.notes}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Style injection to handle screen vs print displays for the print-only-element */}
      <style>{`
        @media screen {
          .print-only-element { display: none !important; }
        }
        @media print {
          .print-only-element { display: block !important; }
        }
      `}</style>
    </div>
  );
}
