import { profileSchema, readingSchema } from '@/lib/validation';
import type { Profile, Reading } from '@/types/tarot';
const PROFILE_KEY = 'arcana:profile:v1';
const HISTORY_KEY = 'arcana:history:v1';
export const HISTORY_LIMIT = 30;
function read(key: string): unknown {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function loadProfile(): Profile | null {
  const result = profileSchema.safeParse(read(PROFILE_KEY));
  return result.success ? result.data : null;
}
export function saveProfile(profile: Profile) { localStorage.setItem(PROFILE_KEY, JSON.stringify(profileSchema.parse(profile))); }
export function loadHistory(): Reading[] {
  const raw = read(HISTORY_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, HISTORY_LIMIT).flatMap(value => {
    const result = readingSchema.safeParse(value);
    if (!result.success) return [];
    return [result.data];
  });
}
export function saveHistory(readings: Reading[]) { localStorage.setItem(HISTORY_KEY, JSON.stringify(readings.slice(0,HISTORY_LIMIT))); }
export function forgetProfile() { localStorage.removeItem(PROFILE_KEY); }
