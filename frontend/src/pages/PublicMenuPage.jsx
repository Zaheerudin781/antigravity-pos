import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function PublicMenuPage({ slug }) {
  const [restaurant, setRestaurant] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interactive navigation
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Customer Cart States
  const [cart, setCart] = useState([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [selectedItemForMod, setSelectedItemForMod] = useState(null);
  const [orderItemMods, setOrderItemMods] = useState([]);
  const [orderItemNotes, setOrderItemNotes] = useState('');
  const [orderItemQty, setOrderItemQty] = useState(1);

  // Customer Checkout Details (Pre-filled from localStorage)
  const [checkoutForm, setCheckoutForm] = useState({
    customerName: localStorage.getItem('guest_name') || '',
    customerPhone: localStorage.getItem('guest_phone') || '',
    orderType: 'Takeaway', // Dine-In, Takeaway, Delivery
    tableNumber: '',
    deliveryAddress: localStorage.getItem('guest_address') || '',
    notes: '',
    saveDetails: true,
    paymentMethod: 'COD', // COD, Card
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    cardName: ''
  });

  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [toast, setToast] = useState(null);

  // Tracking view state
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState(localStorage.getItem(`active_order_${slug}`) || null);
  const [trackingOrder, setTrackingOrder] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // 1% luxury additions: Theme & Dietary selection
  const [darkMode, setDarkMode] = useState(localStorage.getItem('guest_dark_mode') === 'true');
  const [dietaryFilter, setDietaryFilter] = useState('All'); // All | Veg | GF | Spicy | Chef

  const toggleDarkMode = () => {
    const nextVal = !darkMode;
    setDarkMode(nextVal);
    localStorage.setItem('guest_dark_mode', String(nextVal));
  };

  const triggerToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch menu + restaurant info
  useEffect(() => {
    const fetchPublicMenu = async () => {
      try {
        const { data } = await api.get(`/public-menu/${slug}`);
        setRestaurant(data.restaurant);
        setMenuItems(data.items || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Digital menu is offline or slug is invalid');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchPublicMenu();
  }, [slug]);

  // Order Tracking Status Polling (every 10s)
  useEffect(() => {
    let interval = null;
    const fetchOrderStatus = async () => {
      if (!activeTrackingOrderId) return;
      try {
        const { data } = await api.get(`/public-menu/${slug}/order/${activeTrackingOrderId}/status`);
        setTrackingOrder(data);
      } catch (err) {
        console.error('Tracking fetch error', err);
      }
    };

    if (activeTrackingOrderId) {
      fetchOrderStatus();
      interval = setInterval(fetchOrderStatus, 10000);
    } else {
      setTrackingOrder(null);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTrackingOrderId, slug]);

  if (loading) {
    return (
      <div className="premium-spinner-container">
        <div className="premium-spinner"></div>
        <p className="premium-spinner-text">Loading Culinary Experience...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <div className="error-icon">🍽️</div>
          <h2>Menu Temporarily Offline</h2>
          <p>{error}</p>
          <button className="premium-btn btn-amber" onClick={() => window.location.reload()}>Try Reconnecting</button>
        </div>
      </div>
    );
  }

  const sym = restaurant?.currencySymbol || '$';
  const taxRate = restaurant?.taxRate || 10;
  const categories = ['All', ...new Set(menuItems.map(m => m.category))];

  // Helper to dynamically analyze and tag food items for 1% UX
  const getItemTags = (item) => {
    const name = item.name.toLowerCase();
    const desc = (item.description || '').toLowerCase();
    const tags = [];
    
    // Vegetarian / Vegan
    const hasMeat = name.includes('pepperoni') || name.includes('steak') || name.includes('salmon') || name.includes('chicken') || name.includes('beef') || name.includes('bacon');
    if (!hasMeat) {
      tags.push('🌱 Veg');
    }
    
    // Gluten Free
    if (desc.includes('gluten free') || desc.includes('gluten-free') || name.includes('juice') || name.includes('lemonade') || name.includes('salad') || name.includes('salmon') || name.includes('fries')) {
      tags.push('🌾 GF');
    }
    
    // Spicy
    if (desc.includes('spicy') || desc.includes('jalapeno') || desc.includes('chili') || desc.includes('hot') || name.includes('pepperoni')) {
      tags.push('🔥 Spicy');
    }
    
    // Chef's Special
    if (name.includes('margherita') || name.includes('cheeseburger') || name.includes('steak') || name.includes('tiramisu')) {
      tags.push('✨ Chef Special');
    }
    
    return tags;
  };

  // Search and filter logic
  const filtered = menuItems.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory;
    const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    let matchDietary = true;
    if (dietaryFilter !== 'All') {
      const tags = getItemTags(item);
      if (dietaryFilter === 'Veg') matchDietary = tags.includes('🌱 Veg');
      else if (dietaryFilter === 'GF') matchDietary = tags.includes('🌾 GF');
      else if (dietaryFilter === 'Spicy') matchDietary = tags.includes('🔥 Spicy');
      else if (dietaryFilter === 'Chef') matchDietary = tags.includes('✨ Chef Special');
    }
    
    return matchCat && matchSearch && matchDietary;
  });

  // Cart operations
  const handleItemCardClick = (item) => {
    if (!item.isAvailable) return;
    setSelectedItemForMod(item);
    setOrderItemMods([]);
    setOrderItemNotes('');
    setOrderItemQty(1);
  };

  const handleToggleMod = (mod) => {
    setOrderItemMods(prev =>
      prev.some(m => m.name === mod.name) ? prev.filter(m => m.name !== mod.name) : [...prev, mod]
    );
  };

  const handleAddToCart = () => {
    if (!selectedItemForMod) return;
    const modTotal = orderItemMods.reduce((s, m) => s + m.price, 0);
    const itemSubtotal = parseFloat(((selectedItemForMod.price + modTotal) * orderItemQty).toFixed(2));

    const newCartItem = {
      menuItemId: selectedItemForMod._id,
      name: selectedItemForMod.name,
      price: selectedItemForMod.price,
      quantity: orderItemQty,
      modifiers: orderItemMods,
      notes: orderItemNotes,
      subtotal: itemSubtotal
    };

    setCart(prev => {
      const updated = [...prev];
      const existingIdx = updated.findIndex(i =>
        i.menuItemId === newCartItem.menuItemId &&
        JSON.stringify(i.modifiers) === JSON.stringify(newCartItem.modifiers) &&
        i.notes === newCartItem.notes
      );
      if (existingIdx > -1) {
        updated[existingIdx].quantity += newCartItem.quantity;
        updated[existingIdx].subtotal = parseFloat(((updated[existingIdx].price + modTotal) * updated[existingIdx].quantity).toFixed(2));
      } else {
        updated.push(newCartItem);
      }
      return updated;
    });

    triggerToast(`Added ${orderItemQty}x ${selectedItemForMod.name} to cart`);
    setSelectedItemForMod(null);
  };

  const handleCartQty = (idx, delta) => {
    setCart(prev => {
      const updated = [...prev];
      const item = { ...updated[idx] };
      item.quantity += delta;
      if (item.quantity <= 0) {
        updated.splice(idx, 1);
      } else {
        const modTotal = (item.modifiers || []).reduce((s, m) => s + m.price, 0);
        item.subtotal = parseFloat(((item.price + modTotal) * item.quantity).toFixed(2));
        updated[idx] = item;
      }
      return updated;
    });
  };

  // Compute totals
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = parseFloat((subtotal * taxRate / 100).toFixed(2));
  const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
  const totalCartQty = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Submit Order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!checkoutForm.customerName || !checkoutForm.customerPhone) {
      triggerToast('Name and phone number are required', 'error');
      return;
    }
    if (checkoutForm.orderType === 'Dine-In' && !checkoutForm.tableNumber) {
      triggerToast('Please specify a Table Number', 'error');
      return;
    }
    if (checkoutForm.orderType === 'Delivery' && !checkoutForm.deliveryAddress) {
      triggerToast('Delivery address is required', 'error');
      return;
    }

    if (checkoutForm.paymentMethod === 'Card') {
      if (!checkoutForm.cardNumber || !checkoutForm.cardExpiry || !checkoutForm.cardCvc || !checkoutForm.cardName) {
        triggerToast('Please complete credit card details', 'error');
        return;
      }
    }

    setSubmittingOrder(true);
    try {
      // Save details to localStorage if selected (Smart Guest Checkout)
      if (checkoutForm.saveDetails) {
        localStorage.setItem('guest_name', checkoutForm.customerName);
        localStorage.setItem('guest_phone', checkoutForm.customerPhone);
        if (checkoutForm.orderType === 'Delivery') {
          localStorage.setItem('guest_address', checkoutForm.deliveryAddress);
        }
      }

      const payload = {
        items: cart,
        orderType: checkoutForm.orderType,
        customerName: checkoutForm.customerName,
        customerPhone: checkoutForm.customerPhone,
        deliveryAddress: checkoutForm.orderType === 'Delivery' ? checkoutForm.deliveryAddress : '',
        notes: `${checkoutForm.notes}${checkoutForm.paymentMethod === 'Card' ? ' [PAID ONLINE via SimCard]' : ' [COD / Pay at Counter]'}`.trim(),
        tableName: checkoutForm.orderType === 'Dine-In' ? `Table ${checkoutForm.tableNumber}` : checkoutForm.orderType
      };

      const { data } = await api.post(`/public-menu/${slug}/order`, payload);
      
      // Store in localStorage for active order tracking
      localStorage.setItem(`active_order_${slug}`, data.order._id);
      setActiveTrackingOrderId(data.order._id);
      setTrackingOrder(data.order);
      
      // Reset cart and states
      setCart([]);
      setShowCartDrawer(false);
      triggerToast('Order placed! Kitchen notified.');
    } catch (err) {
      triggerToast(err.response?.data?.message || 'Failed to place order. Try again.', 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Helper to resolve progress timeline colors and labels
  const getTimelineStatusStep = (status) => {
    switch (status) {
      case 'pending': return 1;
      case 'preparing': return 2;
      case 'ready': return 3;
      case 'served':
      case 'paid': return 4;
      case 'cancelled': return -1;
      default: return 1;
    }
  };

  const currentStep = trackingOrder ? getTimelineStatusStep(trackingOrder.status) : 1;

  return (
    <div className="consumer-theme">
      {/* Dynamic Fonts from Google Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&display=swap" rel="stylesheet" />
      
      {/* EMBEDDED CONSUMER STYLESHEET */}
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          /* CLASSIC IVORY THEME (Light) */
          --bg-primary: #FAF8F5;
          --bg-secondary: #FFFDFB;
          --bg-tertiary: #F5EFEB;
          --bg-glass: rgba(255, 253, 251, 0.85);
          --border-color: rgba(212, 196, 179, 0.4);
          --border-glow: #D9A05B;
          --text-primary: #1C1917;
          --text-secondary: #57534E;
          --text-muted: #8C867F;
          --accent-gold: #D97706;
          --accent-gold-hover: #B45309;
          --accent-cream: #FDF3E7;
          --shadow-sm: 0 2px 8px rgba(28, 25, 23, 0.03);
          --shadow-md: 0 10px 30px rgba(28, 25, 23, 0.06);
          --shadow-lg: 0 20px 50px rgba(28, 25, 23, 0.1);
          --receipt-bg: #FFFDFB;
          --receipt-shadow: rgba(28, 25, 23, 0.05);
        }

        .consumer-theme.dark-mode {
          /* NOIR GOLD THEME (Dark) */
          --bg-primary: #0C0B0A;
          --bg-secondary: #141211;
          --bg-tertiary: #1E1A18;
          --bg-glass: rgba(20, 18, 17, 0.85);
          --border-color: rgba(217, 160, 91, 0.15);
          --border-glow: #D9A05B;
          --text-primary: #F5F5F4;
          --text-secondary: #D6D3D1;
          --text-muted: #A8A29E;
          --accent-gold: #FBBF24;
          --accent-gold-hover: #F59E0B;
          --accent-cream: rgba(217, 160, 91, 0.08);
          --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.4);
          --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.6);
          --shadow-lg: 0 20px 50px rgba(0, 0, 0, 0.8);
          --receipt-bg: #1A1817;
          --receipt-shadow: rgba(0, 0, 0, 0.4);
        }

        .consumer-theme {
          font-family: 'Plus Jakarta Sans', sans-serif;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          min-height: 100vh;
          overflow-x: hidden;
          padding-bottom: 80px;
          transition: background-color 0.4s ease, color 0.4s ease;
        }

        /* --- STICKY NAV --- */
        .premium-nav-bar {
          position: sticky;
          top: 0;
          z-index: 900;
          background: var(--bg-glass);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--border-color);
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: var(--shadow-sm);
        }
        .premium-nav-logo {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 700;
          font-size: 24px;
          letter-spacing: -0.5px;
          color: var(--accent-gold);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .premium-nav-logo span {
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 18px;
          box-shadow: 0 4px 10px rgba(217, 119, 6, 0.25);
        }
        .nav-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* --- IMMERSIVE HERO --- */
        .premium-hero {
          position: relative;
          background: linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.75)), url('https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=1200&auto=format&fit=crop');
          background-size: cover;
          background-position: center;
          color: white;
          text-align: center;
          padding: 110px 24px 90px;
          border-bottom-left-radius: 32px;
          border-bottom-right-radius: 32px;
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }
        .premium-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          border-bottom: 2px solid rgba(217, 160, 91, 0.3);
          border-bottom-left-radius: 32px;
          border-bottom-right-radius: 32px;
          pointer-events: none;
        }
        .premium-hero h1 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 54px;
          font-weight: 700;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
          line-height: 1.1;
          background: linear-gradient(to right, #FFFFFF 30%, #FBBF24 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .premium-hero p {
          font-size: 16px;
          opacity: 0.85;
          font-weight: 300;
          max-width: 650px;
          margin: 0 auto 28px;
          line-height: 1.7;
        }
        .info-strip {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .info-pill {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          padding: 8px 18px;
          border-radius: 24px;
          font-size: 13px;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: transform 0.2s, background-color 0.2s;
        }
        .info-pill:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.15);
        }

        /* --- THEME TOGGLE BUTTON --- */
        .theme-toggle-btn {
          background: var(--accent-cream);
          border: 1px solid var(--border-color);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          color: var(--accent-gold);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .theme-toggle-btn:hover {
          transform: scale(1.08) rotate(15deg);
          border-color: var(--accent-gold);
          background: var(--bg-primary);
        }

        /* --- STORY SECTION --- */
        .story-section {
          max-width: 960px;
          margin: 60px auto 30px;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 40px;
          align-items: center;
        }
        .story-content h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 36px;
          color: var(--text-primary);
          margin-bottom: 16px;
          line-height: 1.2;
        }
        .story-content p {
          font-size: 14.5px;
          color: var(--text-secondary);
          line-height: 1.7;
          margin-bottom: 20px;
        }
        .story-quote {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          font-style: italic;
          font-weight: 500;
          color: var(--accent-gold);
          border-left: 2px solid var(--accent-gold);
          padding-left: 16px;
          margin: 16px 0;
        }
        .story-hours {
          background: var(--bg-secondary);
          border-radius: 20px;
          padding: 28px;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
        }
        .story-hours h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 18px;
          color: var(--accent-gold);
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
          letter-spacing: 0.5px;
        }
        .story-hours-row {
          display: flex;
          justify-content: space-between;
          font-size: 13.5px;
          margin-bottom: 10px;
          color: var(--text-secondary);
        }
        .story-hours-row:last-of-type {
          margin-bottom: 0;
        }

        /* --- DIETARY AND FILTER PILLS BAR --- */
        .filter-section-wrapper {
          position: sticky;
          top: 73px;
          z-index: 800;
          background: var(--bg-glass);
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          border-bottom: 1px solid var(--border-color);
          padding: 12px 24px;
        }
        .filter-section-inner {
          max-width: 960px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .category-filter-strip {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .category-filter-strip::-webkit-scrollbar { display: none; }
        
        .dietary-filter-strip {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .dietary-filter-strip::-webkit-scrollbar { display: none; }

        .filter-pill {
          padding: 8px 18px;
          border-radius: 24px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-secondary);
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .filter-pill:hover {
          border-color: var(--accent-gold);
          color: var(--accent-gold);
          transform: translateY(-1px);
        }
        .filter-pill.active {
          background: var(--accent-gold);
          border-color: var(--accent-gold);
          color: var(--bg-primary);
          box-shadow: 0 4px 12px rgba(217, 119, 6, 0.25);
        }

        .dietary-pill {
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid var(--border-color);
          background: transparent;
          color: var(--text-muted);
          font-size: 11.5px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s;
        }
        .dietary-pill:hover {
          color: var(--text-primary);
          border-color: var(--text-muted);
        }
        .dietary-pill.active {
          background: var(--accent-cream);
          border-color: var(--border-glow);
          color: var(--accent-gold);
          font-weight: 700;
        }

        /* --- ENGINE LAYOUT CONTAINER --- */
        .menu-container {
          max-width: 960px;
          margin: 40px auto 0;
          padding: 0 24px;
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 40px;
        }
        .search-box-wrap {
          margin-bottom: 24px;
          position: relative;
        }
        .search-input {
          width: 100%;
          padding: 14px 16px 14px 44px;
          border-radius: 14px;
          border: 1px solid var(--border-color);
          font-size: 14px;
          outline: none;
          color: var(--text-primary);
          background: var(--bg-secondary);
          box-shadow: var(--shadow-sm);
          transition: all 0.3s ease;
        }
        .search-input:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.12);
        }
        .search-icon {
          position: absolute;
          left: 16px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-size: 16px;
        }

        /* --- LEFT SIDEBAR CATEGORIES --- */
        .desktop-only-sidebar button {
          display: block;
          text-align: left;
          background: none;
          border: none;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.25s ease;
          width: 100%;
          border-left: 2px solid transparent;
        }
        .desktop-only-sidebar button:hover {
          color: var(--accent-gold);
          background-color: var(--accent-cream);
        }
        .desktop-only-sidebar button.active {
          font-weight: 700;
          color: var(--accent-gold);
          background-color: var(--accent-cream);
          border-left-color: var(--accent-gold);
        }

        /* --- PREMIUM MENU ITEM CARDS --- */
        .menu-grid-items {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .premium-item-card {
          background: var(--bg-secondary);
          border-radius: 20px;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          display: flex;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          position: relative;
        }
        .premium-item-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
          border-color: var(--border-glow);
        }
        .premium-item-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          border: 1px solid transparent;
          pointer-events: none;
          transition: border-color 0.3s;
        }
        .premium-item-card:hover::after {
          border-color: rgba(217, 160, 91, 0.3);
        }

        .premium-item-img-container {
          width: 150px;
          height: 150px;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
        }
        .premium-item-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .premium-item-card:hover .premium-item-img {
          transform: scale(1.08);
        }
        .premium-item-placeholder {
          width: 150px;
          height: 150px;
          background: var(--bg-tertiary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 36px;
          flex-shrink: 0;
          color: var(--text-muted);
          border-right: 1px solid var(--border-color);
        }

        .premium-item-body {
          padding: 20px;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .premium-item-meta {
          font-size: 10px;
          font-weight: 700;
          color: var(--accent-gold);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .premium-item-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px;
          font-weight: 700;
          color: var(--text-primary);
          margin: 4px 0;
          line-height: 1.2;
        }
        .premium-item-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .food-badge-container {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .food-badge {
          font-size: 10px;
          background: var(--accent-cream);
          padding: 3px 8px;
          border-radius: 6px;
          color: var(--accent-gold);
          font-weight: 700;
          border: 1px solid rgba(217, 160, 91, 0.2);
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }

        .premium-item-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: auto;
        }
        .premium-item-price {
          font-size: 18px;
          font-weight: 800;
          color: var(--text-primary);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .add-cart-btn {
          background: var(--text-primary);
          color: var(--bg-secondary);
          border: none;
          padding: 8px 18px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .premium-item-card:hover .add-cart-btn {
          background: var(--accent-gold);
          color: white;
          box-shadow: 0 4px 10px rgba(217, 119, 6, 0.2);
        }

        /* --- DRAWERS & DIALOGS --- */
        .drawer-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 1500;
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          transition: opacity 0.3s;
        }
        .drawer {
          position: fixed;
          right: 0; top: 0; bottom: 0;
          width: 480px;
          max-width: 100vw;
          background: var(--bg-secondary);
          z-index: 1600;
          box-shadow: -10px 0 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          animation: slideLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1);
          border-left: 1px solid var(--border-color);
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-header {
          padding: 24px 28px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .drawer-header h3 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 24px;
          font-weight: 700;
          color: var(--text-primary);
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 28px;
        }
        .drawer-footer {
          padding: 24px 28px;
          border-top: 1px solid var(--border-color);
          background: var(--bg-tertiary);
        }

        /* --- CHOICE CHIPS FOR MODIFIERS --- */
        .modifier-chip-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 18px;
        }
        .modifier-chip-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          cursor: pointer;
          background: var(--bg-secondary);
          transition: all 0.2s ease;
        }
        .modifier-chip-row:hover {
          border-color: var(--accent-gold);
          background: var(--accent-cream);
        }
        .modifier-chip-row.selected {
          border-color: var(--accent-gold);
          background: var(--accent-cream);
          box-shadow: 0 2px 8px rgba(217,119,6,0.1);
        }
        .modifier-chip-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .modifier-chip-checkbox {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: transparent;
          transition: all 0.2s;
        }
        .modifier-chip-row.selected .modifier-chip-checkbox {
          border-color: var(--accent-gold);
          background: var(--accent-gold);
          color: var(--bg-primary);
        }

        /* --- CUSTOM STEPPER AND QUANTITY BTNS --- */
        .qty-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .qty-btn:hover {
          border-color: var(--text-primary);
          background: var(--bg-tertiary);
        }

        /* --- STYLISH DUAL CHECKOUT FIELDS --- */
        .checkout-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted);
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .form-input, .form-select {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          font-size: 13.5px;
          color: var(--text-primary);
          background: var(--bg-secondary);
          outline: none;
          transition: all 0.3s;
        }
        .form-input:focus, .form-select:focus {
          border-color: var(--accent-gold);
          box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.1);
        }

        /* --- SERRATED RECEIPT BORDER --- */
        .digital-receipt {
          background: var(--receipt-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: 0 15px 40px var(--receipt-shadow);
          padding: 24px;
          position: relative;
          overflow: hidden;
          margin-bottom: 20px;
        }
        .digital-receipt::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(135deg, var(--accent-gold) 0%, var(--border-glow) 100%);
        }
        .serrated-edge {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 8px;
          background-image: linear-gradient(-45deg, var(--bg-terary, #fafaf9) 4px, transparent 0), 
                            linear-gradient(45deg, var(--bg-terary, #fafaf9) 4px, transparent 0);
          background-position: left bottom;
          background-repeat: repeat-x;
          background-size: 12px 8px;
        }
        .dark-mode .serrated-edge {
          background-image: linear-gradient(-45deg, var(--bg-tertiary) 4px, transparent 0), 
                            linear-gradient(45deg, var(--bg-tertiary) 4px, transparent 0);
        }

        /* --- ULTRA-PREMIUM METALLIC CREDIT CARD --- */
        .stripe-mock-card {
          background: linear-gradient(135deg, #1A1A1A 0%, #3D352E 50%, #0D0D0D 100%);
          border: 1px solid rgba(217, 160, 91, 0.35);
          border-radius: 16px;
          padding: 20px;
          color: #F3EFE9;
          margin-bottom: 20px;
          position: relative;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.15);
          overflow: hidden;
        }
        .stripe-mock-card::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 80%);
          pointer-events: none;
        }
        .card-reflection {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(217, 160, 91, 0.12) 45%, rgba(255, 255, 255, 0.18) 50%, rgba(217, 160, 91, 0.12) 55%, transparent 60%);
          background-size: 200% 100%;
          animation: cardGlimmer 6s infinite linear;
          pointer-events: none;
        }
        @keyframes cardGlimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .card-chip {
          width: 44px;
          height: 32px;
          background: linear-gradient(135deg, #FFE0B2 0%, #FFB74D 100%);
          border-radius: 6px;
          border: 1px solid rgba(0,0,0,0.1);
          box-shadow: inset 0 1px 2px rgba(255,255,255,0.3);
          margin-bottom: 16px;
        }
        .card-number-input {
          font-family: 'Courier New', Courier, monospace;
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(217,160,91,0.25);
          color: #FFFDFB;
          font-size: 18px;
          width: 100%;
          padding: 8px 12px;
          border-radius: 8px;
          letter-spacing: 3px;
          margin-bottom: 16px;
          outline: none;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .card-number-input:focus {
          border-color: var(--accent-gold);
        }
        .card-meta-wrap {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 16px;
        }
        .card-sub-input {
          background: rgba(0,0,0,0.45);
          border: 1px solid rgba(217,160,91,0.25);
          color: #FFFDFB;
          font-size: 13px;
          padding: 8px 12px;
          border-radius: 8px;
          outline: none;
          width: 100%;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.5);
        }
        .card-sub-input:focus {
          border-color: var(--accent-gold);
        }

        /* --- VISUAL TIMELINE TRACKER --- */
        .tracking-header {
          text-align: center;
          padding: 48px 24px 20px;
          max-width: 600px;
          margin: 0 auto;
        }
        .tracking-header h2 {
          font-family: 'Cormorant Garamond', serif;
          font-size: 40px;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .visual-timeline {
          max-width: 600px;
          margin: 40px auto;
          padding: 0 24px;
          display: flex;
          justify-content: space-between;
          position: relative;
        }
        .timeline-line {
          position: absolute;
          top: 18px; left: 40px; right: 40px;
          height: 4px;
          background: var(--border-color);
          z-index: 1;
          border-radius: 2px;
        }
        .timeline-line-progress {
          position: absolute;
          top: 18px; left: 40px;
          height: 4px;
          background: #10b981;
          transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
          z-index: 2;
          border-radius: 2px;
        }
        .timeline-node {
          position: relative;
          z-index: 5;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 80px;
          text-align: center;
        }
        .timeline-icon-outer {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: var(--bg-secondary);
          border: 3px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);
          color: var(--text-muted);
        }
        .timeline-node.active .timeline-icon-outer {
          border-color: #10b981;
          background: #e6f4ea;
          color: #10b981;
          transform: scale(1.15);
          animation: pulseGreen 2s infinite;
        }
        .timeline-node.completed .timeline-icon-outer {
          border-color: #10b981;
          background: #10b981;
          color: white;
        }
        .timeline-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
        }
        .timeline-node.active .timeline-label { color: #10b981; font-weight: 700; }
        .timeline-node.completed .timeline-label { color: var(--text-primary); }

        @keyframes pulseGreen {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        /* --- STEAM COOKING PROGRESS ANIMATION --- */
        .steam-container {
          height: 35px;
          position: relative;
          width: 100%;
          margin: 0 auto;
          display: flex;
          justify-content: center;
          gap: 6px;
        }
        .steam-puff {
          width: 6px;
          height: 14px;
          background: rgba(168, 162, 158, 0.45);
          border-radius: 50%;
          opacity: 0;
          animation: riseSteam 2.5s infinite linear;
        }
        .steam-puff:nth-child(2) {
          animation-delay: 0.6s;
          background: rgba(168, 162, 158, 0.35);
        }
        .steam-puff:nth-child(3) {
          animation-delay: 1.2s;
          background: rgba(168, 162, 158, 0.55);
        }
        @keyframes riseSteam {
          0% { transform: translateY(18px) scale(0.6); opacity: 0; }
          20% { opacity: 0.7; }
          50% { transform: translateY(8px) scale(1.1) skewX(-6deg); opacity: 0.5; }
          80% { opacity: 0.2; }
          100% { transform: translateY(-4px) scale(1.4) skewX(6deg); opacity: 0; }
        }

        /* --- FLOATING TRACKING BAR --- */
        .floating-tracking-bar {
          position: fixed;
          bottom: 24px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: var(--text-primary);
          color: var(--bg-secondary);
          padding: 14px 24px;
          border-radius: 30px;
          box-shadow: var(--shadow-lg);
          display: flex;
          align-items: center;
          gap: 16px;
          font-size: 13.5px;
          border: 1px solid rgba(255,255,255,0.1);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideUp {
          from { transform: translate(-50%, 100px); }
          to { transform: translate(-50%, 0); }
        }
        .tracking-status-badge {
          background: #10b981;
          color: white;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 10.5px;
          text-transform: uppercase;
        }

        /* --- RESPONSIVENESS --- */
        @media(max-width: 768px) {
          .menu-container {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .desktop-only-sidebar {
            display: none;
          }
          .story-section {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .premium-hero h1 { font-size: 38px; }
          .drawer { width: 100vw; }
          .premium-nav-bar { padding: 12px 20px; }
        }

        /* --- HELPERS --- */
        .premium-spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: var(--bg-primary);
        }
        .premium-spinner {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 4px solid var(--accent-cream);
          border-top-color: var(--accent-gold);
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .premium-spinner-text {
          margin-top: 20px;
          font-size: 15px;
          font-weight: 600;
          color: var(--accent-gold);
          letter-spacing: 0.5px;
        }
        .error-screen {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: 24px;
        }
        .error-card {
          background: var(--bg-secondary);
          border-radius: 24px;
          border: 1px solid var(--border-color);
          padding: 40px 28px;
          max-width: 440px;
          text-align: center;
          box-shadow: var(--shadow-md);
        }
        .error-icon { font-size: 56px; margin-bottom: 20px; }
        .error-card h2 { font-family: 'Cormorant Garamond', serif; margin-bottom: 10px; font-size: 24px; color: var(--text-primary); }
        .error-card p { font-size: 14px; color: var(--text-secondary); margin-bottom: 28px; line-height: 1.6; }
        .premium-btn {
          border: none;
          padding: 10px 24px;
          border-radius: 24px;
          font-size: 13.5px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .btn-amber { background: var(--accent-gold); color: var(--bg-primary); }
        .btn-amber:hover { background: var(--accent-gold-hover); transform: translateY(-1px); }
        .btn-outline {
          background: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
        }
        .btn-outline:hover {
          border-color: var(--text-primary);
          background: var(--bg-tertiary);
        }
        .empty-state {
          text-align: center;
          padding: 60px 24px;
          background: var(--bg-secondary);
          border-radius: 20px;
          border: 1px dashed var(--border-color);
          color: var(--text-secondary);
        }
        .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.7; }
        .empty-state p { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: var(--text-primary); }
        .empty-state small { font-size: 12.5px; color: var(--text-muted); }

        .flex { display: flex; }
        .gap-6 { gap: 6px; }
        .gap-8 { gap: 8px; }
        .gap-12 { gap: 12px; }
        .flex-shrink-0 { flex-shrink: 0; }
        .align-items-center { align-items: center; }
        .justify-content-between { justify-content: space-between; }
        .mt-8 { margin-top: 8px; }
        .mt-12 { margin-top: 12px; }
        .mt-16 { margin-top: 16px; }
        .mb-12 { margin-bottom: 12px; }
        .font-bold { font-weight: 700; }

        /* --- PREMIUM FOOTER --- */
        .premium-footer {
          background: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
          margin-top: 80px;
          padding: 64px 32px 40px;
        }
        .footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.6fr 1fr 1fr;
          gap: 48px;
        }
        @media (max-width: 768px) {
          .footer-inner { grid-template-columns: 1fr; gap: 36px; }
        }
        .footer-brand-name {
          font-family: 'Cormorant Garamond', serif;
          font-size: 26px;
          font-weight: 700;
          color: var(--accent-gold);
          letter-spacing: -0.3px;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .footer-brand-icon {
          background: linear-gradient(135deg, #F59E0B, #D97706);
          color: white;
          width: 34px;
          height: 34px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 16px;
          flex-shrink: 0;
        }
        .footer-tagline {
          font-size: 13.5px;
          color: var(--text-secondary);
          line-height: 1.75;
          margin-bottom: 20px;
          max-width: 280px;
        }
        .footer-receipt-note {
          font-size: 12.5px;
          color: var(--text-muted);
          font-style: italic;
          border-left: 3px solid var(--accent-gold);
          padding-left: 12px;
          line-height: 1.6;
          margin-top: 16px;
        }
        .footer-col-title {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 20px;
        }
        .footer-contact-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 16px;
        }
        .footer-contact-icon {
          width: 32px;
          height: 32px;
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
          transition: background 0.2s, border-color 0.2s;
        }
        .footer-contact-row:hover .footer-contact-icon {
          background: rgba(245, 158, 11, 0.1);
          border-color: var(--accent-gold);
        }
        .footer-contact-label {
          font-size: 10.5px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          color: var(--text-muted);
          font-weight: 600;
          margin-bottom: 2px;
        }
        .footer-contact-value {
          font-size: 13.5px;
          color: var(--text-primary);
          font-weight: 600;
          line-height: 1.4;
        }
        .footer-order-now-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--accent-gold);
          color: var(--bg-primary);
          border: none;
          border-radius: 24px;
          padding: 11px 22px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          text-decoration: none;
          margin-top: 8px;
        }
        .footer-order-now-btn:hover { background: var(--accent-gold-hover); transform: translateY(-1px); }
        .footer-divider {
          max-width: 1100px;
          margin: 40px auto 0;
          border: none;
          border-top: 1px solid var(--border-color);
        }
        .footer-bottom {
          max-width: 1100px;
          margin: 20px auto 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .footer-bottom-copy {
          font-size: 12px;
          color: var(--text-muted);
        }
        .footer-bottom-badges {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .footer-badge {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 4px 10px;
        }
      `}} />

      {/* STICKY TOP BAR */}
      <nav className="premium-nav-bar">
        <div className="premium-nav-logo" style={{ cursor: 'pointer' }} onClick={() => setActiveTrackingOrderId(null)}>
          <span>{restaurant?.businessName ? restaurant.businessName.charAt(0) : 'R'}</span>
          {restaurant?.businessName || 'Gourmet Bistro'}
        </div>
        <div className="nav-actions">
          {localStorage.getItem(`active_order_${slug}`) && (
            <button 
              className="premium-btn btn-outline" 
              style={{ fontSize: '11px', padding: '6px 14px' }}
              onClick={() => setActiveTrackingOrderId(localStorage.getItem(`active_order_${slug}`))}
            >
              🚀 Track Active Order
            </button>
          )}
          {activeTrackingOrderId && (
            <button className="premium-btn btn-amber" style={{ fontSize: '11px', padding: '6px 14px' }} onClick={() => setActiveTrackingOrderId(null)}>
              📖 Back to Menu
            </button>
          )}
          <button className="theme-toggle-btn" onClick={toggleDarkMode} title="Toggle Theme">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      {/* VIEW: LIVE TIMELINE ORDER TRACKING SCREEN */}
      {activeTrackingOrderId && trackingOrder ? (
        <div>
          <div className="tracking-header">
            <h2>Track Your Order</h2>
            <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>
              Order Reference: <b>{trackingOrder.orderNumber}</b>
            </p>
            <p className="text-sm mt-8">
              Order placed on {new Date(trackingOrder.createdAt).toLocaleTimeString()}
            </p>
          </div>

          {/* Timeline diagram */}
          {trackingOrder.status === 'cancelled' ? (
            <div style={{ textAlign: 'center', padding: '32px 20px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 20, maxWidth: 500, margin: '20px auto' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>❌</div>
              <h3 style={{ color: '#ef4444', fontSize: 18, fontWeight: 700 }}>This order has been cancelled.</h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>Please contact the restaurant if you believe this is an error.</p>
            </div>
          ) : (
            <div>
              {trackingOrder.status === 'preparing' && (
                <div className="steam-container">
                  <div className="steam-puff"></div>
                  <div className="steam-puff"></div>
                  <div className="steam-puff"></div>
                </div>
              )}
              
              <div className="visual-timeline">
                <div className="timeline-line"></div>
                <div 
                  className="timeline-line-progress" 
                  style={{ 
                    width: currentStep === 1 ? '0%' 
                           : currentStep === 2 ? '33%' 
                           : currentStep === 3 ? '66%' 
                           : '100%' 
                  }}
                ></div>

                {/* Node 1: Placed */}
                <div className={`timeline-node ${currentStep >= 1 ? 'completed' : ''} ${currentStep === 1 ? 'active' : ''}`}>
                  <div className="timeline-icon-outer">
                    {currentStep > 1 ? '✓' : '📥'}
                  </div>
                  <span className="timeline-label">Placed</span>
                </div>

                {/* Node 2: Kitchen */}
                <div className={`timeline-node ${currentStep >= 2 ? 'completed' : ''} ${currentStep === 2 ? 'active' : ''}`}>
                  <div className="timeline-icon-outer">
                    {currentStep > 2 ? '✓' : '🍳'}
                  </div>
                  <span className="timeline-label">Kitchen</span>
                </div>

                {/* Node 3: Ready */}
                <div className={`timeline-node ${currentStep >= 3 ? 'completed' : ''} ${currentStep === 3 ? 'active' : ''}`}>
                  <div className="timeline-icon-outer">
                    {currentStep > 3 ? '✓' : '📦'}
                  </div>
                  <span className="timeline-label">{trackingOrder.orderType === 'Delivery' ? 'Out' : 'Ready'}</span>
                </div>

                {/* Node 4: Served */}
                <div className={`timeline-node ${currentStep >= 4 ? 'completed' : ''} ${currentStep === 4 ? 'active' : ''}`}>
                  <div className="timeline-icon-outer">
                    🏁
                  </div>
                  <span className="timeline-label">{trackingOrder.orderType === 'Delivery' ? 'Delivered' : 'Served'}</span>
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '20px 0 30px', fontSize: 14 }}>
                Status: <span style={{ textTransform: 'uppercase', color: '#10b981', fontWeight: 800, letterSpacing: '0.5px' }}>{trackingOrder.status}</span>
              </div>
            </div>
          )}

          {/* Receipt detail view */}
          <div className="digital-receipt" style={{ maxWidth: 500, margin: '30px auto' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginBottom: 14, fontFamily: 'Cormorant Garamond, serif' }}>
              🧾 Culinary Order Summary
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {trackingOrder.items?.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-secondary)' }}>
                  <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span></span>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{sym}{item.subtotal.toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-secondary)' }}>
                <span>Subtotal:</span>
                <span>{sym}{(trackingOrder.totalAmount / (1 + taxRate/100)).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, color: 'var(--text-secondary)' }}>
                <span>Tax ({taxRate}%):</span>
                <span>{sym}{(trackingOrder.totalAmount - (trackingOrder.totalAmount / (1 + taxRate/100))).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 15, color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 6 }}>
                <span>Total Amount:</span>
                <span style={{ color: 'var(--accent-gold)' }}>{sym}{trackingOrder.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ marginTop: 20, padding: '14px', background: 'var(--bg-tertiary)', borderRadius: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div><b>Service Type:</b> {trackingOrder.orderType} {trackingOrder.tableName && `(${trackingOrder.tableName})`}</div>
              <div><b>Customer:</b> {trackingOrder.customerName}</div>
              {trackingOrder.notes && <div style={{ marginTop: 6, borderTop: '1px solid var(--border-color)', paddingTop: 6 }}><b>Chef Notes:</b> {trackingOrder.notes}</div>}
            </div>

            <button className="premium-btn btn-amber btn-block mt-16" style={{ justifyContent: 'center' }} onClick={() => setActiveTrackingOrderId(null)}>
              📖 Back to Digital Menu
            </button>
            <div className="serrated-edge"></div>
          </div>
        </div>
      ) : (
        /* VIEW: HOMEPAGE + ORDERING ENGINE */
        <div>
          {/* MODERN HERO SECTION */}
          <header className="premium-hero">
            <span className="premium-hero-badge">Est. 2026 · Michelin Starred Selection</span>
            <h1>{restaurant?.businessName || 'Gourmet Bistro'}</h1>
            <p>
              Experience fine farm-to-table cuisine prepared by award-winning chefs. Browse our digital menu, customize elements, and place a live order to track in real-time.
            </p>
            
            <div className="info-strip">
              <div className="info-pill">⭐ 4.9 (150+ reviews)</div>
              <div className="info-pill">⏱️ 20-30 mins prep</div>
              <div className="info-pill">🛵 Free delivery &gt; {sym}30</div>
            </div>
          </header>

          {/* RESTAURANT ABOUT & STORY SECTION */}
          <section className="story-section">
            <div className="story-content">
              <h2>A Legacy of Fine Ingredients</h2>
              <p>
                Our mission is simple: to connect local farmers directly with your plate. Every ingredient is sourced responsibly, prepared fresh daily, and crafted with passion. Whether you are dining at our tables, stopping by for a quick takeaway, or enjoying doorstep delivery, we bring excellence to every meal.
              </p>
              <div className="story-quote">
                "We don't just serve food; we craft memorable culinary journeys."
              </div>
            </div>
            <div className="story-hours">
              <h3>🕒 Working Hours</h3>
              <div className="story-hours-row">
                <b>Monday – Friday</b>
                <span>10:00 AM – 10:00 PM</span>
              </div>
              <div className="story-hours-row">
                <b>Saturday – Sunday</b>
                <span>09:00 AM – 11:00 PM</span>
              </div>
              {restaurant?.address && (
                <div className="story-hours-row" style={{ marginTop: 14, borderTop: '1px solid var(--border-color)', paddingTop: 10, fontSize: '12px', color: 'var(--text-muted)' }}>
                  📍 <b>Location:</b> {restaurant.address}
                </div>
              )}
              {restaurant?.phone && (
                <div className="story-hours-row" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  📞 <b>Phone:</b> {restaurant.phone}
                </div>
              )}
              {restaurant?.email && (
                <div className="story-hours-row" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  ✉️ <b>Email:</b> {restaurant.email}
                </div>
              )}
            </div>
          </section>

          {/* STICKY CATEGORIES & DIETARY FILTER PANEL */}
          <div className="filter-section-wrapper">
            <div className="filter-section-inner">
              <div className="category-filter-strip">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              
              <div className="dietary-filter-strip">
                {[
                  { id: 'All', label: '🍽️ All Culinary' },
                  { id: 'Veg', label: '🌱 Vegetarian' },
                  { id: 'GF', label: '🌾 Gluten-Free' },
                  { id: 'Spicy', label: '🔥 Spicy Delight' },
                  { id: 'Chef', label: '✨ Chef\'s Selection' }
                ].map(d => (
                  <button
                    key={d.id}
                    className={`dietary-pill ${dietaryFilter === d.id ? 'active' : ''}`}
                    onClick={() => setDietaryFilter(d.id)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ENGINE MENU GRID */}
          <div className="menu-container">
            {/* Desktop Left Categories List */}
            <aside className="desktop-only-sidebar">
              <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 700 }}>
                Categories
              </h4>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={activeCategory === cat ? 'active' : ''}
                >
                  {cat}
                </button>
              ))}
            </aside>

            <main style={{ flex: 1 }}>
              <div className="search-box-wrap">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search delicious dishes..."
                  className="search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {filtered.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🍽️</div>
                  <p>No dishes match your selection</p>
                  <small>Try selecting another category or typing another search query</small>
                </div>
              ) : (
                <div className="menu-grid-items">
                  {filtered.map(item => (
                    <div
                      key={item._id}
                      className="premium-item-card"
                      onClick={() => handleItemCardClick(item)}
                    >
                      {item.imageUrl ? (
                        <div className="premium-item-img-container">
                          <img
                            src={item.imageUrl.startsWith('http') ? item.imageUrl : `${BACKEND}${item.imageUrl}`}
                            alt={item.name}
                            className="premium-item-img"
                          />
                        </div>
                      ) : (
                        <div className="premium-item-placeholder">🍴</div>
                      )}
                      
                      <div className="premium-item-body">
                        <div>
                          <span className="premium-item-meta">{item.category}</span>
                          <h3 className="premium-item-name">{item.name}</h3>
                          <p className="premium-item-desc">
                            {item.description || 'Delicately crafted using fine, fresh organic culinary ingredients.'}
                          </p>
                          
                          <div className="food-badge-container">
                            {getItemTags(item).map((tag, i) => (
                              <span key={i} className="food-badge">{tag}</span>
                            ))}
                          </div>
                        </div>

                        <div className="premium-item-footer">
                          <span className="premium-item-price">
                            {sym}{item.price.toFixed(2)}
                          </span>
                          <button className="add-cart-btn">
                            {item.modifiers?.length > 0 ? '✏️ Customize' : '＋ Add to Cart'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>

            {/* PREMIUM FOOTER */}
            <footer className="premium-footer">
              <div className="footer-inner">

                {/* Brand Column */}
                <div>
                  <div className="footer-brand-name">
                    <span className="footer-brand-icon">
                      {restaurant?.businessName ? restaurant.businessName.charAt(0).toUpperCase() : 'R'}
                    </span>
                    {restaurant?.businessName || 'Our Restaurant'}
                  </div>
                  <p className="footer-tagline">
                    Experience fine dining brought to your fingertips. Browse our curated menu, customize your meal, and place a live order — all in one seamless experience.
                  </p>
                  {restaurant?.receiptFooter && (
                    <div className="footer-receipt-note">
                      {restaurant.receiptFooter}
                    </div>
                  )}
                </div>

                {/* Contact Column */}
                <div>
                  <p className="footer-col-title">📬 Contact Us</p>

                  {restaurant?.address && (
                    <div className="footer-contact-row">
                      <div className="footer-contact-icon">📍</div>
                      <div>
                        <div className="footer-contact-label">Address</div>
                        <div className="footer-contact-value">{restaurant.address}</div>
                      </div>
                    </div>
                  )}

                  {restaurant?.phone && (
                    <div className="footer-contact-row">
                      <div className="footer-contact-icon">📞</div>
                      <div>
                        <div className="footer-contact-label">Phone</div>
                        <a href={`tel:${restaurant.phone}`} style={{ textDecoration: 'none' }}>
                          <div className="footer-contact-value" style={{ color: 'var(--accent-gold)' }}>{restaurant.phone}</div>
                        </a>
                      </div>
                    </div>
                  )}

                  {restaurant?.email && (
                    <div className="footer-contact-row">
                      <div className="footer-contact-icon">✉️</div>
                      <div>
                        <div className="footer-contact-label">Email</div>
                        <a href={`mailto:${restaurant.email}`} style={{ textDecoration: 'none' }}>
                          <div className="footer-contact-value" style={{ color: 'var(--accent-gold)' }}>{restaurant.email}</div>
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Column */}
                <div>
                  <p className="footer-col-title">🛒 Place an Order</p>
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
                    Order online for Dine-In, Takeaway, or Delivery. Our team prepares your meal fresh with the finest ingredients.
                  </p>
                  <button
                    className="footer-order-now-btn"
                    onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    🍽️ Browse Menu
                  </button>

                  <div style={{ marginTop: 24 }}>
                    <p className="footer-col-title" style={{ marginBottom: 10 }}>🏷️ We Accept</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span className="footer-badge">💵 Cash</span>
                      <span className="footer-badge">💳 Card</span>
                      <span className="footer-badge">🚚 Delivery</span>
                      <span className="footer-badge">🏠 Dine-In</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="footer-divider" />
              <div className="footer-bottom">
                <span className="footer-bottom-copy">
                  © {new Date().getFullYear()} {restaurant?.businessName || 'Our Restaurant'}. All rights reserved. Powered by Antigravity POS.
                </span>
                <div className="footer-bottom-badges">
                  <span className="footer-badge">🔒 Secure Ordering</span>
                  <span className="footer-badge">🌱 Fresh Daily</span>
                  <span className="footer-badge">⚡ Live Tracking</span>
                </div>
              </div>
            </footer>

          </div>
        </div>
      )}

      {/* FLOATING CART SUMMARY BUTTON */}
      {totalCartQty > 0 && !activeTrackingOrderId && (
        <button
          onClick={() => setShowCartDrawer(true)}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 999,
            backgroundColor: 'var(--text-primary)',
            color: 'var(--bg-secondary)',
            border: 'none',
            borderRadius: 30,
            padding: '14px 24px',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'transform 0.15s ease'
          }}
          className="floating-cart-btn"
        >
          <span>🛒</span>
          <span>View Cart ({totalCartQty})</span>
          <span style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: 12, color: 'var(--accent-gold)' }}>
            {sym}{totalAmount.toFixed(2)}
          </span>
        </button>
      )}

      {/* RESUME ORDER TRACKING FLOATING STRIP */}
      {localStorage.getItem(`active_order_${slug}`) && !activeTrackingOrderId && (
        <div className="floating-tracking-bar">
          <span>🚀 You have an active order running!</span>
          <span className="tracking-status-badge">Live</span>
          <button 
            className="premium-btn btn-amber" 
            style={{ fontSize: '11px', padding: '5px 12px' }}
            onClick={() => setActiveTrackingOrderId(localStorage.getItem(`active_order_${slug}`))}
          >
            Track Progress
          </button>
        </div>
      )}

      {/* MODIFIER SELECTOR DRAWER */}
      {selectedItemForMod && (
        <div className="drawer-overlay" onClick={() => setSelectedItemForMod(null)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>Customize {selectedItemForMod.name}</h3>
                <p style={{ color: 'var(--accent-gold)', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  {selectedItemForMod.category} · {sym}{selectedItemForMod.price.toFixed(2)}
                </p>
              </div>
              <button className="qty-btn" style={{ fontSize: 13 }} onClick={() => setSelectedItemForMod(null)}>✕</button>
            </div>
            
            <div className="drawer-body">
              {selectedItemForMod.modifiers?.length > 0 ? (
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: 12 }}>Customize Options / Extras</label>
                  <div className="modifier-chip-container">
                    {selectedItemForMod.modifiers.map((mod, i) => {
                      const isChecked = orderItemMods.some(m => m.name === mod.name);
                      return (
                        <div
                          key={i}
                          className={`modifier-chip-row ${isChecked ? 'selected' : ''}`}
                          onClick={() => handleToggleMod(mod)}
                        >
                          <div className="modifier-chip-info">
                            <div className="modifier-chip-checkbox">✓</div>
                            <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{mod.name}</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>+{sym}{mod.price.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: 12, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                  🍴 No special modifiers for this dish, but you can leave chef requests below!
                </div>
              )}

              <div className="form-group mt-16">
                <label className="form-label">Chef Instructions / Requests</label>
                <textarea
                  className="form-input"
                  placeholder="e.g. Extra sauce, no spicy, well done, etc."
                  value={orderItemNotes}
                  onChange={e => setOrderItemNotes(e.target.value)}
                  style={{ height: 70, resize: 'none' }}
                />
              </div>

              <div className="form-group mt-16">
                <label className="form-label">Quantity</label>
                <div className="flex gap-12" style={{ alignItems: 'center' }}>
                  <button className="qty-btn" style={{ width: 36, height: 36, fontSize: 18 }} onClick={() => setOrderItemQty(q => Math.max(1, q - 1))}>-</button>
                  <span style={{ fontSize: 18, fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{orderItemQty}</span>
                  <button className="qty-btn" style={{ width: 36, height: 36, fontSize: 18 }} onClick={() => setOrderItemQty(q => q + 1)}>+</button>
                </div>
              </div>
            </div>

            <div className="drawer-footer">
              <div className="flex gap-8">
                <button className="premium-btn btn-outline" style={{ flex: 1 }} onClick={() => setSelectedItemForMod(null)}>Cancel</button>
                <button className="premium-btn btn-amber" style={{ flex: 2 }} onClick={handleAddToCart}>
                  Confirm Add {orderItemQty}×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT CART DRAWER */}
      {showCartDrawer && (
        <div className="drawer-overlay" onClick={() => setShowCartDrawer(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3>Your Premium Selection</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>Verify options and place your active order</p>
              </div>
              <button className="qty-btn" style={{ fontSize: 13 }} onClick={() => setShowCartDrawer(false)}>✕</button>
            </div>

            <div className="drawer-body">
              {cart.length === 0 ? (
                <div className="text-center" style={{ padding: '40px 0' }}>
                  <span style={{ fontSize: 48 }}>🛒</span>
                  <p style={{ marginTop: 14, color: 'var(--text-muted)', fontSize: 14 }}>Your cart is empty.</p>
                </div>
              ) : (
                <div>
                  <div style={{ marginBottom: 24 }}>
                    {cart.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', padding: '14px 0' }}>
                        <div style={{ flex: 1, paddingRight: 12 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                          {item.modifiers?.map((m, i) => (
                            <span key={i} style={{ display: 'block', fontSize: 11, color: 'var(--accent-gold)' }}>
                              + {m.name} (+{sym}{m.price.toFixed(2)})
                            </span>
                          ))}
                          {item.notes && (
                            <span style={{ display: 'block', fontSize: 11.5, fontStyle: 'italic', color: 'var(--accent-gold)', marginTop: 4 }}>
                              ✏️ "{item.notes}"
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <button className="qty-btn" style={{ width: 26, height: 26 }} onClick={() => handleCartQty(idx, -1)}>-</button>
                          <span style={{ fontSize: 13, fontWeight: 700, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                          <button className="qty-btn" style={{ width: 26, height: 26 }} onClick={() => handleCartQty(idx, 1)}>+</button>
                          <span style={{ fontSize: 13.5, fontWeight: 700, minWidth: 60, textAlign: 'right', color: 'var(--text-primary)' }}>
                            {sym}{item.subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CUSTOMER DETAILS FORM */}
                  <form onSubmit={handlePlaceOrder} style={{ borderTop: '2px solid var(--border-color)', paddingTop: 20 }}>
                    <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 16, fontWeight: 700 }}>
                      📋 Guest Details & Preferences
                    </h4>
                    
                    <div className="checkout-grid-2">
                      <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input
                          className="form-input"
                          placeholder="Name"
                          value={checkoutForm.customerName}
                          onChange={e => setCheckoutForm(p => ({ ...p, customerName: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Phone Number *</label>
                        <input
                          className="form-input"
                          placeholder="Phone"
                          value={checkoutForm.customerPhone}
                          onChange={e => setCheckoutForm(p => ({ ...p, customerPhone: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="checkout-grid-2">
                      <div className="form-group">
                        <label className="form-label">Service Type *</label>
                        <select
                          className="form-select"
                          value={checkoutForm.orderType}
                          onChange={e => setCheckoutForm(p => ({ ...p, orderType: e.target.value }))}
                        >
                          <option value="Takeaway">🛍️ Takeaway</option>
                          <option value="Delivery">🛵 Delivery</option>
                          <option value="Dine-In">🍽️ Dine-In</option>
                        </select>
                      </div>
                      
                      {checkoutForm.orderType === 'Dine-In' && (
                        <div className="form-group">
                          <label className="form-label">Table No. *</label>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="e.g. 4"
                            value={checkoutForm.tableNumber}
                            onChange={e => setCheckoutForm(p => ({ ...p, tableNumber: e.target.value }))}
                            required
                          />
                        </div>
                      )}
                    </div>

                    {checkoutForm.orderType === 'Delivery' && (
                      <div className="form-group">
                        <label className="form-label">Delivery Street Address *</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 123 Main St, Apt 4B"
                          value={checkoutForm.deliveryAddress}
                          onChange={e => setCheckoutForm(p => ({ ...p, deliveryAddress: e.target.value }))}
                          required
                        />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Special Instructions</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Leave at gate, ring bell"
                        value={checkoutForm.notes}
                        onChange={e => setCheckoutForm(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>

                    {/* SMART GUEST CHECKBOX */}
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input 
                        type="checkbox" 
                        id="saveDetails" 
                        checked={checkoutForm.saveDetails} 
                        style={{ width: '15px', height: '15px', accentColor: 'var(--accent-gold)' }}
                        onChange={e => setCheckoutForm(p => ({ ...p, saveDetails: e.target.checked }))} 
                      />
                      <label htmlFor="saveDetails" style={{ fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        💾 Save details for future culinary orders
                      </label>
                    </div>

                    {/* PAYMENT METHOD SELECTOR */}
                    <h4 style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', margin: '24px 0 12px 0', fontWeight: 700 }}>
                      💳 Secure Payment Method
                    </h4>
                    
                    <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                      <button
                        type="button"
                        className={`premium-btn ${checkoutForm.paymentMethod === 'COD' ? 'btn-amber' : 'btn-outline'}`}
                        style={{ flex: 1, fontSize: 12 }}
                        onClick={() => setCheckoutForm(p => ({ ...p, paymentMethod: 'COD' }))}
                      >
                        💵 Counter Payment
                      </button>
                      <button
                        type="button"
                        className={`premium-btn ${checkoutForm.paymentMethod === 'Card' ? 'btn-amber' : 'btn-outline'}`}
                        style={{ flex: 1, fontSize: 12 }}
                        onClick={() => setCheckoutForm(p => ({ ...p, paymentMethod: 'Card' }))}
                      >
                        💳 Credit Card
                      </button>
                    </div>

                    {/* PREMIUM CREDIT CARD ELEMENT */}
                    {checkoutForm.paymentMethod === 'Card' && (
                      <div className="stripe-mock-card">
                        <div className="card-reflection"></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '1px' }}>Black Gold Metal Card</span>
                          <span style={{ fontSize: 16 }}>🔒</span>
                        </div>
                        <div className="card-chip"></div>
                        <input
                          type="text"
                          placeholder="4242 4242 4242 4242"
                          maxLength="19"
                          className="card-number-input"
                          value={checkoutForm.cardNumber}
                          onChange={e => setCheckoutForm(p => ({ ...p, cardNumber: e.target.value }))}
                        />
                        <div className="card-meta-wrap">
                          <input
                            type="text"
                            placeholder="MM / YY"
                            maxLength="5"
                            className="card-sub-input"
                            value={checkoutForm.cardExpiry}
                            onChange={e => setCheckoutForm(p => ({ ...p, cardExpiry: e.target.value }))}
                          />
                          <input
                            type="password"
                            placeholder="CVC"
                            maxLength="3"
                            className="card-sub-input"
                            value={checkoutForm.cardCvc}
                            onChange={e => setCheckoutForm(p => ({ ...p, cardCvc: e.target.value }))}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Cardholder Name"
                          className="card-sub-input"
                          style={{ marginTop: 12 }}
                          value={checkoutForm.cardName}
                          onChange={e => setCheckoutForm(p => ({ ...p, cardName: e.target.value }))}
                        />
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <div className="digital-receipt" style={{ padding: '16px 20px', marginBottom: 16 }}>
                <div className="totals-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 6 }}>
                  <span>Basket Subtotal</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sym}{subtotal.toFixed(2)}</span>
                </div>
                <div className="totals-row" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <span>Sales Tax ({taxRate}%)</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sym}{taxAmount.toFixed(2)}</span>
                </div>
                <div className="totals-row total" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 850, color: 'var(--text-primary)', borderTop: '1px dashed var(--border-color)', paddingTop: 10, marginTop: 4 }}>
                  <span>Payable Total</span>
                  <span style={{ color: 'var(--accent-gold)' }}>{sym}{totalAmount.toFixed(2)}</span>
                </div>
                <div className="serrated-edge"></div>
              </div>

              <button
                className="premium-btn btn-amber btn-block"
                onClick={handlePlaceOrder}
                disabled={submittingOrder || cart.length === 0}
                style={{ height: 46, fontSize: 14, justifyContent: 'center' }}
              >
                {submittingOrder ? 'Processing Payment...' : checkoutForm.paymentMethod === 'Card' ? '🔒 Pay & Submit Order' : '🚀 Place Order (Pay at Counter)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC TOAST NOTIFICATIONS */}
      {toast && (
        <div className={`toast ${toast.type}`} style={{ bottom: 20, zIndex: 10000 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
