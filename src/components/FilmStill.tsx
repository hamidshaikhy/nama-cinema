import { useEffect, useRef } from 'react';
import type { ArtId } from '../data/halls';
import { paintFilm } from '../lib/filmArt';

/** A frame of the hall's film, drawn at the hall's real screen proportions. */
export function FilmStill({ art, aspect }: { art: ArtId; aspect: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    canvas.width = 720;
    canvas.height = Math.round(720 / aspect);
    paintFilm(ctx, canvas.width, canvas.height, art);
  }, [art, aspect]);

  return (
    <canvas
      ref={ref}
      className="film-still"
      style={{ aspectRatio: String(aspect) }}
      aria-hidden="true"
    />
  );
}
