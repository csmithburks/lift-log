import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  history: 'liftlog:history',
  active: 'liftlog:activeWorkout',
  customExercises: 'liftlog:customExercises',
  templates: 'liftlog:templates',
  settings: 'liftlog:settings',
  legacyUnit: 'liftlog:unit',
};

export const DEFAULT_SETTINGS = { unit: 'lb', restSeconds: 90 };

async function read(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function write(key, value) {
  try {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage failures are non-fatal; in-memory state is still correct.
  }
}

export const loadHistory = () => read(KEYS.history, []);
export const saveHistory = (h) => write(KEYS.history, h);
export const loadActive = () => read(KEYS.active, null);
export const saveActive = (w) => write(KEYS.active, w);
export const loadCustomExercises = () => read(KEYS.customExercises, []);
export const saveCustomExercises = (e) => write(KEYS.customExercises, e);
export const loadTemplates = () => read(KEYS.templates, []);
export const saveTemplates = (t) => write(KEYS.templates, t);
export const saveSettings = (s) => write(KEYS.settings, s);

export async function loadSettings() {
  const stored = await read(KEYS.settings, null);
  if (stored) return { ...DEFAULT_SETTINGS, ...stored };
  // Carry over the unit chosen in the first version of the app.
  const legacyUnit = await read(KEYS.legacyUnit, null);
  return { ...DEFAULT_SETTINGS, ...(legacyUnit ? { unit: legacyUnit } : {}) };
}

export async function clearAll() {
  try {
    await AsyncStorage.multiRemove(Object.values(KEYS));
  } catch {}
}
