import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import WorkoutScreen from './src/WorkoutScreen';
import HistoryScreen from './src/HistoryScreen';
import ExercisesScreen from './src/ExercisesScreen';
import ProfileScreen from './src/ProfileScreen';
import WorkoutSummary from './src/components/WorkoutSummary';
import { DEFAULT_EXERCISES } from './src/exercises';
import { colors } from './src/theme';
import { detectPRs, prefilledSets, targetsFromSets, uid } from './src/utils';
import { remapSupersets } from './src/supersets';
import { KINDS, defaultDistUnit } from './src/kinds';
import {
  DEFAULT_SETTINGS,
  clearAll,
  loadActive,
  loadCustomExercises,
  loadHistory,
  loadSettings,
  loadTemplates,
  saveActive,
  saveCustomExercises,
  saveHistory,
  saveSettings,
  saveTemplates,
} from './src/storage';

const TABS = [
  { key: 'workout', label: 'Workout', icon: 'add-circle' },
  { key: 'history', label: 'History', icon: 'time' },
  { key: 'exercises', label: 'Exercises', icon: 'barbell' },
  { key: 'profile', label: 'Profile', icon: 'person-circle' },
];

const byNewest = (a, b) => b.startedAt - a.startedAt;

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('workout');
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [summary, setSummary] = useState(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') setupHomeScreenApp();
    (async () => {
      const [h, a, t, c, s] = await Promise.all([
        loadHistory(),
        loadActive(),
        loadTemplates(),
        loadCustomExercises(),
        loadSettings(),
      ]);
      setHistory(h.sort(byNewest));
      setActive(a);
      setTemplates(t);
      setCustomExercises(c);
      setSettings(s);
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  // Persist the in-progress workout so closing the app doesn't lose it.
  useEffect(() => {
    if (loaded.current) saveActive(active);
  }, [active]);

  const updateHistory = (next) => {
    const sorted = [...next].sort(byNewest);
    setHistory(sorted);
    saveHistory(sorted);
    return sorted;
  };

  const updateTemplates = (next) => {
    setTemplates(next);
    saveTemplates(next);
  };

  // Built-in + custom + anything that appears in history (e.g. imported from Strong).
  const exerciseList = useMemo(() => {
    const map = new Map();
    for (const e of DEFAULT_EXERCISES) map.set(e.name, e);
    // Custom entries can also override a built-in's tracking type.
    for (const e of customExercises) map.set(e.name, { ...(map.get(e.name) || {}), ...e });
    for (const w of history) {
      for (const ex of w.exercises) {
        if (!map.has(ex.name)) map.set(ex.name, { name: ex.name, muscle: 'Other', kind: ex.kind, distUnit: ex.distUnit });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [customExercises, history]);

  const finishWorkout = (workout) => {
    const prs = detectPRs(history, workout, workout.unit);
    const saved = { ...workout, prs };
    updateHistory([saved, ...history]);
    setActive(null);
    setSummary(saved);
    setTab('history');
  };

  const saveSummaryAsTemplate = () => {
    if (!summary) return;
    const t = {
      id: uid(),
      name: summary.name,
      notes: '',
      exercises: remapSupersets(summary.exercises).map((e) => ({
        id: uid(),
        name: e.name,
        supersetId: e.supersetId,
        restSeconds: e.restSeconds ?? null,
        unit: summary.unit || settings.unit,
        kind: e.kind,
        distUnit: e.distUnit,
        ...targetsFromSets(e.sets),
      })),
    };
    updateTemplates([...templates, t]);
    updateHistory(history.map((w) => (w.id === summary.id ? { ...w, templateId: t.id } : w)));
    setSummary(null);
    setTab('workout');
  };

  const repeatWorkout = (w) => {
    if (active) return;
    setActive({
      id: uid(),
      name: w.name,
      notes: '',
      templateId: w.templateId,
      startedAt: Date.now(),
      exercises: remapSupersets(w.exercises).map((e) => ({
        id: uid(),
        name: e.name,
        notes: '',
        supersetId: e.supersetId,
        restSeconds: e.restSeconds ?? null,
        kind: e.kind,
        distUnit: e.distUnit,
        // Same weights as last time; that workout's reps / times / distances become the targets.
        sets: prefilledSets(history, e.name, settings.unit, e.sets.length, e.sets.map((s) => s.type)).map((s, i) => {
          const src = e.sets[i] || {};
          const target = {};
          if (src.reps) target.reps = String(src.reps);
          if (src.time) target.time = String(src.time);
          if (src.distance) target.distance = String(src.distance);
          return Object.keys(target).length ? { ...s, target } : s;
        }),
      })),
    });
    setTab('workout');
  };

  // Tracking type for an exercise: { kind, distUnit }.
  const kindFor = (name) => {
    const e = exerciseList.find((x) => x.name === name);
    const kind = e && KINDS[e.kind] ? e.kind : 'weight_reps';
    return { kind, distUnit: e?.distUnit || defaultDistUnit(kind, settings.unit) };
  };

  // Remember a changed tracking type (works for built-in and custom exercises).
  const setKindFor = (name, kind, distUnit) => {
    const base = exerciseList.find((x) => x.name === name);
    const entry = { name, muscle: base?.muscle || 'Custom', kind, distUnit };
    const exists = customExercises.some((e) => e.name === name);
    const next = exists ? customExercises.map((e) => (e.name === name ? { ...e, kind, distUnit } : e)) : [...customExercises, entry];
    setCustomExercises(next);
    saveCustomExercises(next);
  };

  const createCustom = (exercise) => {
    if (customExercises.some((e) => e.name === exercise.name)) return;
    const next = [...customExercises, exercise];
    setCustomExercises(next);
    saveCustomExercises(next);
  };

  const changeSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  };

  // Returns how many workouts were actually added (duplicates are skipped).
  const importWorkouts = (workouts) => {
    const seen = new Set(history.map((w) => `${w.startedAt}|${w.name}`));
    const fresh = workouts.filter((w) => !seen.has(`${w.startedAt}|${w.name}`));
    if (fresh.length) updateHistory([...history, ...fresh]);
    return fresh.length;
  };

  const restoreBackup = (data) => {
    const ids = new Set(history.map((w) => w.id));
    const fresh = (data.history || []).filter((w) => w && w.id && !ids.has(w.id));
    if (fresh.length) updateHistory([...history, ...fresh]);
    const tIds = new Set(templates.map((t) => t.id));
    const freshT = (data.templates || []).filter((t) => t && t.id && !tIds.has(t.id));
    if (freshT.length) updateTemplates([...templates, ...freshT]);
    const names = new Set(customExercises.map((e) => e.name));
    const freshC = (data.customExercises || []).filter((e) => e && e.name && !names.has(e.name));
    if (freshC.length) {
      const next = [...customExercises, ...freshC];
      setCustomExercises(next);
      saveCustomExercises(next);
    }
    if (data.settings) changeSettings(data.settings);
    return { added: fresh.length, templates: freshT.length };
  };

  const clearEverything = async () => {
    await clearAll();
    setHistory([]);
    setActive(null);
    setTemplates([]);
    setCustomExercises([]);
    setSettings(DEFAULT_SETTINGS);
    setTab('workout');
  };

  let screen = null;
  if (tab === 'workout') {
    screen = (
      <WorkoutScreen
        active={active}
        setActive={setActive}
        history={history}
        templates={templates}
        unit={settings.unit}
        restSeconds={settings.restSeconds}
        onFinish={finishWorkout}
        onSaveTemplate={(t) => {
          const exists = templates.some((x) => x.id === t.id);
          updateTemplates(exists ? templates.map((x) => (x.id === t.id ? t : x)) : [...templates, t]);
        }}
        onDeleteTemplate={(id) => updateTemplates(templates.filter((t) => t.id !== id))}
        exerciseList={exerciseList}
        onCreateCustom={createCustom}
        kindFor={kindFor}
        onSetKind={setKindFor}
      />
    );
  } else if (tab === 'history') {
    screen = (
      <HistoryScreen
        history={history}
        unit={settings.unit}
        onDelete={(id) => updateHistory(history.filter((w) => w.id !== id))}
        onRepeat={repeatWorkout}
        canRepeat={!active}
      />
    );
  } else if (tab === 'exercises') {
    screen = <ExercisesScreen history={history} unit={settings.unit} exerciseList={exerciseList} />;
  } else {
    screen = (
      <ProfileScreen
        history={history}
        templates={templates}
        customExercises={customExercises}
        settings={settings}
        onChangeSettings={changeSettings}
        onImportWorkouts={importWorkouts}
        onRestoreBackup={restoreBackup}
        onClearAll={clearEverything}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top']}>
        {!ready ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={{ flex: 1 }}>{screen}</View>
        )}
      </SafeAreaView>
      <SafeAreaView style={styles.tabBarWrap} edges={['bottom']}>
        <View style={styles.tabBar}>
          {TABS.map((t) => {
            const selected = tab === t.key;
            const color = selected ? colors.accent : colors.muted;
            return (
              <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
                <View>
                  <Ionicons name={selected ? t.icon : `${t.icon}-outline`} size={24} color={color} />
                  {t.key === 'workout' && active && <View style={styles.liveDot} />}
                </View>
                <Text style={[styles.tabText, { color }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>

      <WorkoutSummary
        workout={summary}
        unit={settings.unit}
        onClose={() => setSummary(null)}
        onSaveTemplate={saveSummaryAsTemplate}
      />
    </SafeAreaProvider>
  );
}

// Web build only: tags that let iOS Safari's "Add to Home Screen" open the
// app full-screen with its own icon, like a native app.
function setupHomeScreenApp() {
  const head = document.head;
  const add = (tag, attrs) => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    head.appendChild(el);
  };
  document.title = 'Lift Log';
  add('meta', { name: 'apple-mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'mobile-web-app-capable', content: 'yes' });
  add('meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' });
  add('meta', { name: 'apple-mobile-web-app-title', content: 'Lift Log' });
  add('meta', { name: 'theme-color', content: colors.bg });
  add('link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' });
  add('link', { rel: 'manifest', href: '/manifest.json' });
  document.body.style.backgroundColor = colors.bg;
  // Stop the page from zooming in when a number field is focused.
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover');
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabBarWrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tabBar: { flexDirection: 'row', height: 56 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  liveDot: {
    position: 'absolute',
    top: 0,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
});
