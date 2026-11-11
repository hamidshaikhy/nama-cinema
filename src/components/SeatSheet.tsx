import { Check } from 'lucide-react';
import type { Ref } from 'react';
import { Link } from 'react-router-dom';
import type { Hall } from '../data/halls';
import { fa, faDecimal, faDigits, toman } from '../lib/format';
import { VIEW_TEXT, type Layout, type Seat } from '../lib/seating';

interface Props {
  hall: Hall;
  layout: Layout;
  time: string;
  seat: Seat | null;
  booked: boolean;
  onBook: () => void;
  onChange: () => void;
  sheetRef: Ref<HTMLElement>;
}

/** The panel that sits under the view from a seat: what you see, what it costs, book it. */
export function SeatSheet({ hall, layout, time, seat, booked, onBook, onChange, sheetRef }: Props) {
  return (
    <aside className="sheet" ref={sheetRef} aria-live="polite">
      {seat && !booked && (
        <>
          <div className="sheet__head">
            <div>
              <span className={`sheet__kind sheet__kind--t${seat.tier}`}>
                {VIEW_TEXT[seat.kind].label}
              </span>
              <h2>
                ردیف {fa(seat.row)}، صندلی {fa(seat.number)}
              </h2>
            </div>
            <MiniMap hall={hall} layout={layout} seat={seat} />
          </div>
          <p className="sheet__note">{VIEW_TEXT[seat.kind].note}</p>
          <dl className="sheet__stats">
            <div>
              <dd>{faDecimal(seat.distance)} متر</dd>
              <dt>تا پرده</dt>
            </div>
            <div>
              <dd>{fa(Math.round(seat.angle))} درجه</dd>
              <dt>زاویه‌ی دید</dt>
            </div>
            <div>
              {Math.abs(seat.offset) < 0.3 ? (
                <>
                  <dd>وسط</dd>
                  <dt>روی خط مرکز</dt>
                </>
              ) : (
                <>
                  <dd>{faDecimal(Math.abs(seat.offset))} متر</dd>
                  <dt>{seat.offset < 0 ? 'چپِ مرکز' : 'راستِ مرکز'}</dt>
                </>
              )}
            </div>
          </dl>
          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onChange}>
              تغییر صندلی
            </button>
            <button type="button" className="btn btn--primary" onClick={onBook}>
              رزرو، {toman(seat.price)}
            </button>
          </div>
        </>
      )}

      {seat && booked && (
        <div className="sheet__done">
          <span className="sheet__check" aria-hidden="true">
            <Check size={22} strokeWidth={3} />
          </span>
          <h2>رزرو شد</h2>
          <p>
            ردیف {fa(seat.row)}، صندلی {fa(seat.number)} در {hall.name}، سانس {faDigits(time)}.
            این صندلی به فهرست رزروهایت اضافه شد.
          </p>
          <div className="sheet__actions">
            <button type="button" className="btn btn--ghost" onClick={onChange}>
              رزرو یک صندلی دیگر
            </button>
            <Link to="/reservations" className="btn btn--primary">
              دیدن رزروهای من
            </Link>
          </div>
        </div>
      )}
    </aside>
  );
}

function MiniMap({ hall, layout, seat }: { hall: Hall; layout: Layout; seat: Seat }) {
  const { x0, x1, z0, z1 } = layout.bounds;
  const lead = hall.rowPitch * 1.6;
  const half = Math.min(hall.screen.width, x1 - x0) / 2;
  const screenZ = z0 - lead * 0.55;
  return (
    <svg
      className="minimap"
      viewBox={`${x0} ${z0 - lead} ${x1 - x0} ${z1 - z0 + lead}`}
      aria-hidden="true"
    >
      <path
        d={`M ${-half} ${screenZ} Q 0 ${screenZ - lead * 0.45} ${half} ${screenZ}`}
        className="minimap__screen"
      />
      {layout.seats.map((s) => (
        <circle key={s.id} cx={s.x} cy={s.z} r={hall.seatPitch * 0.27} className="minimap__seat" />
      ))}
      <circle cx={seat.x} cy={seat.z} r={hall.seatPitch * 0.62} className="minimap__you" />
    </svg>
  );
}
