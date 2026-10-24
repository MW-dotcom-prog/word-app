import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { ReminderWatcher } from './components/ReminderWatcher';
import TodayPage from './pages/Today';
import ListsPage from './pages/Lists';
import DictionaryPage from './pages/Dictionary';
import FavoritesPage from './pages/Favorites';
import StatsPage from './pages/Stats';
import ProfilePage from './pages/Profile';
import LearnPage from './pages/Learn';
import ReviewPage from './pages/Review';
import FavoriteReviewPage from './pages/FavoriteReview';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  );

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!offline) return null;
  return <div className="offline-banner">当前离线 · 学习与复习仍可正常使用</div>;
}

function AppLayout() {
  const { pathname } = useLocation();
  return (
    <div className="app-shell">
      <ScrollToTop />
      {pathname === '/' ? (
        <div className="home-watermark" aria-hidden="true">
          M.W
        </div>
      ) : null}
      <ReminderWatcher />
      <OfflineBanner />
      <main className="app-content">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/lists" element={<ListsPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="/learn" element={<LearnPage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/review/favorites" element={<FavoriteReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
