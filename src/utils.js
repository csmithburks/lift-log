import { formatTime, kindOf, paceLabel, paceOf, parseTime } from './kinds';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const newSet = (type = 'normal') => ({
  id: uid(),
  weight: '',
  reps: '',
  done: false,
  type,
});

export const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const LB_PER_KG = 2.20462;
export function convert(weight, from, to) {
  const w = num(weight);
  if (!from || !to || from === to) return w;
  return from === 'kg' ? w * LB_PER_KG : w / LB_PER_KG;
}

export const round1 = (v) => Math.round(v * 10) / 10;
export const weightStr = (v) => (v ? String(round1(v)) : '');

// ---------- formatting ----------

export function formatDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatShortDuration(ms) {
  const mins = Math.round(Math.max(0, ms) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatShortDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function defaultWorkoutName(ts = Date.now()) {
  const h = new Date(ts).getHours();
  if (h < 12) return 'Morning Workout';
  if (h < 17) return 'Afternoon Workout';
  return 'Evening Workout';
}

export const formatVolume = (v) => Math.round(v).toLocaleString();

// "135 lb × 8", "12 reps", "2000 m · 7:45", "70 lb · 1:00".
export function formatSet(s, unit, distUnit = 'm') {
  if (!s) return '—';
  const w = num(s.weight);
  const r = num(s.reps);
  const sec = parseTime(s.time);
  const d = num(s.distance);
  if (sec > 0 || d > 0) {
    const parts = [];
    if (w > 0) parts.push(`${round1(w)} ${unit}`);
    if (d > 0) parts.push(`${round1(d)} ${distUnit}`);
    if (sec > 0) parts.push(formatTime(sec));
    return parts.join(' · ');
  }
  return w > 0 ? `${round1(w)} ${unit} × ${r}` : `${r} reps`;
}

// ---------- set math ----------

// A set counts once it has reps, a time or a distance logged
// (weight can be 0 for bodyweight moves).
export const isLoggedSet = (s) => num(s.reps) > 0 || parseTime(s.time) > 0 || num(s.distance) > 0;
export const isWorkingSet = (s) => s.type !== 'warmup';

export const setVolume = (s) => num(s.weight) * num(s.reps);

// Epley estimated one-rep max.
export function e1rm(weight, reps) {
  const w = num(weight);
  const r = num(reps);
  if (w <= 0 || r <= 0) return 0;
  return r === 1 ? w : w * (1 + r / 30);
}

export function workoutVolume(workout) {
  return workout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter(isWorkingSet).reduce((a, s) => a + setVolume(s), 0),
    0
  );
}

export const workoutSetCount = (w) =>
  w.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0);

export function bestSet(sets) {
  const working = sets.filter(isWorkingSet);
  if (!working.some((s) => num(s.reps) > 0)) {
    // Timed / distance sets: heaviest, then farthest, then longest.
    let top = null;
    const key = (s) => [num(s.weight), num(s.distance), parseTime(s.time)];
    for (const s of working) {
      const k = key(s);
      if (!top || k[0] > top.k[0] || (k[0] === top.k[0] && (k[1] > top.k[1] || (k[1] === top.k[1] && k[2] > top.k[2])))) {
        top = { s, k };
      }
    }
    return top ? top.s : sets[0];
  }
  let best = null;
  for (const s of working) {
    if (
      !best ||
      num(s.weight) > num(best.weight) ||
      (num(s.weight) === num(best.weight) && num(s.reps) > num(best.reps))
    ) {
      best = s;
    }
  }
  return best || sets[0];
}

// Label shown in the set column: W/D/F for special sets, otherwise the
// working-set number (warm-ups don't count toward the numbering).
export function setLabels(sets) {
  let n = 0;
  return sets.map((s) => {
    if (s.type === 'warmup') return 'W';
    n += 1;
    if (s.type === 'drop') return 'D';
    if (s.type === 'failure') return 'F';
    return String(n);
  });
}

// Most recent sets for an exercise, converted to the current unit.
export function previousSetsFor(history, exerciseName, unit) {
  for (const w of history) {
    const ex = w.exercises.find((e) => e.name === exerciseName);
    if (ex && ex.sets.length) {
      return ex.sets.map((s) => ({
        ...s,
        weight: weightStr(convert(s.weight, w.unit || unit, unit)),
      }));
    }
  }
  return [];
}

// New, unchecked sets pre-filled with the weights from the last time this
// exercise was done (set 1 gets last time's set 1, and so on; extra sets
// reuse the last weight). Reps stay empty so you enter what you actually do;
// last time's reps still show in the Previous column.
export function prefilledSets(history, exerciseName, unit, count, types) {
  const prev = previousSetsFor(history, exerciseName, unit).filter((s) => num(s.weight) > 0);
  return Array.from({ length: count }, (_, i) => {
    const s = newSet((types && types[i]) || 'normal');
    const src = prev[i] || prev[prev.length - 1];
    if (src) s.weight = src.weight;
    return s;
  });
}

// Target reps/weight for set i of a template exercise (per-set if given).
export function templateTarget(ex, i) {
  const per = ex.perSet && ex.perSet[i];
  return {
    reps: (per && per.reps) || ex.reps || '',
    weight: (per && per.weight) || ex.weight || '',
    time: (per && per.time) || ex.time || '',
    distance: (per && per.distance) || ex.distance || '',
  };
}

const hintFrom = (t) => {
  const h = {};
  if (t.reps) h.reps = String(t.reps);
  if (t.time) h.time = String(t.time);
  if (t.distance) h.distance = String(t.distance);
  return Object.keys(h).length ? h : undefined;
};

// Sets for a workout started from a template: the template's weight when it
// sets one (converted to the current unit), otherwise last time's weight.
// Target reps are kept on the set as a hint; reps stay empty until the set is
// done, so sets you skip still aren't saved.
export function templateSets(history, ex, unit) {
  const count = Math.max(1, ex.sets || 1);
  const fallback = prefilledSets(history, ex.name, unit, count);
  return fallback.map((s, i) => {
    const t = templateTarget(ex, i);
    const weight = num(t.weight) > 0 ? weightStr(convert(t.weight, ex.unit || unit, unit)) : s.weight;
    return { ...s, weight, target: hintFrom(t) };
  });
}

// Turns logged sets into template fields: one reps/weight for all sets when
// they match, otherwise per-set targets.
export function targetsFromSets(sets) {
  const working = sets.filter((s) => s.type !== 'warmup');
  const pairs = working.map((s) => ({
    reps: String(s.reps || ''),
    weight: String(s.weight || ''),
    time: String(s.time || ''),
    distance: String(s.distance || ''),
  }));
  if (!pairs.length) return { sets: 1, reps: '', weight: '', time: '', distance: '', perSet: null };
  const f = pairs[0];
  const same = pairs.every((p) => p.reps === f.reps && p.weight === f.weight && p.time === f.time && p.distance === f.distance);
  return { sets: pairs.length, reps: f.reps, weight: f.weight, time: f.time, distance: f.distance, perSet: same ? null : pairs };
}

// ---------- per-exercise stats ----------

// One entry per workout that included the exercise, oldest first,
// with weights converted into `unit`.
export function sessionsFor(history, exerciseName, unit) {
  const out = [];
  for (const w of history) {
    const ex = w.exercises.find((e) => e.name === exerciseName);
    if (!ex) continue;
    const working = ex.sets.filter((s) => isWorkingSet(s) && isLoggedSet(s));
    if (!working.length) continue;
    let heaviest = 0;
    let best1rm = 0;
    let bestVol = 0;
    let maxReps = 0;
    let volume = 0;
    let longestTime = 0;
    let totalTime = 0;
    let longestDistance = 0;
    let totalDistance = 0;
    let bestPace = 0;
    const du = ex.distUnit || 'm';
    for (const s of working) {
      const wt = convert(s.weight, w.unit || unit, unit);
      const reps = num(s.reps);
      const sec = parseTime(s.time);
      const dist = num(s.distance);
      heaviest = Math.max(heaviest, wt);
      best1rm = Math.max(best1rm, e1rm(wt, reps));
      bestVol = Math.max(bestVol, wt * reps);
      maxReps = Math.max(maxReps, reps);
      volume += wt * reps;
      longestTime = Math.max(longestTime, sec);
      totalTime += sec;
      longestDistance = Math.max(longestDistance, dist);
      totalDistance += dist;
      const pace = paceOf(dist, sec, du);
      if (pace > 0 && (!bestPace || pace < bestPace)) bestPace = pace;
    }
    out.push({
      workoutId: w.id,
      date: w.startedAt,
      workoutName: w.name,
      sets: ex.sets,
      unit: w.unit || unit,
      heaviest,
      e1rm: best1rm,
      bestSetVolume: bestVol,
      maxReps,
      volume,
      longestTime,
      totalTime,
      longestDistance,
      totalDistance,
      bestPace,
      kind: kindOf(ex),
      distUnit: du,
    });
  }
  return out.sort((a, b) => a.date - b.date);
}

export function recordsFor(history, exerciseName, unit) {
  const sessions = sessionsFor(history, exerciseName, unit);
  const rec = {
    sessions: sessions.length,
    heaviest: null,
    e1rm: null,
    bestSetVolume: null,
    maxReps: null,
    longestTime: null,
    longestDistance: null,
    bestPace: null,
    totalVolume: 0,
    totalReps: 0,
    totalTime: 0,
    totalDistance: 0,
    kind: sessions.length ? sessions[sessions.length - 1].kind : 'weight_reps',
    distUnit: sessions.length ? sessions[sessions.length - 1].distUnit : 'm',
  };
  for (const s of sessions) {
    rec.totalTime += s.totalTime;
    rec.totalDistance += s.totalDistance;
    for (const key of ['longestTime', 'longestDistance']) {
      if (s[key] > 0 && (!rec[key] || s[key] > rec[key].value)) rec[key] = { value: s[key], date: s.date };
    }
    if (s.bestPace > 0 && (!rec.bestPace || s.bestPace < rec.bestPace.value)) rec.bestPace = { value: s.bestPace, date: s.date };
    rec.totalVolume += s.volume;
    rec.totalReps += s.sets
      .filter((x) => isWorkingSet(x) && isLoggedSet(x))
      .reduce((a, x) => a + num(x.reps), 0);
    for (const key of ['heaviest', 'e1rm', 'bestSetVolume', 'maxReps']) {
      if (s[key] > 0 && (!rec[key] || s[key] > rec[key].value)) rec[key] = { value: s[key], date: s.date };
    }
  }
  return rec;
}

export const PR_LABEL = {
  heaviest: 'Heaviest weight',
  e1rm: 'Best est. 1RM',
  bestSetVolume: 'Best set volume',
  maxReps: 'Most reps',
  longestTime: 'Longest time',
  longestDistance: 'Longest distance',
  bestPace: 'Fastest pace',
};

// Which records count as PRs for each kind of exercise.
export const PR_KEYS = {
  weight_reps: ['heaviest', 'e1rm', 'bestSetVolume'],
  duration: ['longestTime'],
  distance_time: ['longestDistance', 'bestPace'],
  weight_time: ['heaviest', 'longestTime'],
  weight_distance: ['heaviest', 'longestDistance'],
};

export function formatRecord(key, value, unit, distUnit = 'm') {
  if (key === 'longestTime') return formatTime(value);
  if (key === 'bestPace') return `${formatTime(value)} ${paceLabel(distUnit)}`;
  if (key === 'longestDistance') return `${round1(value).toLocaleString()} ${distUnit}`;
  if (key === 'maxReps') return `${Math.round(value)} reps`;
  return `${round1(value).toLocaleString()} ${unit}`;
}

// Records this workout beat, compared with everything before it.
// The first time an exercise is logged doesn't count as a PR.
export function detectPRs(previousHistory, workout, unit) {
  const prs = [];
  for (const ex of workout.exercises) {
    const before = recordsFor(previousHistory, ex.name, unit);
    if (!before.sessions) continue;
    const now = recordsFor([workout], ex.name, unit);
    if (!now.sessions) continue;
    for (const key of PR_KEYS[kindOf(ex)] || PR_KEYS.weight_reps) {
      if (!now[key] || !before[key]) continue;
      const better = key === 'bestPace' ? now[key].value < before[key].value - 1e-6 : now[key].value > before[key].value + 1e-6;
      if (better) {
        prs.push({
          exercise: ex.name,
          type: key,
          value: round1(now[key].value),
          display: formatRecord(key, now[key].value, unit, ex.distUnit || 'm'),
        });
      }
    }
  }
  return prs;
}

// ---------- calendar ----------

export function startOfWeek(ts) {
  const d = new Date(ts);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function workoutsPerWeek(history, weeks = 12) {
  const thisWeek = startOfWeek(Date.now());
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    buckets.push({ start: start.getTime(), count: 0 });
  }
  for (const w of history) {
    const ws = startOfWeek(w.startedAt);
    const b = buckets.find((x) => x.start === ws);
    if (b) b.count += 1;
  }
  return buckets;
}
