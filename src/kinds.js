// How an exercise is tracked. Each kind lists the boxes a set shows.
//   weight  — load (lb/kg)
//   reps    — repetitions
//   time    — duration, typed as m:ss (stored as text, e.g. "1:30")
//   distance — in the exercise's distance unit
export const KINDS = {
  weight_reps: { label: 'Weight & reps', fields: ['weight', 'reps'] },
  duration: { label: 'Time', fields: ['time'] },
  distance_time: { label: 'Distance & time', fields: ['distance', 'time'] },
  weight_time: { label: 'Weight & time', fields: ['weight', 'time'] },
  weight_distance: { label: 'Weight & distance', fields: ['weight', 'distance'] },
};
export const KIND_ORDER = ['weight_reps', 'duration', 'distance_time', 'weight_time', 'weight_distance'];

export const DIST_UNITS = ['m', 'km', 'mi', 'yd'];

export const kindOf = (ex) => (ex && KINDS[ex.kind] ? ex.kind : 'weight_reps');
export const hasField = (kind, f) => KINDS[kind]?.fields.includes(f);
export const isTimed = (kind) => hasField(kind, 'time');

/**
 * "45" → 45s, "90" → 90s, "130" → 1:30, "1:30" → 90s, "1:02:03" → 3723s.
 * Returns 0 for empty or unreadable input.
 */
export function parseTime(input) {
  const str = String(input ?? '').trim();
  if (!str) return 0;
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => parseInt(p || '0', 10));
    if (parts.some((p) => !Number.isFinite(p) || p < 0)) return 0;
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const digits = str.replace(/\D/g, '');
  if (!digits) return 0;
  if (digits.length <= 2) return parseInt(digits, 10);
  if (digits.length <= 4) return parseInt(digits.slice(0, -2), 10) * 60 + parseInt(digits.slice(-2), 10);
  return parseInt(digits.slice(0, -4), 10) * 3600 + parseInt(digits.slice(-4, -2), 10) * 60 + parseInt(digits.slice(-2), 10);
}

export function formatTime(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Pace basis per distance unit: rowing-style /500m for meters.
const PACE_BASE = { m: 500, km: 1, mi: 1, yd: 100 };
export const paceLabel = (du) => (du === 'm' ? '/500m' : du === 'yd' ? '/100yd' : `/${du}`);

// Seconds per pace unit (lower is faster), or 0 if not computable.
export function paceOf(distance, seconds, du = 'm') {
  const d = parseFloat(String(distance ?? '').replace(',', '.'));
  if (!(d > 0) || !(seconds > 0)) return 0;
  return (seconds / d) * (PACE_BASE[du] || 1);
}

// Guess a sensible default distance unit for a kind.
export const defaultDistUnit = (kind, weightUnit) => (kind === 'distance_time' ? (weightUnit === 'kg' ? 'km' : 'mi') : 'm');
