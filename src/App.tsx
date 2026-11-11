import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Reservations from './pages/Reservations';

// The hall page carries three.js, so it stays out of the first download.
const loadHall = () => import('./pages/Hall');
const Hall = lazy(loadHall);

export default function App() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    // Fetch the hall bundle once the home page is idle, so opening a hall is instant.
    const timer = window.setTimeout(loadHall, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Suspense fallback={<div className="page-loading">در حال آماده کردن سالن…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/hall/:hallId" element={<Hall />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
