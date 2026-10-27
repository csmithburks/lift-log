import { num, uid, isLoggedSet } from './utils';
import { formatTime, parseTime } from './kinds';

// ---------- generic CSV ----------

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

export function parseCSV(text) {
  const src = text.replace(/^﻿/, '');
  const delim = detectDelimiter(src);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f.trim() !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== '')) rows.push(row);
  return rows;
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// ---------- Strong (and Lift Log CSV) import ----------

function parseDate(s) {
  const m = String(s)
    .trim()
    .match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0), +(m[6] || 0)).getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : NaN;
}

function parseDurationSeconds(raw, headerSaysSeconds) {
  const s = String(raw || '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    // Plain numbers: seconds if the header says so or the value is large,
    // otherwise minutes.
    return headerSaysSeconds || n > 400 ? n : n * 60;
  }
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m(?!s)/i);
  const sec = s.match(/(\d+)\s*s/i);
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (sec ? +sec[1] : 0);
}

function setTypeFromOrder(order) {
  const o = String(order || '').trim().toUpperCase();
  if (/^\d+$/.test(o)) return 'normal';
  if (o === 'W') return 'warmup';
  if (o === 'D') return 'drop';
  if (o === 'F') return 'failure';
  return null; // e.g. "Rest Timer" rows
}

const cleanWeight = (w) => (w > 0 ? String(Math.round(w * 100) / 100) : '');

/**
 * Parses a Strong export (comma- or semicolon-separated, any recent
 * version) or a Lift Log CSV export into workouts.
 */
export function importWorkoutCSV(text, fallbackUnit) {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error('The file is empty or is not a CSV export.');

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (pred) => header.findIndex(pred);
  const col = {
    workoutNo: find((h) => h.startsWith('workout #') || h === 'workout number'),
    date: find((h) => h === 'date' || h.startsWith('date')),
    name: find((h) => h.startsWith('workout name')),
    duration: find((h) => h.startsWith('duration')),
    exercise: find((h) => h.startsWith('exercise name') || h === 'exercise'),
    order: find((h) => h.startsWith('set order') || h === 'set'),
    weight: find((h) => h.startsWith('weight') && !h.includes('unit')),
    unit: find((h) => h === 'weight unit' || h === 'unit'),
    reps: find((h) => h === 'reps' || h.startsWith('reps')),
    notes: find((h) => h === 'notes' || h === 'exercise notes'),
    distance: find((h) => h.startsWith('distance') && !h.includes('unit')),
    distUnit: find((h) => h === 'distance unit'),
    seconds: find((h) => h === 'seconds' || h === 'time (sec)' || h.startsWith('seconds')),
    time: find((h) => h === 'time'),
    workoutNotes: find((h) => h.startsWith('workout notes')),
  };
  if (col.date < 0 || col.exercise < 0 || col.reps < 0) {
    throw new Error(
      "This doesn't look like a Strong export. Expected columns like Date, Exercise Name and Reps."
    );
  }

  const weightHeader = col.weight >= 0 ? header[col.weight] : '';
  const headerUnit = /kg/.test(weightHeader) ? 'kg' : /lb/.test(weightHeader) ? 'lb' : null;
  const durationIsSeconds = col.duration >= 0 && /sec/.test(header[col.duration]);
  const distHeader = col.distance >= 0 ? header[col.distance] : '';
  const headerDistUnit = /meter|\(m\)/.test(distHeader) ? 'm' : /\bkm\b|kilomet/.test(distHeader) ? 'km' : /mile|\(mi\)/.test(distHeader) ? 'mi' : null;
  const get = (r, i) => (i >= 0 && i < r.length ? r[i].trim() : '');

  const workouts = new Map();
  let skippedRows = 0;

  for (const r of rows.slice(1)) {
    const startedAt = parseDate(get(r, col.date));
    const exName = get(r, col.exercise);
    if (!Number.isFinite(startedAt) || !exName) {
      skippedRows++;
      continue;
    }
    const type = col.order >= 0 ? setTypeFromOrder(get(r, col.order)) : 'normal';
    if (!type) continue; // rest-timer rows aren't sets
    const reps = num(get(r, col.reps));
    const seconds = col.seconds >= 0 ? num(get(r, col.seconds)) : parseTime(get(r, col.time));
    const distance = num(get(r, col.distance));
    if (reps <= 0 && seconds <= 0 && distance <= 0) {
      skippedRows++; // nothing logged on this row
      continue;
    }

    const name = get(r, col.name) || 'Workout';
    const key = col.workoutNo >= 0 ? get(r, col.workoutNo) : `${get(r, col.date)}|${name}`;
    const rowUnit = get(r, col.unit).toLowerCase();
    const unit = rowUnit.startsWith('kg') ? 'kg' : rowUnit.startsWith('lb') ? 'lb' : headerUnit || fallbackUnit;

    let w = workouts.get(key);
    if (!w) {
      const dur = parseDurationSeconds(get(r, col.duration), durationIsSeconds);
      w = {
        id: uid(),
        name,
        startedAt,
        finishedAt: startedAt + dur * 1000,
        notes: get(r, col.workoutNotes),
        unit,
        source: 'import',
        exercises: [],
      };
      workouts.set(key, w);
    }
    let ex = w.exercises.find((e) => e.name === exName);
    if (!ex) {
      ex = { id: uid(), name: exName, notes: '', sets: [] };
      w.exercises.push(ex);
    }
    const note = get(r, col.notes);
    if (note && !ex.notes) ex.notes = note;
    const rowDistUnit = get(r, col.distUnit).toLowerCase();
    if (distance > 0 && !ex.distUnit) {
      ex.distUnit = ['m', 'km', 'mi', 'yd'].includes(rowDistUnit) ? rowDistUnit : headerDistUnit || (unit === 'kg' ? 'km' : 'mi');
    }
    ex.sets.push({
      id: uid(),
      weight: cleanWeight(num(get(r, col.weight))),
      reps: reps > 0 ? String(reps) : '',
      time: seconds > 0 ? formatTime(seconds) : '',
      distance: distance > 0 ? String(Math.round(distance * 100) / 100) : '',
      done: true,
      type,
    });
  }

  // Work out how each imported exercise is tracked from what its sets contain.
  for (const w of workouts.values()) {
    for (const ex of w.exercises) {
      const any = (f) => ex.sets.some((s) => num(s[f]) > 0 || (f === 'time' && parseTime(s.time) > 0));
      if (any('reps')) ex.kind = 'weight_reps';
      else if (any('distance')) ex.kind = any('weight') ? 'weight_distance' : 'distance_time';
      else ex.kind = any('weight') ? 'weight_time' : 'duration';
      if (ex.kind === 'weight_reps') delete ex.distUnit;
    }
  }

  const list = [...workouts.values()].filter((w) => w.exercises.some((e) => e.sets.some(isLoggedSet)));
  return { workouts: list, skippedRows };
}

// ---------- export ----------

const pad = (n) => String(n).padStart(2, '0');
function formatDateTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

export function exportWorkoutCSV(history, defaultUnit) {
  const header = [
    'Date',
    'Workout Name',
    'Duration (sec)',
    'Exercise Name',
    'Set Order',
    'Weight',
    'Weight Unit',
    'Reps',
    'Distance',
    'Distance Unit',
    'Seconds',
    'Notes',
    'Workout Notes',
  ];
  const lines = [header.join(',')];
  const sorted = [...history].sort((a, b) => a.startedAt - b.startedAt);
  for (const w of sorted) {
    const dur = Math.round(Math.max(0, (w.finishedAt || w.startedAt) - w.startedAt) / 1000);
    for (const ex of w.exercises) {
      let n = 0;
      for (const s of ex.sets) {
        let order;
        if (s.type === 'warmup') order = 'W';
        else {
          n += 1;
          order = s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : String(n);
        }
        lines.push(
          [
            formatDateTime(w.startedAt),
            w.name,
            dur,
            ex.name,
            order,
            num(s.weight),
            w.unit || defaultUnit,
            num(s.reps),
            num(s.distance) || '',
            num(s.distance) ? ex.distUnit || 'm' : '',
            parseTime(s.time) || '',
            ex.notes || '',
            w.notes || '',
          ]
            .map(csvCell)
            .join(',')
        );
      }
    }
  }
  return lines.join('\n');
}
