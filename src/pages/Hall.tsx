import { ArrowRight, Ticket } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { SeatMap } from '../components/SeatMap';
import { SeatSheet } from '../components/SeatSheet';
import { defaultShowtime, findHall, type Hall } from '../data/halls';
import { fa, faDigits, thousands, today } from '../lib/format';
import { addReservation, useReservations } from '../lib/reservations';
import { buildLayout, takenSeats, type Seat } from '../lib/seating';
import { HallScene, type MapRect } from '../three/HallScene';
import '../styles/hall.css';

/** map: choosing on the plan. flying: on the way down. seat: seated. leaving: on the way back up. */
type Phase = 'map' | 'flying' | 'seat' | 'leaving';

export default function HallPage() {
  const { hallId } = useParams();
  const hall = findHall(hallId);
  if (!hall) return <Navigate to="/" replace />;
  return <HallView key={hall.id} hall={hall} />;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function HallView({ hall }: { hall: Hall }) {
  const layout = useMemo(() => buildLayout(hall), [hall]);
  const [params, setParams] = useSearchParams();
  const [fallbackTime] = useState(() => defaultShowtime(hall));
  const requested = params.get('t');
  const time = requested && hall.showtimes.includes(requested) ? requested : fallbackTime;

  const reservations = useReservations();
  const taken = useMemo(() => takenSeats(hall, layout, time), [hall, layout, time]);
  const mine = useMemo(
    () =>
      new Set(
        reservations.filter((r) => r.hallId === hall.id && r.time === time).map((r) => r.seatId),
      ),
    [reservations, hall.id, time],
  );

  const [phase, setPhase] = useState<Phase>('map');
  const [seat, setSeat] = useState<Seat | null>(null);
  const [booked, setBooked] = useState(false);
  const [lookHint, setLookHint] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const sceneRef = useRef<HallScene | null>(null);

  useEffect(() => {
    document.title = `${hall.film.title} در ${hall.name} | نما`;
  }, [hall]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let scene: HallScene;
    try {
      scene = new HallScene(canvas, hall, layout);
    } catch {
      // No WebGL here. The plan, prices and booking all still work without the 3D view.
      return;
    }
    sceneRef.current = scene;
    const observer = new ResizeObserver(() => {
      scene.setSize(canvas.clientWidth, canvas.clientHeight);
    });
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, [hall, layout]);

  // Put people in the seats that are gone, except the one the visitor is sitting in.
  useEffect(() => {
    const occupied = layout.seats
      .filter((s) => (taken.has(s.id) || mine.has(s.id)) && s.id !== seat?.id)
      .map((s) => s.index);
    sceneRef.current?.setOccupied(occupied);
  }, [layout, taken, mine, seat]);

  // Slide the 3D picture away from the booking panel so the screen stays in the clear:
  // up on phones, where the panel is a bottom sheet, and sideways on wide screens.
  useLayoutEffect(() => {
    const apply = () => {
      const sheet = sheetRef.current;
      const scene = sceneRef.current;
      if (!sheet || !scene) return;
      if (window.matchMedia('(min-width: 900px)').matches) {
        scene.setShift(sheet.offsetWidth / 2 + 12, 0);
      } else {
        scene.setShift(0, Math.max(0, sheet.offsetHeight / 2 - 24));
      }
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, [seat, booked]);

  const mapRect = useCallback((): MapRect => {
    const map = mapRef.current?.getBoundingClientRect();
    const canvas = canvasRef.current?.getBoundingClientRect();
    if (!map || !canvas) return { left: 0, top: 0, width: 1, height: 1 };
    return {
      left: map.left - canvas.left,
      top: map.top - canvas.top,
      width: map.width,
      height: map.height,
    };
  }, []);

  const pick = useCallback(
    (next: Seat) => {
      if (phase !== 'map') return;
      setSeat(next);
      setBooked(false);
      setPhase('flying');
      const scene = sceneRef.current;
      if (scene) scene.onLook = () => setLookHint(false);
      const landed = scene
        ? scene.flyToSeat(next.index, mapRect(), prefersReducedMotion())
        : Promise.resolve();
      void landed.then(() => setPhase((current) => (current === 'flying' ? 'seat' : current)));
    },
    [phase, mapRect],
  );

  const leave = useCallback(() => {
    if (phase !== 'seat') return;
    setPhase('leaving');
    const scene = sceneRef.current;
    const back = scene ? scene.flyToMap(mapRect(), prefersReducedMotion()) : Promise.resolve();
    void back.then(() => {
      setPhase('map');
      setSeat(null);
      setBooked(false);
    });
  }, [phase, mapRect]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leave]);

  const book = () => {
    if (!seat) return;
    addReservation({
      hallId: hall.id,
      time,
      seatId: seat.id,
      row: seat.row,
      number: seat.number,
      price: seat.price,
      kind: seat.kind,
    });
    setBooked(true);
  };

  const freeByTime = useMemo(() => {
    const free = new Map<string, number>();
    for (const showtime of hall.showtimes) {
      const held = reservations.filter((r) => r.hallId === hall.id && r.time === showtime).length;
      free.set(showtime, layout.seats.length - takenSeats(hall, layout, showtime).size - held);
    }
    return free;
  }, [hall, layout, reservations]);

  return (
    <div className="hall" data-phase={phase} style={{ '--glow': hall.film.glow } as CSSProperties}>
      <canvas ref={canvasRef} className="hall__canvas" />

      <div className="hall__map" inert={phase !== 'map'}>
        <header className="hall__bar">
          <Link to="/" className="icon-btn" aria-label="بازگشت به صفحه اصلی">
            <ArrowRight size={20} aria-hidden="true" />
          </Link>
          <div className="hall__title">
            <h1>{hall.film.title}</h1>
            <p>
              {hall.name}، {today()}
            </p>
          </div>
          <Link to="/reservations" className="icon-btn" aria-label="رزروهای من">
            <Ticket size={20} aria-hidden="true" />
            {reservations.length > 0 && <span className="badge">{fa(reservations.length)}</span>}
          </Link>
        </header>

        <Showtimes
          times={hall.showtimes}
          active={time}
          free={freeByTime}
          onChange={(next) => setParams({ t: next }, { replace: true })}
        />

        <div className="hall__stage">
          <SeatMap
            hall={hall}
            layout={layout}
            taken={taken}
            mine={mine}
            selectedId={seat?.id ?? null}
            onPick={pick}
            mapRef={mapRef}
          />
        </div>

        <footer className="hall__foot">
          <ul className="legend" aria-label="راهنمای نقشه">
            {[4, 3, 2, 1].map((tier) => (
              <li key={tier}>
                <span className={`swatch swatch--t${tier}`} aria-hidden="true" />
                {thousands(hall.prices[tier - 1])}
              </li>
            ))}
            <li className="legend__unit">هزار تومان</li>
            <li>
              <span className="swatch swatch--taken" aria-hidden="true" />
              پر
            </li>
            <li>
              <span className="swatch swatch--mine" aria-hidden="true" />
              رزرو تو
            </li>
          </ul>
          <p className="hall__hint">روی هر صندلی خالی بزن تا پرده را از همان‌جا ببینی.</p>
        </footer>
      </div>

      <div className="pov" inert={phase !== 'seat'}>
        <button type="button" className="icon-btn" onClick={leave} aria-label="بازگشت به نقشه">
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        {seat && (
          <p className="pov__chip">
            نما از ردیف {fa(seat.row)}، صندلی {fa(seat.number)}
          </p>
        )}
        {lookHint && <p className="pov__hint">برای نگاه به اطراف، تصویر را بکش</p>}
      </div>

      <SeatSheet
        hall={hall}
        layout={layout}
        time={time}
        seat={seat}
        booked={booked}
        onBook={book}
        onChange={leave}
        sheetRef={sheetRef}
      />
    </div>
  );
}

function Showtimes({
  times,
  active,
  free,
  onChange,
}: {
  times: string[];
  active: string;
  free: Map<string, number>;
  onChange: (time: string) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [active]);

  return (
    <nav className="showtimes" aria-label="سانس‌های امروز">
      {times.map((time) => (
        <button
          key={time}
          type="button"
          ref={time === active ? activeRef : undefined}
          className="showtimes__chip"
          aria-pressed={time === active}
          onClick={() => onChange(time)}
        >
          <b>{faDigits(time)}</b>
          <span>{fa(free.get(time) ?? 0)} خالی</span>
        </button>
      ))}
    </nav>
  );
}
