import { useEffect, useMemo, type CSSProperties } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FilmStill } from '../components/FilmStill';
import { SiteHeader } from '../components/SiteHeader';
import { HALLS, type Hall } from '../data/halls';
import { fa, faDecimal, faDigits, thousands, today } from '../lib/format';

const STEPS = [
  {
    title: 'سالن و سانس را انتخاب کن',
    text: 'هر سالن فیلم، پرده و قیمت خودش را دارد. ساعت نمایش را از نوار بالای نقشه عوض می‌کنی.',
  },
  {
    title: 'روی یک صندلی بزن',
    text: 'نقشه کنار می‌رود و وارد خود سالن می‌شوی؛ دوربین پایین می‌آید و روی همان صندلی می‌نشیند.',
  },
  {
    title: 'پرده را ببین، بعد رزرو کن',
    text: 'فاصله تا پرده و زاویه‌ی دید را کنار تصویر می‌بینی. اگر خوشت نیامد، صندلی دیگری را امتحان کن.',
  },
];

export default function Home() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [hash]);

  return (
    <div className="home">
      <SiteHeader />

      <main>
        <section className="hero">
          <div className="hero__screen">
            <h1 className="hero__title">
              قبل از خریدن بلیت،
              <br />
              روی صندلی‌ات بنشین
            </h1>
          </div>
          <div className="hero__copy">
            <p>
              در نما هر صندلی را که انتخاب کنی، همان لحظه پرده را از همان‌جا می‌بینی. بعد تصمیم
              می‌گیری رزروش کنی یا نه.
            </p>
            <a className="btn btn--primary" href="#halls">
              انتخاب سالن
            </a>
          </div>
          <SeatRows />
        </section>

        <section className="halls" id="halls">
          <div className="section-head">
            <h2>سه سالن، سه پرده</h2>
            <p>برنامه‌ی {today()}</p>
          </div>
          <div className="halls__grid">
            {HALLS.map((hall) => (
              <HallCard key={hall.id} hall={hall} />
            ))}
          </div>
        </section>

        <section className="how">
          <div className="section-head">
            <h2>چطور کار می‌کند</h2>
          </div>
          <ol className="how__steps">
            {STEPS.map((step, i) => (
              <li key={step.title}>
                <span className="how__num">{fa(i + 1)}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>

          <div className="pricing">
            <div>
              <h3>هرچه دید بهتر، بلیت گران‌تر</h3>
              <p>
                قیمت هر صندلی از روی زاویه‌ی دیدش به پرده حساب می‌شود. وسط سالن گران‌ترین است؛ ردیف
                جلو، ته سالن و کناره‌ها ارزان‌تر.
              </p>
            </div>
            <ul className="pricing__tiers">
              {[4, 3, 2, 1].map((tier) => (
                <li key={tier}>
                  <span className={`swatch swatch--t${tier}`} aria-hidden="true" />
                  <span>{TIER_NAMES[tier - 1]}</span>
                  <b>{thousands(HALLS[0].prices[tier - 1])} هزار تومان</b>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <span>نما، سینما از نگاه صندلی تو</span>
        <a href="https://hamidshaikhy.vercel.app/" target="_blank" rel="noreferrer">
          طراحی و ساخت: حمید شیخی
        </a>
      </footer>
    </div>
  );
}

const TIER_NAMES = ['جلو، ته سالن و کناره‌ها', 'دید معمولی', 'دید خوب', 'نقطه طلایی'];

/** Two rows of seat backs under the hero screen: the page itself is a seat view. */
function SeatRows() {
  const far = useMemo(() => Array.from({ length: 15 }, (_, i) => i), []);
  const near = useMemo(() => Array.from({ length: 9 }, (_, i) => i), []);
  return (
    <div className="hero__rows" aria-hidden="true">
      <div className="hero__row hero__row--far">
        {far.map((i) => (
          <span key={i} />
        ))}
      </div>
      <div className="hero__row hero__row--near">
        {near.map((i) => (
          <span key={i} />
        ))}
      </div>
    </div>
  );
}

function HallCard({ hall }: { hall: Hall }) {
  const seats = hall.rows * hall.blocks.reduce((sum, n) => sum + n, 0);
  const aspect = hall.screen.width / hall.screen.height;
  return (
    <article className="hall-card" style={{ '--glow': hall.film.glow } as CSSProperties}>
      <Link to={`/hall/${hall.id}`} className="hall-card__screen" tabIndex={-1} aria-hidden="true">
        <FilmStill art={hall.film.art} aspect={aspect} />
      </Link>
      <h3 className="hall-card__name">{hall.name}</h3>
      <p className="hall-card__film">
        روی پرده: <b>{hall.film.title}</b>
        <span>
          {hall.film.genre}، {fa(hall.film.minutes)} دقیقه
        </span>
      </p>
      <p className="hall-card__blurb">{hall.blurb}</p>
      <dl className="hall-card__facts">
        <div>
          <dt>پرده</dt>
          <dd>{faDecimal(hall.screen.width)} متر</dd>
        </div>
        <div>
          <dt>صندلی</dt>
          <dd>{fa(seats)}</dd>
        </div>
        <div>
          <dt>بلیت</dt>
          <dd>
            {thousands(hall.prices[0])} تا {thousands(hall.prices[3])} هزار
          </dd>
        </div>
      </dl>
      <ul className="hall-card__times" aria-label="سانس‌های امروز">
        {hall.showtimes.map((time) => (
          <li key={time}>
            <Link to={`/hall/${hall.id}?t=${time}`}>{faDigits(time)}</Link>
          </li>
        ))}
      </ul>
      <Link to={`/hall/${hall.id}`} className="btn btn--outline hall-card__cta">
        دیدن صندلی‌های {hall.name}
      </Link>
    </article>
  );
}
