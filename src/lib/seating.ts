import type { Hall } from '../data/halls';

export type Tier = 1 | 2 | 3 | 4;
export type ViewKind = 'sweet' | 'good' | 'close' | 'far' | 'side';

export interface Seat {
  /** Position in `layout.seats`; also the instance id in the 3D scene. */
  index: number;
  id: string;
  row: number;
  /** Seat number within the row, counted from the right as you face the screen. */
  number: number;
  /** Floor position of the seat in metres. */
  x: number;
  y: number;
  z: number;
  /** Straight-line distance to the screen plane. */
  distance: number;
  /** Horizontal angle the screen fills from this seat, in degrees. */
  angle: number;
  /** Metres off the centre line; negative is left of centre. */
  offset: number;
  score: number;
  tier: Tier;
  price: number;
  kind: ViewKind;
}

export interface Layout {
  seats: Seat[];
  cols: number;
  /** Centre x of each walkway between blocks. */
  aisles: number[];
  /** World rectangle that the 2D seat map covers. */
  bounds: { x0: number; x1: number; z0: number; z1: number };
}

export const EYE_HEIGHT = 1.15;

export const VIEW_TEXT: Record<ViewKind, { label: string; note: string }> = {
  sweet: {
    label: 'نقطه طلایی',
    note: 'پرده درست روبه‌روی توست و بدون چرخاندن سر، همه‌اش را می‌بینی.',
  },
  good: {
    label: 'دید خوب',
    note: 'کمی با مرکز فاصله داری، ولی تصویر هنوز صاف و کامل است.',
  },
  close: {
    label: 'خیلی نزدیک به پرده',
    note: 'تصویر از میدان دیدت بزرگ‌تر است؛ برای دیدن گوشه‌ها باید سر بچرخانی.',
  },
  far: {
    label: 'تصویر کامل از دور',
    note: 'کل پرده یک‌جا توی قاب است، فقط کوچک‌تر از ردیف‌های وسط.',
  },
  side: {
    label: 'دید کناری',
    note: 'پرده را اریب می‌بینی و سمت دورترش کمی جمع می‌شود.',
  },
};

export function buildLayout(hall: Hall): Layout {
  const cols = hall.blocks.reduce((sum, n) => sum + n, 0);
  const width = cols * hall.seatPitch + (hall.blocks.length - 1) * hall.aisle;

  const xs: number[] = [];
  const aisles: number[] = [];
  let cursor = -width / 2;
  hall.blocks.forEach((count, block) => {
    for (let i = 0; i < count; i++) {
      xs.push(cursor + hall.seatPitch / 2);
      cursor += hall.seatPitch;
    }
    if (block < hall.blocks.length - 1) {
      aisles.push(cursor + hall.aisle / 2);
      cursor += hall.aisle;
    }
  });

  const half = hall.screen.width / 2;
  const seats: Seat[] = [];
  for (let row = 0; row < hall.rows; row++) {
    const z = hall.firstRowZ + row * hall.rowPitch;
    for (let col = 0; col < cols; col++) {
      const x = xs[col];
      const angle = deg(Math.atan2(half - x, z) + Math.atan2(half + x, z));
      const score = viewScore(hall, angle, x);
      const tier = tierOf(score);
      seats.push({
        index: seats.length,
        id: `${row + 1}-${cols - col}`,
        row: row + 1,
        number: cols - col,
        x,
        y: row * hall.rise,
        z,
        distance: z,
        angle,
        offset: x,
        score,
        tier,
        price: hall.prices[tier - 1],
        kind: kindOf(hall, angle, x, tier),
      });
    }
  }

  return {
    seats,
    cols,
    aisles,
    bounds: {
      x0: -width / 2,
      x1: width / 2,
      z0: hall.firstRowZ - hall.rowPitch / 2,
      z1: hall.firstRowZ + (hall.rows - 1) * hall.rowPitch + hall.rowPitch / 2,
    },
  };
}

/**
 * 0..1 rating of how well a seat sees the screen. Sitting too close costs more
 * than sitting too far, and drifting sideways costs on top of either.
 */
function viewScore(hall: Hall, angle: number, x: number): number {
  const delta = angle - hall.idealAngle;
  const spread = delta > 0 ? 17 : 15;
  const depth = Math.exp(-((delta / spread) ** 2));
  const lateral = Math.exp(-((x / (hall.screen.width * 0.34)) ** 2));
  return depth * lateral;
}

function tierOf(score: number): Tier {
  if (score >= 0.78) return 4;
  if (score >= 0.5) return 3;
  if (score >= 0.24) return 2;
  return 1;
}

function kindOf(hall: Hall, angle: number, x: number, tier: Tier): ViewKind {
  if (tier === 4) return 'sweet';
  const delta = angle - hall.idealAngle;
  const sideways = Math.abs(x) / (hall.screen.width / 2);
  if (delta > 14) return 'close';
  if (sideways > 0.62) return 'side';
  if (delta < -9) return 'far';
  return 'good';
}

/**
 * Seats other people already hold for a showtime. Seeded by hall and time so the
 * same showing always looks the same, and weighted so better seats go first.
 */
export function takenSeats(hall: Hall, layout: Layout, time: string): Set<string> {
  const random = mulberry32(hash(`${hall.id}|${time}`));
  const busy = 0.16 + random() * 0.22;
  const taken = new Set<string>();
  let previous = false;
  for (const seat of layout.seats) {
    if (seat.number === layout.cols) previous = false;
    let chance: number = busy + seat.score * 0.3 + (previous ? 0.22 : 0);
    if (seat.tier === 4) chance = Math.min(chance, 0.6);
    previous = random() < chance;
    if (previous) taken.add(seat.id);
  }
  return taken;
}

function deg(radians: number): number {
  return (radians * 180) / Math.PI;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
