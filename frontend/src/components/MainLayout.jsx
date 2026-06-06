import { useState, useEffect } from 'react';
import { useApp } from '../store/AppContext';
import OrdersPage from '../pages/OrdersPage';
import TablesPage from '../pages/TablesPage';
import MenuPage from '../pages/MenuPage';
import OrderTakingPage from '../pages/OrderTakingPage';
import StaffPage from '../pages/StaffPage';
import ReportsPage from '../pages/ReportsPage';
import PrintingPage from '../pages/PrintingPage';
import RestaurantPage from '../pages/RestaurantPage';
import WebsitePage from '../pages/WebsitePage';
import AccountPage from '../pages/AccountPage';
import BillingPage from '../pages/BillingPage';
import CEODashboardPage from '../pages/CEODashboardPage';
import OrderSidebar from './OrderSidebar';

const BACKEND = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'http://localhost:5000';

const ROLE_TABS = {
  CEO:     ['CEODASHBOARD', 'ACCOUNT'],
  Admin:   ['ORDERS','TABLES','ORDER','MENU','STAFF','REPORTS','PRINTING','RESTAURANT','WEBSITE','BILLING','ACCOUNT'],
  Waiter:  ['ORDERS','TABLES','ORDER','MENU'],
  Chef:    ['ORDERS','MENU'],
  Cashier: ['ORDERS','TABLES','ORDER','MENU','PRINTING']
};

const PAGE_MAP = {
  ORDERS: OrdersPage, TABLES: TablesPage, ORDER: OrderTakingPage, MENU: MenuPage,
  STAFF: StaffPage, REPORTS: ReportsPage, PRINTING: PrintingPage,
  RESTAURANT: RestaurantPage, WEBSITE: WebsitePage, BILLING: BillingPage,
  CEODASHBOARD: CEODashboardPage, ACCOUNT: AccountPage,
};

const TAB_LABELS = {
  ORDERS: '🧾 ORDERS', TABLES: '🪑 TABLES', ORDER: '➕ NEW ORDER',
  MENU: '🍔 MENU', STAFF: '👥 STAFF', REPORTS: '📊 REPORTS',
  PRINTING: '🖨️ PRINT', RESTAURANT: '🏪 RESTAURANT', WEBSITE: '🌐 WEBSITE',
  BILLING: '💳 SUBSCRIPTION', CEODASHBOARD: '👑 CEO DASHBOARD', ACCOUNT: '👤 ACCOUNT',
};

export default function MainLayout() {
  const { state, dispatch, notify } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const userRole = state.user?.role || 'Waiter';
  const visibleTabs = ROLE_TABS[userRole] || ['ORDERS'];
  const ActivePage = PAGE_MAP[state.activeTab] || OrdersPage;

  // Auto-enforce role permission tab constraints on user switch/login
  useEffect(() => {
    if (state.user && !visibleTabs.includes(state.activeTab)) {
      dispatch({ type: 'SET_TAB', payload: visibleTabs[0] });
    }
  }, [state.user, state.activeTab, visibleTabs, dispatch]);

  // Slide open mobile sidebar drawer automatically when new active order sidebar is set
  useEffect(() => {
    if (state.sidebarOrder) {
      setMobileSidebarOpen(true);
    }
  }, [state.sidebarOrder]);

  const printKOT = (order) => {
    if (!order) return;
    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(`
      <html><head><title>KOT - ${order.orderNumber}</title>
      <style>body{font-family:monospace;padding:16px;font-size:13px}h2{font-size:15px;margin-bottom:4px}hr{border:1px dashed #000}td{padding:2px 4px}</style></head>
      <body>
        <h2>KOT - ${order.orderNumber}</h2>
        <div>${order.orderType} ${order.tableName ? `· Table: ${order.tableName}` : ''}</div>
        <div>${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
        <hr/>
        <table width="100%">
          ${(order.items || []).map(i => `<tr><td>${i.quantity}×</td><td>${i.name}${i.modifiers?.length ? '<br/><small>+ ' + i.modifiers.map(m=>m.name).join(', ') + '</small>' : ''}${i.notes ? '<br/><small>Note: ' + i.notes + '</small>' : ''}</td></tr>`).join('')}
        </table>
        <hr/>
        ${order.notes ? `<div>Notes: ${order.notes}</div>` : ''}
        <script>window.print();window.close();</script>
      </body></html>
    `);
    w.document.close();
  };

  const printBill = (order) => {
    if (!order) return;
    const restaurant = state.restaurant || {};
    const sym = restaurant.currencySymbol || '$';
    const taxRate = (restaurant.taxRate || 0) / 100;
    const orderSubtotal = (order.items || []).reduce((s, i) => s + i.subtotal, 0);
    const orderTax = +(orderSubtotal * taxRate).toFixed(2);
    const orderTotal = order.totalAmount || orderSubtotal + orderTax;
    const w = window.open('', '_blank', 'width=380,height=700');
    if (!w) { alert('Please allow popups to print.'); return; }
    w.document.write(`
      <html><head><title>Bill - ${order.orderNumber}</title>
      <style>body{font-family:monospace;padding:16px;font-size:13px}h2{font-size:16px;text-align:center}hr{border:1px dashed #000}td{padding:2px 4px}.total{font-size:15px;font-weight:bold}</style></head>
      <body>
        <h2>${restaurant.businessName || 'Restaurant'}</h2>
        <div style="text-align:center">${restaurant.address || ''}</div>
        <div style="text-align:center">${restaurant.phone || ''}</div>
        <hr/>
        <div>Bill #: ${order.orderNumber}</div>
        <div>${order.orderType}${order.tableName ? ' · Table: ' + order.tableName : ''}</div>
        ${order.customerName ? `<div>Customer: ${order.customerName}</div>` : ''}
        <div>${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
        <hr/>
        <table width="100%">
          <tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th></tr>
          ${(order.items || []).map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${sym}${i.subtotal.toFixed(2)}</td></tr>`).join('')}
        </table>
        <hr/>
        <div style="text-align:right">Subtotal: ${sym}${orderSubtotal.toFixed(2)}</div>
        <div style="text-align:right">Tax (${restaurant.taxRate || 0}%): ${sym}${orderTax.toFixed(2)}</div>
        <div class="total" style="text-align:right">TOTAL: ${sym}${orderTotal.toFixed(2)}</div>
        <hr/>
        <div style="text-align:center">${restaurant.receiptFooter || 'Thank you!'}</div>
        <script>window.print();window.close();</script>
      </body></html>
    `);
    w.document.close();
  };

  return (
    <>
      {/* HEADER */}
      <header className="main-header">
        <div className="main-header__brand">
          {state.restaurant?.logoUrl ? (
            <img
              src={state.restaurant.logoUrl.startsWith('http') ? state.restaurant.logoUrl : `${BACKEND}${state.restaurant.logoUrl}`}
              alt="logo"
              className="main-header__logo-img"
            />
          ) : (
            <div className="main-header__logo">P</div>
          )}
          <span className="main-header__name">
            {state.restaurant?.businessName || 'POS System'}
          </span>
        </div>
        <div className="main-header__right">
          <div className="main-header__status">
            <span className={`status-dot ${state.isOnline ? '' : 'offline'}`} />
            {state.isOnline ? 'Online' : 'Offline'}
          </div>
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>
            {state.user?.name} · <span style={{ textTransform: 'uppercase', color: 'yellow' }}>{state.user?.role}</span>
          </span>
          <button className="main-header__help" onClick={() => dispatch({ type: 'LOGOUT' })}>
            Logout
          </button>
          <button className="main-header__help">Help</button>
        </div>
      </header>

      {/* NAV */}
      <nav className="main-nav">
        <div className="main-nav__scrollable">
          {visibleTabs.map(tab => (
            <button
              key={tab}
              className={`nav-item ${state.activeTab === tab ? 'active' : ''} ${tab === 'ORDER' ? 'nav-item--cta' : ''}`}
              onClick={() => dispatch({ type: 'SET_TAB', payload: tab })}
            >
              {TAB_LABELS[tab] || tab}
            </button>
          ))}
        </div>
      </nav>

      {/* SHELL */}
      <div className="app-shell">
        <main className="main-content">
          <ActivePage />
        </main>
        {(state.activeTab === 'ORDERS' || state.activeTab === 'TABLES' || state.activeTab === 'MENU') && 
         state.sidebarOrder && state.sidebarOrder.items && state.sidebarOrder.items.length > 0 && (
          <div className={`sidebar-responsive-wrapper ${mobileSidebarOpen ? 'open' : ''}`}>
            <OrderSidebar />
          </div>
        )}
      </div>

      {/* Mobile Drawer Trigger FAB */}
      {state.sidebarOrder && (
        <button
          className="mobile-cart-fab"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          style={{
            display: 'flex',
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: mobileSidebarOpen ? 'var(--danger)' : 'var(--success)',
            color: 'white',
            fontSize: '20px',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
            zIndex: 1300,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {mobileSidebarOpen ? '✕' : '🛒'}
        </button>
      )}

      {/* TOAST */}
      {state.notification && (
        <div className={`toast ${state.notification.type}`}>
          {state.notification.message}
        </div>
      )}

      {/* Global Print Prompt */}
      {state.printPromptOrder && (
        <div className="modal-overlay" onClick={() => dispatch({ type: 'SET_PRINT_PROMPT', payload: null })}>
          <div className="modal" style={{ maxWidth: 380, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
            <h2 style={{ marginBottom: 4 }}>Order Sent!</h2>
            <p className="text-muted text-sm" style={{ marginBottom: 20 }}>
              Would you like to print a copy?
            </p>
            <div className="flex gap-8" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-outline"
                style={{ flex: 1, minWidth: 120 }}
                onClick={() => { printKOT(state.printPromptOrder); dispatch({ type: 'SET_PRINT_PROMPT', payload: null }); }}
              >
                🍳 Print KOT
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, minWidth: 120 }}
                onClick={() => { printBill(state.printPromptOrder); dispatch({ type: 'SET_PRINT_PROMPT', payload: null }); }}
              >
                🧾 Print Bill
              </button>
            </div>
            <button className="btn btn-gray" style={{ marginTop: 10, width: '100%' }} onClick={() => dispatch({ type: 'SET_PRINT_PROMPT', payload: null })}>
              Later
            </button>
          </div>
        </div>
      )}

      {/* Overlay backdrop when mobile drawer is open */}
      {mobileSidebarOpen && state.sidebarOrder && (
        <div 
          className="mobile-drawer-backdrop" 
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(1px)',
            zIndex: 1100
          }}
        />
      )}
    </>
  );
}
