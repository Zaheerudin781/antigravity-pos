import { AppProvider, useApp } from './store/AppContext';
import LoginPage from './pages/LoginPage';
import MainLayout from './components/MainLayout';
import PublicMenuPage from './pages/PublicMenuPage';

function AppInner() {
  const { state } = useApp();
  
  // Custom lightweight routing for public menus
  const path = window.location.pathname;
  if (path.startsWith('/menu/')) {
    const slug = path.split('/menu/')[1];
    return <PublicMenuPage slug={slug} />;
  }

  if (!state.token) return <LoginPage />;
  return <MainLayout />;
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}

