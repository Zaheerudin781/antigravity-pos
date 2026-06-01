import { createContext, useContext, useReducer, useEffect } from 'react';
import { startSyncWorker, stopSyncWorker } from '../sync/syncWorker';

const AppContext = createContext(null);

const initialState = {
  user: JSON.parse(localStorage.getItem('pos_user') || 'null'),
  token: localStorage.getItem('pos_token') || null,
  restaurant: JSON.parse(localStorage.getItem('pos_restaurant') || 'null'),
  activeTab: 'ORDERS',
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
  sidebarOrder: null,
  notification: null,
  activeCategory: 'All',
  showCategoryNav: false,
  menuCategories: [],
  printPromptOrder: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      localStorage.setItem('pos_token', action.payload.token);
      localStorage.setItem('pos_user', JSON.stringify(action.payload.user));
      localStorage.setItem('pos_restaurant', JSON.stringify(action.payload.restaurant));
      return { ...state, user: action.payload.user, token: action.payload.token, restaurant: action.payload.restaurant };
    case 'LOGOUT':
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      localStorage.removeItem('pos_restaurant');
      return { ...state, user: null, token: null, restaurant: null, sidebarOrder: null };
    case 'SET_TAB': return { ...state, activeTab: action.payload, showCategoryNav: false, activeCategory: null }; // reset category when switching tabs
    case 'SET_ONLINE': return { ...state, isOnline: action.payload };
    case 'SET_SIDEBAR_ORDER': return { ...state, sidebarOrder: action.payload };
    case 'SET_PENDING_SYNC': return { ...state, pendingSyncCount: action.payload };
    case 'SET_RESTAURANT': 
      localStorage.setItem('pos_restaurant', JSON.stringify(action.payload));
      return { ...state, restaurant: action.payload };
    case 'NOTIFY': return { ...state, notification: action.payload };
    case 'CLEAR_NOTIFY': return { ...state, notification: null };
    case 'SET_ACTIVE_CATEGORY': return { ...state, activeCategory: action.payload };
    case 'SET_SHOW_CATEGORY_NAV': return { ...state, showCategoryNav: action.payload };
    case 'SET_MENU_CATEGORIES': return { ...state, menuCategories: action.payload };
    case 'SET_PRINT_PROMPT': return { ...state, printPromptOrder: action.payload };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE', payload: false });
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    startSyncWorker((count) => {
      dispatch({ type: 'NOTIFY', payload: { type: 'success', message: `${count} offline order(s) synced successfully!` } });
    });
    return () => stopSyncWorker();
  }, []);

  const notify = (message, type = 'success') => {
    dispatch({ type: 'NOTIFY', payload: { type, message } });
    setTimeout(() => dispatch({ type: 'CLEAR_NOTIFY' }), 3500);
  };

  return (
    <AppContext.Provider value={{ state, dispatch, notify }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
