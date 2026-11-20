import type { HandRecord } from "./types";

const KEY = "holdem-coach.hands.v1";
const MAX = 3000;

export interface StoredHand extends HandRecord {
  sessionId: string;
}

export function loadHands(): StoredHand[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredHand[]) : [];
  } catch {
    return [];
  }
}

export function saveHand(h: StoredHand) {
  try {
    const all = loadHands();
    all.push(h);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-MAX)));
  } catch {
    /* Speicher voll oder blockiert: Analyse funktioniert trotzdem für die laufende Session */
  }
}

export function clearHands() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorieren */
  }
}
