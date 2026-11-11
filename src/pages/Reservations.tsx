import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { SiteHeader } from '../components/SiteHeader';
import { findHall } from '../data/halls';
import { fa, faDigits, toman } from '../lib/format';
import { removeReservation, useReservations } from '../lib/reservations';
import { VIEW_TEXT } from '../lib/seating';

const bookedOn = new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' });

export default function Reservations() {
  const reservations = useReservations();
  const total = reservations.reduce((sum, r) => sum + r.price, 0);

  useEffect(() => {
    document.title = 'رزروهای من | نما';
  }, []);

  return (
    <div className="tickets-page">
      <SiteHeader />
      <main className="tickets">
        <div className="section-head">
          <h1>رزروهای من</h1>
          {reservations.length > 0 && (
            <p>
              {fa(reservations.length)} صندلی، جمعاً {toman(total)}
            </p>
          )}
        </div>

        {reservations.length === 0 ? (
          <div className="tickets__empty">
            <p>هنوز صندلی‌ای رزرو نکرده‌ای. یک سالن انتخاب کن و پرده را از چند صندلی ببین.</p>
            <Link to="/#halls" className="btn btn--primary">
              انتخاب سالن
            </Link>
          </div>
        ) : (
          <ul className="tickets__list">
            {reservations.map((r) => {
              const hall = findHall(r.hallId);
              if (!hall) return null;
              return (
                <li key={r.id} className="ticket">
                  <div className="ticket__main">
                    <h2>{hall.film.title}</h2>
                    <p>
                      {hall.name}، سانس {faDigits(r.time)}
                    </p>
                    <p className="ticket__meta">
                      {VIEW_TEXT[r.kind].label}، رزرو شده در {bookedOn.format(r.createdAt)}
                    </p>
                  </div>
                  <div className="ticket__stub">
                    <dl>
                      <div>
                        <dt>ردیف</dt>
                        <dd>{fa(r.row)}</dd>
                      </div>
                      <div>
                        <dt>صندلی</dt>
                        <dd>{fa(r.number)}</dd>
                      </div>
                    </dl>
                    <b>{toman(r.price)}</b>
                    <button
                      type="button"
                      className="ticket__cancel"
                      onClick={() => removeReservation(r.id)}
                    >
                      لغو رزرو
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {reservations.length > 0 && (
          <Link to="/#halls" className="btn btn--outline tickets__more">
            رزرو یک صندلی دیگر
          </Link>
        )}
      </main>
    </div>
  );
}
