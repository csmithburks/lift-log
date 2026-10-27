import { uid } from './utils';

export const SUPERSET_COLORS = ['#F472B6', '#34D399', '#FBBF24', '#60A5FA', '#C084FC', '#FB923C'];

/**
 * For each exercise, its superset info: { letter, color, size, pos }, or
 * null when it isn't in one. A superset is a run of consecutive exercises
 * that share the same supersetId; a lone exercise with an id doesn't count.
 */
export function supersetInfo(exercises) {
  const info = exercises.map(() => null);
  let groupNo = 0;
  let i = 0;
  while (i < exercises.length) {
    const id = exercises[i].supersetId;
    let j = i;
    while (id && j + 1 < exercises.length && exercises[j + 1].supersetId === id) j++;
    if (id && j > i) {
      const letter = String.fromCharCode(65 + (groupNo % 26));
      const color = SUPERSET_COLORS[groupNo % SUPERSET_COLORS.length];
      for (let k = i; k <= j; k++) {
        info[k] = {
          letter,
          color,
          size: j - i + 1,
          pos: k === i ? 'first' : k === j ? 'last' : 'middle',
          lastIndex: j,
        };
      }
      groupNo++;
    }
    i = j + 1;
  }
  return info;
}

// Link exercise `index` with the one after it (joining any existing groups).
export function linkWithNext(exercises, index) {
  const list = exercises.map((e) => ({ ...e }));
  const a = list[index];
  const b = list[index + 1];
  if (!a || !b) return list;
  const id = a.supersetId || b.supersetId || uid();
  const oldB = b.supersetId;
  a.supersetId = id;
  for (const e of list) if (oldB && e.supersetId === oldB) e.supersetId = id;
  b.supersetId = id;
  return list;
}

// Take exercise `index` out of its superset; a group left with one member dissolves.
export function unlink(exercises, index) {
  const list = exercises.map((e) => ({ ...e }));
  const id = list[index].supersetId;
  list[index].supersetId = null;
  if (id) {
    const info = supersetInfo(list);
    list.forEach((e, k) => {
      if (e.supersetId === id && !info[k]) e.supersetId = null;
    });
  }
  return list;
}

// Copies exercises giving each superset a fresh id (used when starting a
// workout from a template or repeating one), so groups never collide.
export function remapSupersets(exercises) {
  const map = {};
  return exercises.map((e) => {
    if (!e.supersetId) return { ...e, supersetId: null };
    if (!map[e.supersetId]) map[e.supersetId] = uid();
    return { ...e, supersetId: map[e.supersetId] };
  });
}

export const REST_OPTIONS = [null, 0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function formatRest(seconds) {
  if (seconds === 0) return 'Off';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
