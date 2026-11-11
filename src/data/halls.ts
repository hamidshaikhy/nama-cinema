export type ArtId = 'desert' | 'harbor' | 'mountain';

export interface Hall {
  id: string;
  name: string;
  /** One line that tells the halls apart on the home page. */
  blurb: string;
  sound: string;
  film: {
    title: string;
    genre: string;
    minutes: number;
    art: ArtId;
    /** Dominant colour of the picture; tints the light the screen throws on the room. */
    glow: string;
  };
  /** Seating geometry, in metres. The screen sits on z = 0 and rows climb away from it. */
  rows: number;
  blocks: number[];
  seatPitch: number;
  aisle: number;
  rowPitch: number;
  rise: number;
  firstRowZ: number;
  seatScale: [number, number, number];
  screen: { width: number; height: number; bottom: number };
  /** Horizontal viewing angle (degrees) that this room is tuned for. */
  idealAngle: number;
  /** Ticket price in tomans for view tiers 1 (weakest) to 4 (best). */
  prices: [number, number, number, number];
  showtimes: string[];
  seatColor: string;
  wallColor: string;
  floorColor: string;
}

export const HALLS: Hall[] = [
  {
    id: 'imax',
    name: 'سالن آیمکس',
    blurb: 'بزرگ‌ترین پرده‌ی مجموعه؛ از ردیف‌های وسط، تصویر تمام میدان دیدت را می‌گیرد.',
    sound: 'صدای ۱۲ کاناله',
    film: {
      title: 'آخرین کاروان',
      genre: 'ماجرایی',
      minutes: 148,
      art: 'desert',
      glow: '#e9cfa8',
    },
    rows: 9,
    blocks: [3, 10, 3],
    seatPitch: 0.58,
    aisle: 0.95,
    rowPitch: 1.0,
    rise: 0.32,
    firstRowZ: 5.6,
    seatScale: [1, 1, 1],
    screen: { width: 12.6, height: 6.63, bottom: 1.3 },
    idealAngle: 60,
    prices: [200_000, 300_000, 400_000, 500_000],
    showtimes: ['10:30', '13:15', '16:00', '18:45', '21:30', '00:15'],
    seatColor: '#a01f2e',
    wallColor: '#1a0d10',
    floorColor: '#120a0c',
  },
  {
    id: 'classic',
    name: 'سالن کلاسیک',
    blurb: 'پرده‌ی عریض سینمااسکوپ و شیب ملایم؛ همان سینمایی که همیشه می‌شناختی.',
    sound: 'دالبی ۷٫۱',
    film: {
      title: 'فانوس بندر',
      genre: 'درام',
      minutes: 112,
      art: 'harbor',
      glow: '#7f9fd8',
    },
    rows: 8,
    blocks: [3, 8, 3],
    seatPitch: 0.56,
    aisle: 0.9,
    rowPitch: 0.98,
    rise: 0.27,
    firstRowZ: 4.7,
    seatScale: [1, 1, 1],
    screen: { width: 10.4, height: 4.35, bottom: 1.7 },
    idealAngle: 56,
    prices: [150_000, 220_000, 290_000, 360_000],
    showtimes: ['11:00', '13:00', '15:00', '17:00', '19:00', '21:00', '23:00'],
    seatColor: '#1d4f6b',
    wallColor: '#0e1418',
    floorColor: '#0a0e11',
  },
  {
    id: 'vip',
    name: 'سالن ویژه',
    blurb: 'چهل صندلی تخت‌شو با فاصله‌ی زیاد؛ سالن کوچک است و هیچ صندلی‌ای خیلی دور نیست.',
    sound: 'دالبی اتموس',
    film: {
      title: 'برف دماوند',
      genre: 'عاشقانه',
      minutes: 124,
      art: 'mountain',
      glow: '#e0a9ac',
    },
    rows: 5,
    blocks: [2, 4, 2],
    seatPitch: 0.92,
    aisle: 1.0,
    rowPitch: 1.7,
    rise: 0.36,
    firstRowZ: 4.4,
    seatScale: [1.36, 1.08, 1.3],
    screen: { width: 8.4, height: 4.54, bottom: 1.25 },
    idealAngle: 56,
    prices: [400_000, 500_000, 600_000, 750_000],
    showtimes: ['14:00', '17:30', '21:00', '23:45'],
    seatColor: '#8a5a33',
    wallColor: '#17110c',
    floorColor: '#0f0b08',
  },
];

export function findHall(id: string | undefined): Hall | undefined {
  return HALLS.find((hall) => hall.id === id);
}

/** The next showtime that has not started yet, or the last one of the day. */
export function defaultShowtime(hall: Hall, now = new Date()): string {
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const upcoming = hall.showtimes.find((time) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m >= minutesNow;
  });
  return upcoming ?? hall.showtimes[hall.showtimes.length - 1];
}
