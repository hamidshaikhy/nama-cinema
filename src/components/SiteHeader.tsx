import { Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fa } from '../lib/format';
import { useReservations } from '../lib/reservations';
import { Logo } from './Logo';

export function SiteHeader() {
  const count = useReservations().length;
  return (
    <header className="site-header">
      <Link to="/" className="site-header__brand" aria-label="نما، صفحه اصلی">
        <Logo />
      </Link>
      <nav className="site-header__nav" aria-label="ناوبری اصلی">
        <Link to="/#halls" className="site-header__link site-header__link--halls">
          سالن‌ها
        </Link>
        <Link to="/reservations" className="site-header__link site-header__link--tickets">
          <Ticket size={18} aria-hidden="true" />
          رزروهای من
          {count > 0 && <span className="badge">{fa(count)}</span>}
        </Link>
      </nav>
    </header>
  );
}
