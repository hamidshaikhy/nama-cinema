import { useSyncExternalStore } from 'react';
import type { ViewKind } from './seating';

export interface Reservation {
  id: string;
  hallId: string;
  time: string;
  seatId: string;
  row: number;
  number: number;
  price: number;
  kind: ViewKind;
  createdAt: number;
}

const KEY = 'nama:reservations:v1';
const listeners = new Set<() => void>();
let cache: Reservation[] = read();

function read(): Reservation[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Reservation[]) : [];
  } catch {
    return [];
  }
}

function commit(next: Reservation[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the list still works for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = read();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function addReservation(entry: Omit<Reservation, 'id' | 'createdAt'>): Reservation {
  const existing = cache.find(
    (r) => r.hallId === entry.hallId && r.time === entry.time && r.seatId === entry.seatId,
  );
  if (existing) return existing;
  const reservation: Reservation = {
    ...entry,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  commit([reservation, ...cache]);
  return reservation;
}

export function removeReservation(id: string) {
  commit(cache.filter((r) => r.id !== id));
}

export function useReservations(): Reservation[] {
  return useSyncExternalStore(subscribe, () => cache);
}
