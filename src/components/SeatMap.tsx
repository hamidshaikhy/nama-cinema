import { memo, useState, type CSSProperties, type Ref } from 'react';
import type { Hall } from '../data/halls';
import { fa, toman } from '../lib/format';
import { VIEW_TEXT, type Layout, type Seat } from '../lib/seating';

interface Props {
  hall: Hall;
  layout: Layout;
  taken: Set<string>;
  mine: Set<string>;
  selectedId: string | null;
  onPick: (seat: Seat) => void;
  /** Receives the element whose box is the plan of the room; the 3D camera aligns to it. */
  mapRef: Ref<HTMLDivElement>;
}

/**
 * The seat plan. Every seat is placed by its real coordinates in the room, as a
 * percentage of the plan, so this drawing and the 3D hall seen from above are
 * the same picture at any size.
 */
export const SeatMap = memo(function SeatMap({
  hall,
  layout,
  taken,
  mine,
  selectedId,
  onPick,
  mapRef,
}: Props) {
  const [hover, setHover] = useState<Seat | null>(null);
  const { x0, x1, z0, z1 } = layout.bounds;
  const width = x1 - x0;
  const depth = z1 - z0;
  const left = (x: number) => `${((x - x0) / width) * 100}%`;
  const top = (z: number) => `${((z - z0) / depth) * 100}%`;
  const seatSize = `${((hall.seatPitch * Math.min(1.08, hall.seatScale[0])) / width) * 100}%`;
  const rows = Array.from({ length: hall.rows }, (_, i) => i);

  return (
    <div
      className="seatmap"
      ref={mapRef}
      style={{ '--ratio': width / depth, aspectRatio: `${width} / ${depth}` } as CSSProperties}
      onPointerLeave={() => setHover(null)}
    >
      <div
        className="seatmap__screen"
        style={{ width: `${Math.min(118, (hall.screen.width / width) * 100)}%` }}
        aria-hidden="true"
      >
        <span>پرده</span>
      </div>

      {rows.map((row) => (
        <span
          key={row}
          className="seatmap__row"
          style={{ top: top(hall.firstRowZ + row * hall.rowPitch) }}
          aria-hidden="true"
        >
          {fa(row + 1)}
        </span>
      ))}

      {layout.seats.map((seat) => {
        const isMine = mine.has(seat.id);
        const isTaken = taken.has(seat.id);
        const state = isMine ? 'mine' : isTaken ? 'taken' : `t${seat.tier}`;
        const selected = seat.id === selectedId;
        const name = `ردیف ${fa(seat.row)}، صندلی ${fa(seat.number)}`;
        return (
          <button
            key={seat.id}
            type="button"
            className={`seat seat--${state}${selected ? ' seat--selected' : ''}`}
            style={{ left: left(seat.x), top: top(seat.z), width: seatSize }}
            disabled={isTaken || isMine}
            aria-label={
              isMine
                ? `${name}، رزرو تو`
                : isTaken
                  ? `${name}، پر`
                  : `${name}، ${VIEW_TEXT[seat.kind].label}، ${toman(seat.price)}`
            }
            onClick={() => onPick(seat)}
            onPointerEnter={(event) => {
              if (event.pointerType === 'mouse') setHover(seat);
            }}
          />
        );
      })}

      {hover && !taken.has(hover.id) && !mine.has(hover.id) && (
        <div
          className="seatmap__tip"
          style={{ left: left(hover.x), top: top(hover.z) }}
          role="presentation"
        >
          <b>
            ردیف {fa(hover.row)}، صندلی {fa(hover.number)}
          </b>
          <span>{VIEW_TEXT[hover.kind].label}</span>
          <span>{toman(hover.price)}</span>
        </div>
      )}
    </div>
  );
});
