import type { Controls } from "./sketches";

// User-generated sketches are persisted to localStorage as plain JSON.
// We never store live code objects — the factoryCode string is rehydrated
// into a sandboxed iframe at render time, so reload-safety is built in.

export type UserSketch = {
  id: string;
  name: string;
  description: string;
  controls: Controls;
  factoryCode: string;
  createdAt: number;
};

const LS_KEY = "p5lab.userSketches";

export const loadUserSketches = (): UserSketch[] => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as UserSketch[];
  } catch {
    return [];
  }
};

export const saveUserSketches = (xs: UserSketch[]): void => {
  localStorage.setItem(LS_KEY, JSON.stringify(xs));
};

export const addUserSketch = (s: UserSketch): UserSketch[] => {
  const current = loadUserSketches();
  // Replace any existing entry with the same id, otherwise prepend.
  const filtered = current.filter((c) => c.id !== s.id);
  const next = [s, ...filtered];
  saveUserSketches(next);
  return next;
};

export const removeUserSketch = (id: string): UserSketch[] => {
  const next = loadUserSketches().filter((c) => c.id !== id);
  saveUserSketches(next);
  return next;
};
