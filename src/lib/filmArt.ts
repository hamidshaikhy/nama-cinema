import type { ArtId } from '../data/halls';
import { mulberry32 } from './seating';

/**
 * Paints the frame that plays on a hall's screen. Everything is drawn with
 * canvas paths, so there are no image files to download and the same picture
 * works at any size, from a home-page thumbnail to the 3D screen texture.
 */
export function paintFilm(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  art: ArtId,
): void {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (art === 'desert') desert(ctx, w, h);
  else if (art === 'harbor') harbor(ctx, w, h);
  else mountain(ctx, w, h);
  vignette(ctx, w, h);
  ctx.restore();
}

export function filmCanvas(art: ArtId, width: number, aspect: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round(width / aspect);
  const ctx = canvas.getContext('2d');
  if (ctx) paintFilm(ctx, canvas.width, canvas.height, art);
  return canvas;
}

function vertical(
  ctx: CanvasRenderingContext2D,
  y0: number,
  y1: number,
  stops: [number, string][],
): CanvasGradient {
  const gradient = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([at, color]) => gradient.addColorStop(at, color));
  return gradient;
}

function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.75);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function desert(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = vertical(ctx, 0, h * 0.62, [
    [0, '#bfae9f'],
    [0.55, '#e2cdb2'],
    [1, '#f3e2c6'],
  ]);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.7, h * 0.42, h * 0.55, 'rgba(255,240,214,0.75)');

  // Far ridge, washed out by haze.
  ctx.fillStyle = '#d6bd98';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.6);
  ctx.bezierCurveTo(w * 0.2, h * 0.53, w * 0.38, h * 0.6, w * 0.55, h * 0.56);
  ctx.bezierCurveTo(w * 0.75, h * 0.51, w * 0.9, h * 0.58, w, h * 0.55);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // Main dune: lit face, then the shadowed slip face behind its crest.
  ctx.fillStyle = vertical(ctx, h * 0.5, h, [
    [0, '#cfa877'],
    [1, '#a67f52'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.74);
  ctx.bezierCurveTo(w * 0.22, h * 0.7, w * 0.4, h * 0.56, w * 0.6, h * 0.55);
  ctx.bezierCurveTo(w * 0.78, h * 0.56, w * 0.9, h * 0.66, w, h * 0.68);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  ctx.fillStyle = 'rgba(96,66,38,0.42)';
  ctx.beginPath();
  ctx.moveTo(w * 0.6, h * 0.55);
  ctx.bezierCurveTo(w * 0.78, h * 0.56, w * 0.9, h * 0.66, w, h * 0.68);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.52, h);
  ctx.bezierCurveTo(w * 0.62, h * 0.82, w * 0.66, h * 0.66, w * 0.6, h * 0.55);
  ctx.fill();

  // Near dune in the foreground.
  ctx.fillStyle = vertical(ctx, h * 0.78, h, [
    [0, '#96704a'],
    [1, '#6f5033'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, h * 0.9);
  ctx.bezierCurveTo(w * 0.25, h * 0.8, w * 0.5, h * 0.86, w * 0.72, h * 0.93);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // A lone walker on the crest, with a long morning shadow.
  const fx = w * 0.47;
  const fy = h * 0.602;
  const fh = h * 0.055;
  ctx.fillStyle = 'rgba(60,40,24,0.35)';
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx - fh * 2.6, fy + fh * 0.5);
  ctx.lineTo(fx - fh * 2.4, fy + fh * 0.62);
  ctx.fill();
  ctx.fillStyle = '#2a1c14';
  ctx.fillRect(fx - fh * 0.11, fy - fh * 0.8, fh * 0.22, fh * 0.8);
  ctx.beginPath();
  ctx.arc(fx, fy - fh * 0.92, fh * 0.13, 0, Math.PI * 2);
  ctx.fill();
}

function harbor(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const horizon = h * 0.6;
  ctx.fillStyle = vertical(ctx, 0, horizon, [
    [0, '#070c24'],
    [0.6, '#172553'],
    [1, '#3a4d86'],
  ]);
  ctx.fillRect(0, 0, w, horizon);

  const random = mulberry32(7);
  ctx.fillStyle = '#dfe7ff';
  for (let i = 0; i < 90; i++) {
    const size = (0.5 + random() * 1.1) * (h / 420);
    ctx.globalAlpha = 0.25 + random() * 0.6;
    ctx.fillRect(random() * w, random() * horizon * 0.8, size, size);
  }
  ctx.globalAlpha = 1;

  const mx = w * 0.3;
  const my = h * 0.24;
  const mr = h * 0.075;
  glow(ctx, mx, my, mr * 6, 'rgba(190,210,255,0.3)');
  ctx.fillStyle = '#f2f1e6';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = vertical(ctx, horizon, h, [
    [0, '#1a2a5c'],
    [1, '#050814'],
  ]);
  ctx.fillRect(0, horizon, w, h - horizon);

  // Moonlight breaking up on the water.
  ctx.fillStyle = '#e8edff';
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const y = horizon + (h - horizon) * (0.03 + t * 0.9);
    const half = mr * (0.5 + t * 2.6) * (0.5 + random() * 0.6);
    ctx.globalAlpha = 0.5 * (1 - t) + 0.04;
    ctx.fillRect(mx - half + (random() - 0.5) * mr, y, half * 2, Math.max(1, h * 0.004));
  }
  ctx.globalAlpha = 1;

  // Town lights along the far shore, each with a short reflection.
  ctx.fillStyle = '#0a1028';
  ctx.beginPath();
  ctx.moveTo(w * 0.52, horizon);
  ctx.bezierCurveTo(w * 0.66, horizon - h * 0.05, w * 0.84, horizon - h * 0.07, w, horizon - h * 0.03);
  ctx.lineTo(w, horizon + 1);
  ctx.lineTo(w * 0.52, horizon + 1);
  ctx.fill();
  for (let i = 0; i < 16; i++) {
    const x = w * (0.58 + random() * 0.4);
    const size = h * 0.006;
    ctx.fillStyle = '#ffc878';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, horizon - size * (1 + random() * 3), size, size);
    ctx.globalAlpha = 0.22;
    ctx.fillRect(x, horizon + size, size, h * (0.02 + random() * 0.04));
  }
  ctx.globalAlpha = 1;

  // A dhow at anchor with one lantern lit.
  const bx = w * 0.64;
  const by = h * 0.76;
  const bw = w * 0.13;
  ctx.fillStyle = '#04060f';
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.55, by - bw * 0.1);
  ctx.quadraticCurveTo(bx, by + bw * 0.16, bx + bw * 0.62, by - bw * 0.2);
  ctx.lineTo(bx + bw * 0.44, by + bw * 0.07);
  ctx.lineTo(bx - bw * 0.4, by + bw * 0.07);
  ctx.fill();
  ctx.fillRect(bx - bw * 0.02, by - bw * 0.72, bw * 0.025, bw * 0.7);
  ctx.beginPath();
  ctx.moveTo(bx, by - bw * 0.7);
  ctx.lineTo(bx + bw * 0.4, by - bw * 0.18);
  ctx.lineTo(bx, by - bw * 0.22);
  ctx.fill();
  const lx = bx - bw * 0.3;
  const ly = by - bw * 0.2;
  glow(ctx, lx, ly, bw * 0.5, 'rgba(255,186,96,0.55)');
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(lx, ly, bw * 0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,186,96,0.25)';
  ctx.fillRect(lx - bw * 0.02, by + bw * 0.09, bw * 0.04, bw * 0.4);
}

function mountain(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = vertical(ctx, 0, h * 0.75, [
    [0, '#2c3a6b'],
    [0.5, '#a9708f'],
    [0.82, '#eaa98f'],
    [1, '#f6d2a8'],
  ]);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * 0.24, h * 0.66, h * 0.6, 'rgba(255,214,170,0.55)');

  // The volcano: a broad cone with its shoulders slightly uneven.
  const px = w * 0.56;
  const py = h * 0.17;
  ctx.fillStyle = vertical(ctx, py, h * 0.8, [
    [0, '#6d6c95'],
    [1, '#3b3f66'],
  ]);
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.78);
  ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.47, h * 0.3, px - w * 0.018, py);
  ctx.lineTo(px + w * 0.02, py + h * 0.004);
  ctx.bezierCurveTo(w * 0.68, h * 0.34, w * 0.84, h * 0.62, w * 1.04, h * 0.76);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  // Snow cap with ragged tongues running down the gullies.
  ctx.fillStyle = '#f7ece8';
  ctx.beginPath();
  ctx.moveTo(px - w * 0.018, py);
  ctx.lineTo(px + w * 0.02, py + h * 0.004);
  ctx.lineTo(px + w * 0.085, py + h * 0.17);
  ctx.lineTo(px + w * 0.055, py + h * 0.13);
  ctx.lineTo(px + w * 0.04, py + h * 0.23);
  ctx.lineTo(px + w * 0.012, py + h * 0.15);
  ctx.lineTo(px - w * 0.01, py + h * 0.26);
  ctx.lineTo(px - w * 0.035, py + h * 0.16);
  ctx.lineTo(px - w * 0.06, py + h * 0.22);
  ctx.lineTo(px - w * 0.075, py + h * 0.14);
  ctx.lineTo(px - w * 0.11, py + h * 0.2);
  ctx.fill();

  // The side facing the sunrise picks up the warm light.
  ctx.fillStyle = 'rgba(255,170,150,0.2)';
  ctx.beginPath();
  ctx.moveTo(w * 0.06, h * 0.78);
  ctx.bezierCurveTo(w * 0.3, h * 0.6, w * 0.47, h * 0.3, px - w * 0.018, py);
  ctx.lineTo(px - w * 0.02, h * 0.8);
  ctx.fill();

  ctx.fillStyle = vertical(ctx, h * 0.56, h * 0.8, [
    [0, 'rgba(255,236,224,0)'],
    [0.6, 'rgba(255,236,224,0.6)'],
    [1, 'rgba(255,236,224,0)'],
  ]);
  ctx.fillRect(0, h * 0.56, w, h * 0.24);

  // Foothills and a line of pines in silhouette.
  ctx.fillStyle = '#1d2140';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.8);
  ctx.bezierCurveTo(w * 0.2, h * 0.72, w * 0.4, h * 0.84, w * 0.62, h * 0.79);
  ctx.bezierCurveTo(w * 0.8, h * 0.75, w * 0.92, h * 0.8, w, h * 0.77);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.fill();

  const random = mulberry32(21);
  ctx.fillStyle = '#12152b';
  for (let i = 0; i < 44; i++) {
    const x = (i / 44) * w + (random() - 0.5) * w * 0.02;
    const base = h * (0.86 + random() * 0.07);
    const tall = h * (0.06 + random() * 0.07);
    ctx.beginPath();
    ctx.moveTo(x, base - tall);
    ctx.lineTo(x + tall * 0.22, base);
    ctx.lineTo(x - tall * 0.22, base);
    ctx.fill();
  }
  ctx.fillRect(0, h * 0.9, w, h * 0.1);
}
