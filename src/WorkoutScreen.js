import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Vibration,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import ExercisePicker from './components/ExercisePicker';
import RestTimerBar from './components/RestTimerBar';
import TemplateEditor from './components/TemplateEditor';
import RestPicker from './components/RestPicker';
import { DIST_UNITS, KINDS, KIND_ORDER, formatTime, hasField, isTimed, kindOf, parseTime } from './kinds';
import { formatRest, linkWithNext, remapSupersets, supersetInfo, unlink } from './supersets';
import { confirm, notify } from './dialogs';
import { SET_TYPES, SET_TYPE_COLOR, colors, radius, spacing } from './theme';
import {
  defaultWorkoutName,
  formatDuration,
  formatSet,
  formatShortDate,
  isLoggedSet,
  newSet,
  prefilledSets,
  previousSetsFor,
  templateSets,
  setLabels,
  uid,
} from './utils';

const clone = (o) => JSON.parse(JSON.stringify(o));

// "3 × 8 @ 135 lb", "4 × 10", "3 sets (12/10/8)" or just "3 sets".
function describeTarget(e, unit) {
  if (e.time || e.distance) {
    const bits = [e.distance ? `${e.distance} ${e.distUnit || ''}`.trim() : null, e.time || null, e.weight ? `@ ${e.weight} ${e.unit || unit}` : null];
    return `${e.sets} × ${bits.filter(Boolean).join(' ')}`;
  }
  if (e.perSet && e.perSet.some((p) => p.reps)) {
    return `${e.sets} sets (${e.perSet.slice(0, e.sets).map((p) => p.reps || '–').join('/')})`;
  }
  if (!e.reps) return `${e.sets} set${e.sets === 1 ? '' : 's'}`;
  return `${e.sets} × ${e.reps}${e.weight ? ` @ ${e.weight} ${e.unit || unit}` : ''}`;
}

export default function WorkoutScreen(props) {
  const { active } = props;
  return active ? <ActiveWorkout {...props} /> : <StartScreen {...props} />;
}

// ---------------------------------------------------------------------------
// Start screen: empty workout + templates
// ---------------------------------------------------------------------------

function StartScreen({
  restSeconds,
  unit,
  setActive,
  history,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  exerciseList,
  onCreateCustom,
  kindFor,
}) {
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new

  const startEmpty = () =>
    setActive({ id: uid(), name: defaultWorkoutName(), notes: '', startedAt: Date.now(), exercises: [] });

  const startTemplate = (t) =>
    setActive({
      id: uid(),
      name: t.name,
      notes: '',
      templateId: t.id,
      startedAt: Date.now(),
      exercises: remapSupersets(t.exercises).map((e) => ({
        id: uid(),
        name: e.name,
        notes: '',
        supersetId: e.supersetId,
        restSeconds: e.restSeconds ?? null,
        // The exercise's current tracking type wins, so a change made during
        // a workout carries over to its templates.
        kind: kindFor(e.name).kind,
        distUnit: kindFor(e.name).distUnit,
        sets: templateSets(history, e, unit),
      })),
    });

  const lastUsed = (t) => {
    const w = history.find((h) => h.templateId === t.id);
    return w ? `Last done ${formatShortDate(w.startedAt)}` : 'Not done yet';
  };

  return (
    <ScrollView contentContainerStyle={styles.startScroll}>
      <Text style={styles.screenTitle}>Start Workout</Text>
      <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]} onPress={startEmpty}>
        <Text style={styles.primaryBtnText}>Start an Empty Workout</Text>
      </Pressable>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Templates</Text>
        <Pressable onPress={() => setEditing(null)} hitSlop={10}>
          <Text style={styles.sectionAction}>+ New</Text>
        </Pressable>
      </View>

      {templates.length === 0 && (
        <Text style={styles.emptyNote}>
          Templates are saved routines like "Push Day". Create one here, or tap "Save as Template" after
          finishing a workout.
        </Text>
      )}

      {templates.map((t) => (
        <Pressable
          key={t.id}
          style={({ pressed }) => [styles.templateCard, pressed && { opacity: 0.85 }]}
          onPress={() => startTemplate(t)}
        >
          <View style={styles.templateHead}>
            <Text style={styles.templateName}>{t.name}</Text>
            <Pressable onPress={() => setEditing(t)} hitSlop={12}>
              <Text style={styles.editLink}>Edit</Text>
            </Pressable>
          </View>
          <Text style={styles.templateMeta}>{lastUsed(t)}</Text>
          {(() => {
            const g = supersetInfo(t.exercises);
            return t.exercises.map((e, i) => (
              <Text key={e.id} style={styles.templateEx} numberOfLines={1}>
                {g[i] && <Text style={{ color: g[i].color, fontWeight: '800' }}>{g[i].letter} </Text>}
                {describeTarget({ ...e, distUnit: kindFor(e.name).distUnit }, unit)} · {e.name}
              </Text>
            ));
          })()}
          <Text style={styles.tapHint}>Tap to start</Text>
        </Pressable>
      ))}

      <TemplateEditor
        visible={editing !== undefined}
        template={editing || null}
        onClose={() => setEditing(undefined)}
        onSave={(t) => {
          onSaveTemplate(t);
          setEditing(undefined);
        }}
        onDelete={(id) => {
          onDeleteTemplate(id);
          setEditing(undefined);
        }}
        exerciseList={exerciseList}
        onCreateCustom={onCreateCustom}
        defaultRestSeconds={restSeconds}
        unit={unit}
        kindFor={kindFor}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Active workout
// ---------------------------------------------------------------------------

function ActiveWorkout({ active, setActive, history, unit, restSeconds, onFinish, exerciseList, onCreateCustom, kindFor, onSetKind }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [kindPickerFor, setKindPickerFor] = useState(null); // exercise id
  const [rest, setRest] = useState(null); // { endsAt, total }
  const [restPickerFor, setRestPickerFor] = useState(null); // exercise id
  const groups = supersetInfo(active.exercises);
  const restFor = (ex) => (ex.restSeconds ?? restSeconds);

  const setExercises = (fn) => setActive((w) => ({ ...w, exercises: fn(w.exercises) }));

  const endRest = useCallback(() => setRest(null), []);
  const adjustRest = (delta) =>
    setRest((r) => {
      if (!r) return r;
      const endsAt = Math.max(Date.now() + 1000, r.endsAt + delta * 1000);
      return { endsAt, total: Math.max(r.total + delta, 1) };
    });

  const update = (fn) => setActive((w) => fn(clone(w)));
  const findSet = (w, exId, setId) => w.exercises.find((e) => e.id === exId).sets.find((x) => x.id === setId);

  const addExercise = (name) => {
    setPickerOpen(false);
    update((w) => {
      const last = previousSetsFor(history, name, unit);
      // Same number of sets as last time (or 1), weights pre-filled.
      const k = kindFor(name);
      w.exercises.push({
        id: uid(),
        name,
        notes: '',
        kind: k.kind,
        distUnit: k.distUnit,
        sets: prefilledSets(history, name, unit, Math.max(1, last.filter((s) => s.type !== 'warmup').length)),
      });
      return w;
    });
  };

  const removeExercise = async (ex) => {
    if (await confirm('Remove exercise?', ex.name, { confirmText: 'Remove', destructive: true })) {
      update((w) => {
        w.exercises = w.exercises.filter((e) => e.id !== ex.id);
        return w;
      });
    }
  };

  // Moving within a superset keeps it; moving out of one unlinks the exercise.
  const moveExercise = (index, dir) =>
    setExercises((list) => {
      const j = index + dir;
      if (j < 0 || j >= list.length) return list;
      let next = [...list];
      const sameGroup = list[index].supersetId && list[index].supersetId === list[j].supersetId;
      if (!sameGroup && list[index].supersetId) next = unlink(next, index);
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const addSet = (exId) =>
    update((w) => {
      const ex = w.exercises.find((e) => e.id === exId);
      const last = ex.sets[ex.sets.length - 1];
      // Pre-fill from the previous set so repeat sets are one tap.
      ex.sets.push({
        ...newSet(),
        weight: last?.weight ?? '',
        reps: last?.reps ?? '',
        time: last?.time ?? '',
        distance: last?.distance ?? '',
        target: last?.target,
      });
      return w;
    });

  const removeSet = async (exId, setId, label) => {
    if (await confirm(`Delete set ${label}?`, undefined, { confirmText: 'Delete', destructive: true })) {
      update((w) => {
        const ex = w.exercises.find((e) => e.id === exId);
        ex.sets = ex.sets.filter((s) => s.id !== setId);
        return w;
      });
    }
  };

  const editSet = (exId, setId, field, value) =>
    update((w) => {
      findSet(w, exId, setId)[field] = value;
      return w;
    });

  const cycleType = (exId, setId) =>
    update((w) => {
      const s = findSet(w, exId, setId);
      const i = SET_TYPES.indexOf(s.type || 'normal');
      s.type = SET_TYPES[(i + 1) % SET_TYPES.length];
      return w;
    });

  // Which boxes still need a value for a set of this kind.
  const missing = (s, kind) => KINDS[kind].fields.filter((f) => f !== 'weight' && !String(s[f] || '').trim());

  const toggleDone = (exIndex, exId, setId, prev) => {
    const ex = active.exercises.find((e) => e.id === exId);
    const kind = kindOf(ex);
    const current = findSet(active, exId, setId);
    const need = missing(current, kind);
    const canFill = need.every((f) => current.target?.[f] || (prev && prev[f]));
    if (!current.done && need.length && !canFill) return; // nothing to check off yet
    const nowDone = !current.done;
    update((w) => {
      const s = findSet(w, exId, setId);
      // Checking off an empty set fills it from the template target, or else
      // from last session, like most trackers do.
      if (!s.done) {
        for (const f of need) s[f] = String(s.target?.[f] || prev?.[f] || '');
        if (prev && hasField(kind, 'weight')) s.weight = s.weight || prev.weight;
      }
      s.done = nowDone;
      return w;
    });
    if (!nowDone) return;
    startRestAfter(exIndex);
  };

  const startRestAfter = (exIndex) => {
    // In a superset, rest only after the last exercise of the round,
    // using that exercise's rest setting.
    const g = groups[exIndex];
    if (g && g.pos !== 'last') return;
    const secs = restFor(active.exercises[g ? g.lastIndex : exIndex]);
    if (secs > 0) setRest({ endsAt: Date.now() + secs * 1000, total: secs });
  };

  // ---- stopwatch for timed sets (kept on the workout so it survives closing the app)
  const timing = active.timing || null;
  const startTiming = (exId, setId) => setActive((w) => ({ ...w, timing: { exId, setId, startedAt: Date.now() } }));
  const stopTiming = (exIndex) => {
    if (!timing) return;
    const elapsed = (Date.now() - timing.startedAt) / 1000;
    update((w) => {
      const s = findSet(w, timing.exId, timing.setId);
      if (s) {
        s.time = formatTime(elapsed);
        s.done = true;
      }
      w.timing = null;
      return w;
    });
    startRestAfter(exIndex);
  };

  // ---- tracking type
  const changeKind = (exId, kind, distUnit) => {
    const ex = active.exercises.find((e) => e.id === exId);
    update((w) => {
      const e = w.exercises.find((x) => x.id === exId);
      e.kind = kind;
      e.distUnit = distUnit;
      return w;
    });
    if (ex) onSetKind(ex.name, kind, distUnit);
  };

  const finish = async () => {
    const logged = active.exercises
      .map((e) => ({ ...e, sets: e.sets.filter(isLoggedSet) }))
      .filter((e) => e.sets.length);
    if (!logged.length) {
      notify('Nothing to save', 'Log at least one set (reps, time or distance) before finishing.');
      return;
    }
    const unchecked = active.exercises.some((e) => e.sets.some((s) => isLoggedSet(s) && !s.done));
    const ok = await confirm(
      'Finish workout?',
      unchecked
        ? 'Some sets have values but are not checked off; they will still be saved. Empty sets are left out.'
        : 'Empty sets will be left out.',
      { confirmText: 'Finish' }
    );
    if (!ok) return;
    setRest(null);
    onFinish({
      ...active,
      timing: undefined,
      name: active.name.trim() || defaultWorkoutName(active.startedAt),
      exercises: logged.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, done: true })) })),
      finishedAt: Date.now(),
      unit,
    });
  };

  const cancel = async () => {
    if (await confirm('Discard workout?', 'This workout will not be saved.', { confirmText: 'Discard', destructive: true })) {
      setRest(null);
      setActive(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={cancel} hitSlop={12}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Timer startedAt={active.startedAt} />
        <Pressable onPress={finish} style={styles.finishBtn}>
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
      </View>

      {rest && <RestTimerBar rest={rest} onAdjust={adjustRest} onSkip={endRest} />}

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TextInput
          value={active.name}
          onChangeText={(name) => setActive((w) => ({ ...w, name }))}
          style={styles.nameInput}
          placeholder="Workout name"
          placeholderTextColor={colors.muted}
        />
        <TextInput
          value={active.notes || ''}
          onChangeText={(notes) => setActive((w) => ({ ...w, notes }))}
          style={styles.notesInput}
          placeholder="Workout notes"
          placeholderTextColor={colors.muted}
          multiline
        />

        {active.exercises.map((ex, exIndex) => {
          const prevSets = previousSetsFor(history, ex.name, unit);
          const labels = setLabels(ex.sets);
          const g = groups[exIndex];
          const isLast = exIndex === active.exercises.length - 1;
          return (
            <View
              key={ex.id}
              style={[
                styles.exCard,
                g && { borderLeftWidth: 4, borderLeftColor: g.color },
                g && g.pos !== 'last' && styles.exCardLinked,
              ]}
            >
              {g && g.pos === 'first' && (
                <Text style={[styles.supersetLabel, { color: g.color }]}>
                  SUPERSET {g.letter} · {g.size} exercises · rest after the round
                </Text>
              )}
              <View style={styles.exHeader}>
                <Text style={styles.exName}>{ex.name}</Text>
                <Pressable hitSlop={8} onPress={() => moveExercise(exIndex, -1)} style={styles.iconBtn}>
                  <Text style={[styles.iconText, exIndex === 0 && { opacity: 0.3 }]}>↑</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  onPress={() => moveExercise(exIndex, 1)}
                  style={styles.iconBtn}
                >
                  <Text style={[styles.iconText, exIndex === active.exercises.length - 1 && { opacity: 0.3 }]}>
                    ↓
                  </Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => removeExercise(ex)} style={styles.iconBtn}>
                  <Text style={[styles.iconText, { color: colors.danger }]}>×</Text>
                </Pressable>
              </View>

              <TextInput
                value={ex.notes || ''}
                onChangeText={(v) =>
                  update((w) => {
                    w.exercises.find((e) => e.id === ex.id).notes = v;
                    return w;
                  })
                }
                placeholder="Add a note"
                placeholderTextColor={colors.muted}
                style={styles.exNotes}
              />

              <View style={styles.chipRow}>
                <Pressable style={styles.chip} onPress={() => setKindPickerFor(ex.id)}>
                  <Text style={styles.chipText}>
                    ⚙ {KINDS[kindOf(ex)].label}
                    {hasField(kindOf(ex), 'distance') ? ` · ${ex.distUnit || 'm'}` : ''}
                  </Text>
                </Pressable>
                {g && g.pos !== 'last' ? (
                  <View style={[styles.chip, styles.chipStatic]}>
                    <Text style={styles.chipText}>⏱ No rest → next</Text>
                  </View>
                ) : (
                  <Pressable style={styles.chip} onPress={() => setRestPickerFor(ex.id)}>
                    <Text style={styles.chipText}>
                      ⏱ {g ? 'Round rest ' : 'Rest '}
                      {formatRest(restFor(ex))}
                      {ex.restSeconds == null ? ' (default)' : ''}
                    </Text>
                  </Pressable>
                )}
                {g ? (
                  <Pressable style={styles.chip} onPress={() => setExercises((l) => unlink(l, exIndex))}>
                    <Text style={[styles.chipText, { color: g.color }]}>⛓ Unlink</Text>
                  </Pressable>
                ) : null}
                {!isLast && (!g || g.pos === 'last') && (
                  <Pressable style={styles.chip} onPress={() => setExercises((l) => linkWithNext(l, exIndex))}>
                    <Text style={styles.chipText}>⛓ Superset with next</Text>
                  </Pressable>
                )}
              </View>

              {(() => {
                const kind = kindOf(ex);
                const fields = KINDS[kind].fields;
                const du = ex.distUnit || 'm';
                const head = { weight: unit.toUpperCase(), reps: 'REPS', time: 'TIME', distance: du.toUpperCase() };
                return (
                  <>
                    <View style={styles.setHeaderRow}>
                      <Text style={[styles.colHead, styles.colSet]}>SET</Text>
                      <Text style={[styles.colHead, styles.colPrev]}>PREVIOUS</Text>
                      {fields.map((f) => (
                        <Text key={f} style={[styles.colHead, f === 'time' ? styles.colTime : styles.colNum]}>
                          {head[f]}
                        </Text>
                      ))}
                      <View style={styles.colCheck} />
                    </View>

                    {ex.sets.map((s, i) => {
                      const prev = prevSets[i];
                      const typeColor = SET_TYPE_COLOR[s.type];
                      const running = timing && timing.exId === ex.id && timing.setId === s.id;
                      const ph = (f) => (s.target?.[f] ? String(s.target[f]) : prev?.[f] ? String(prev[f]) : f === 'time' ? '0:00' : '0');
                      return (
                        <Pressable
                          key={s.id}
                          onLongPress={() => removeSet(ex.id, s.id, labels[i])}
                          style={[styles.setRow, s.done && styles.setRowDone]}
                        >
                          <Pressable style={styles.colSet} onPress={() => cycleType(ex.id, s.id)} hitSlop={6}>
                            <Text style={[styles.setNum, typeColor && { color: typeColor }]}>{labels[i]}</Text>
                          </Pressable>
                          <Text style={[styles.prevText, styles.colPrev]} numberOfLines={1}>
                            {prev ? formatSet(prev, unit, du) : '—'}
                          </Text>
                          {fields.map((f) => {
                            if (f === 'time') {
                              return (
                                <View key={f} style={[styles.colTime, styles.timeCell]}>
                                  {running ? (
                                    <Stopwatch startedAt={timing.startedAt} targetSeconds={parseTime(s.target?.time)} />
                                  ) : (
                                    <TextInput
                                      style={[styles.numInput, { flex: 1 }]}
                                      value={s.time || ''}
                                      onChangeText={(v) => editSet(ex.id, s.id, 'time', v.replace(/[^0-9:]/g, ''))}
                                      onEndEditing={() => s.time && editSet(ex.id, s.id, 'time', parseTime(s.time) ? formatTime(parseTime(s.time)) : '')}
                                      keyboardType="numbers-and-punctuation"
                                      placeholder={ph('time')}
                                      placeholderTextColor={colors.muted}
                                      selectTextOnFocus
                                      maxLength={8}
                                    />
                                  )}
                                  <Pressable
                                    style={[styles.watchBtn, running && styles.watchBtnOn]}
                                    hitSlop={4}
                                    onPress={() => (running ? stopTiming(exIndex) : !timing && startTiming(ex.id, s.id))}
                                  >
                                    <Text style={[styles.watchText, running && { color: '#fff' }]}>{running ? '■' : '▶'}</Text>
                                  </Pressable>
                                </View>
                              );
                            }
                            const numeric = f === 'reps';
                            return (
                              <TextInput
                                key={f}
                                style={[styles.numInput, styles.colNum]}
                                value={s[f] || ''}
                                onChangeText={(v) => editSet(ex.id, s.id, f, v.replace(numeric ? /[^0-9]/g : /[^0-9.,]/g, ''))}
                                keyboardType={numeric ? 'number-pad' : 'decimal-pad'}
                                placeholder={f === 'weight' ? (prev?.weight ? String(prev.weight) : '0') : ph(f)}
                                placeholderTextColor={colors.muted}
                                selectTextOnFocus
                              />
                            );
                          })}
                          <Pressable
                            style={[styles.check, styles.colCheck, s.done && styles.checkDone]}
                            onPress={() => toggleDone(exIndex, ex.id, s.id, prev)}
                            hitSlop={6}
                          >
                            <Text style={styles.checkMark}>✓</Text>
                          </Pressable>
                        </Pressable>
                      );
                    })}
                  </>
                );
              })()}

              <Pressable style={styles.addSetBtn} onPress={() => addSet(ex.id)}>
                <Text style={styles.addSetText}>+ Add Set</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable style={styles.addExBtn} onPress={() => setPickerOpen(true)}>
          <Text style={styles.addExText}>+ Add Exercise</Text>
        </Pressable>
        {active.exercises.length > 0 && (
          <Text style={styles.hint}>
            Tap a set number to mark it warm-up (W), drop (D) or failure (F). Long-press a set to delete it. Use ⛓ to superset exercises — rest starts after the last one in the round. Tap ⚙ to track an exercise by time or distance; ▶ runs a stopwatch for timed sets.
          </Text>
        )}
      </ScrollView>

      <RestPicker
        visible={!!restPickerFor}
        title={(() => {
          const i = active.exercises.findIndex((e) => e.id === restPickerFor);
          return groups[i] ? `Rest after superset ${groups[i].letter}` : 'Rest after each set';
        })()}
        value={active.exercises.find((e) => e.id === restPickerFor)?.restSeconds ?? null}
        defaultSeconds={restSeconds}
        onPick={(v) => {
          setExercises((l) => l.map((e) => (e.id === restPickerFor ? { ...e, restSeconds: v } : e)));
          setRestPickerFor(null);
        }}
        onClose={() => setRestPickerFor(null)}
      />

      <KindPicker
        exercise={active.exercises.find((e) => e.id === kindPickerFor)}
        onPick={(kind, du) => changeKind(kindPickerFor, kind, du)}
        onClose={() => setKindPickerFor(null)}
      />

      <ExercisePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        exerciseList={exerciseList}
        onCreateCustom={onCreateCustom}
      />
    </KeyboardAvoidingView>
  );
}

// Live count-up for a timed set; buzzes once when the target time is reached.
function Stopwatch({ startedAt, targetSeconds }) {
  const [now, setNow] = useState(Date.now());
  const [buzzed, setBuzzed] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  const elapsed = (now - startedAt) / 1000;
  useEffect(() => {
    if (targetSeconds > 0 && !buzzed && elapsed >= targetSeconds) {
      setBuzzed(true);
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else Vibration.vibrate([0, 300, 150, 300]);
    }
  }, [elapsed, targetSeconds, buzzed]);
  const hit = targetSeconds > 0 && elapsed >= targetSeconds;
  return (
    <View style={[styles.numInput, styles.watchFace, hit && { backgroundColor: colors.successDim }]}>
      <Text style={styles.watchFaceText}>{formatTime(elapsed)}</Text>
    </View>
  );
}

// Choose how an exercise is tracked (and its distance unit).
function KindPicker({ exercise, onPick, onClose }) {
  if (!exercise) return null;
  const kind = kindOf(exercise);
  const du = exercise.distUnit || 'm';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Track {exercise.name} by</Text>
          {KIND_ORDER.map((k) => (
            <Pressable key={k} style={[styles.sheetRow, k === kind && styles.sheetRowOn]} onPress={() => onPick(k, du)}>
              <Text style={[styles.sheetRowText, k === kind && { color: '#fff' }]}>{KINDS[k].label}</Text>
              <Text style={[styles.sheetRowSub, k === kind && { color: '#fff' }]}>
                {k === 'weight_reps' && 'Lifting: 135 lb × 8'}
                {k === 'duration' && 'Planks, holds, bike: 1:30'}
                {k === 'distance_time' && 'Rowing, running: 2000 m in 7:45'}
                {k === 'weight_time' && "Farmer's walk: 70 lb for 1:00"}
                {k === 'weight_distance' && 'Sled push, carries: 90 lb for 40 m'}
              </Text>
            </Pressable>
          ))}
          {hasField(kind, 'distance') && (
            <>
              <Text style={styles.sheetLabel}>Distance unit</Text>
              <View style={{ flexDirection: 'row' }}>
                {DIST_UNITS.map((u) => (
                  <Pressable key={u} onPress={() => onPick(kind, u)} style={[styles.unitChip, u === du && styles.sheetRowOn]}>
                    <Text style={[styles.sheetRowText, u === du && { color: '#fff' }]}>{u}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Pressable onPress={onClose} style={{ alignItems: 'center', paddingTop: spacing.lg }}>
            <Text style={styles.cancelText}>Done</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Timer({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={styles.timer}>{formatDuration(now - startedAt)}</Text>;
}

const styles = StyleSheet.create({
  startScroll: { padding: spacing.lg, paddingBottom: 120 },
  screenTitle: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '700' },
  sectionAction: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  emptyNote: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  templateCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  templateHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  templateName: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1 },
  editLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  templateMeta: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  templateEx: { color: colors.text, fontSize: 14, paddingVertical: 1 },
  tapHint: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancelText: { color: colors.danger, fontSize: 16 },
  timer: { color: colors.text, fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  finishBtn: {
    backgroundColor: colors.success,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  finishText: { color: '#04140A', fontSize: 15, fontWeight: '700' },

  scroll: { padding: spacing.lg, paddingBottom: 120 },
  nameInput: { color: colors.text, fontSize: 24, fontWeight: '700' },
  notesInput: { color: colors.text, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg },

  exCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center' },
  exName: { color: colors.accent, fontSize: 17, fontWeight: '700', flex: 1, marginRight: spacing.sm },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  iconText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  exNotes: { color: colors.text, fontSize: 13, paddingVertical: 4, marginBottom: spacing.xs },
  exCardLinked: { marginBottom: spacing.xs },
  supersetLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  chip: {
    backgroundColor: colors.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipStatic: { opacity: 0.7 },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },

  setHeaderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs },
  colHead: { color: colors.muted, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  colSet: { width: 32, alignItems: 'center', textAlign: 'center' },
  colPrev: { flex: 1, textAlign: 'center', paddingHorizontal: 4 },
  colNum: { width: 64, marginHorizontal: 4 },
  colTime: { width: 96, marginHorizontal: 4 },
  timeCell: { flexDirection: 'row', alignItems: 'center' },
  watchBtn: {
    width: 28,
    height: 32,
    marginLeft: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchBtnOn: { backgroundColor: colors.danger },
  watchText: { color: colors.accent, fontSize: 13, fontWeight: '800' },
  watchFace: { flex: 1, height: 32, justifyContent: 'center', backgroundColor: colors.accentDim },
  watchFaceText: { color: colors.text, fontSize: 16, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl * 1.5 },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  sheetRow: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm },
  sheetRowOn: { backgroundColor: colors.accent },
  sheetRowText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  sheetRowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  sheetLabel: { color: colors.muted, fontSize: 13, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.sm },
  unitChip: { backgroundColor: colors.cardAlt, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 16, marginRight: spacing.sm },
  colCheck: { width: 36, marginLeft: 4 },

  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm },
  setRowDone: { backgroundColor: colors.successDim },
  setNum: { color: colors.text, fontSize: 15, fontWeight: '700' },
  prevText: { color: colors.muted, fontSize: 13 },
  numInput: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: radius.sm,
    paddingVertical: 6,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  check: {
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.success },
  checkMark: { color: colors.text, fontSize: 16, fontWeight: '800' },

  addSetBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addSetText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  addExBtn: {
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: spacing.md, lineHeight: 17 },
});
