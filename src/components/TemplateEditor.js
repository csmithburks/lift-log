import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ExercisePicker from './ExercisePicker';
import RestPicker from './RestPicker';
import { formatRest, linkWithNext, supersetInfo, unlink } from '../supersets';
import { confirm, notify } from '../dialogs';
import { colors, radius, spacing } from '../theme';
import { uid } from '../utils';
import { KINDS, formatTime, hasField, parseTime } from '../kinds';

// template: { id, name, notes, exercises: [{ id, name, sets }] } or null for a new one.
export default function TemplateEditor({
  visible,
  template,
  onSave,
  onDelete,
  onClose,
  exerciseList,
  onCreateCustom,
  defaultRestSeconds = 90,
  unit = 'lb',
  kindFor = () => ({ kind: 'weight_reps', distUnit: 'm' }),
}) {
  const [draft, setDraft] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [restPickerFor, setRestPickerFor] = useState(null);

  useEffect(() => {
    if (visible) {
      setDraft(
        template
          ? JSON.parse(JSON.stringify(template))
          : { id: uid(), name: '', notes: '', exercises: [] }
      );
    }
  }, [visible, template]);

  if (!draft) return null;

  const isNew = !template;
  const groups = supersetInfo(draft.exercises);
  const restOf = (e) => e.restSeconds ?? defaultRestSeconds;
  const setExercises = (fn) => setDraft((d) => ({ ...d, exercises: fn(d.exercises) }));
  const setSets = (id, n) =>
    setExercises((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const sets = Math.max(1, Math.min(20, n));
        // Keep per-set targets in step with the number of sets.
        let perSet = e.perSet;
        if (perSet) {
          const fill = perSet[perSet.length - 1] || { reps: e.reps || '', weight: e.weight || '' };
          perSet = Array.from({ length: sets }, (_, i) => perSet[i] || { ...fill });
        }
        return { ...e, sets, perSet };
      })
    );
  const setField = (id, patch) =>
    setExercises((list) => list.map((e) => (e.id === id ? { ...e, unit: e.unit || unit, ...patch } : e)));
  const setPer = (id, i, field, value) =>
    setExercises((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const perSet = e.perSet.map((p, k) => (k === i ? { ...p, [field]: value } : p));
        return { ...e, unit: e.unit || unit, perSet };
      })
    );
  const togglePerSet = (ex) =>
    setField(ex.id, {
      perSet: ex.perSet
        ? null
        : Array.from({ length: ex.sets }, () => ({ reps: ex.reps || '', weight: ex.weight || '' })),
    });
  const cleanReps = (v) => v.replace(/[^0-9]/g, '');
  const cleanTime = (v) => v.replace(/[^0-9:]/g, '');
  const tidyTime = (v) => (parseTime(v) ? formatTime(parseTime(v)) : '');
  const cleanWeight = (v) => v.replace(/[^0-9.,]/g, '');

  const save = () => {
    if (!draft.name.trim()) return notify('Name your template', 'Give this template a name first.');
    if (!draft.exercises.length) return notify('Add an exercise', 'Templates need at least one exercise.');
    onSave({ ...draft, name: draft.name.trim() });
  };

  const remove = async () => {
    if (await confirm('Delete template?', draft.name, { confirmText: 'Delete', destructive: true })) {
      onDelete(draft.id);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>{isNew ? 'New Template' : 'Edit Template'}</Text>
          <Pressable onPress={save} hitSlop={12}>
            <Text style={styles.save}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
            placeholder="Template name (e.g. Push Day)"
            placeholderTextColor={colors.muted}
            style={styles.nameInput}
          />
          <TextInput
            value={draft.notes}
            onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
            placeholder="Notes (optional)"
            placeholderTextColor={colors.muted}
            style={styles.notesInput}
            multiline
          />

          {draft.exercises.map((ex, i) => {
            const g = groups[i];
            const isLast = i === draft.exercises.length - 1;
            return (
            <View
              key={ex.id}
              style={[
                styles.exBlock,
                g && { borderLeftWidth: 4, borderLeftColor: g.color },
                g && g.pos !== 'last' && { marginBottom: 2 },
              ]}
            >
            {g && g.pos === 'first' && (
              <Text style={[styles.supersetLabel, { color: g.color }]}>SUPERSET {g.letter}</Text>
            )}
            <View style={styles.exRow}>
              <Text style={[styles.exName, { flex: 1 }]}>{ex.name}</Text>
              <Pressable
                style={styles.iconBtn}
                disabled={i === 0}
                hitSlop={6}
                onPress={() =>
                  setExercises((list) => {
                    let next = [...list];
                    const same = list[i].supersetId && list[i].supersetId === list[i - 1].supersetId;
                    if (!same && list[i].supersetId) next = unlink(next, i);
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    return next;
                  })
                }
              >
                <Text style={[styles.iconText, i === 0 && { opacity: 0.3 }]}>↑</Text>
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                disabled={isLast}
                hitSlop={6}
                onPress={() =>
                  setExercises((list) => {
                    let next = [...list];
                    const same = list[i].supersetId && list[i].supersetId === list[i + 1].supersetId;
                    if (!same && list[i].supersetId) next = unlink(next, i);
                    [next[i], next[i + 1]] = [next[i + 1], next[i]];
                    return next;
                  })
                }
              >
                <Text style={[styles.iconText, isLast && { opacity: 0.3 }]}>↓</Text>
              </Pressable>
              <Pressable
                style={styles.iconBtn}
                hitSlop={6}
                onPress={() => setExercises((list) => list.filter((e) => e.id !== ex.id))}
              >
                <Text style={[styles.iconText, { color: colors.danger }]}>×</Text>
              </Pressable>
            </View>

            <View style={styles.setsRow}>
              <Text style={styles.setsLabel}>Sets</Text>
              <Pressable style={styles.step} onPress={() => setSets(ex.id, ex.sets - 1)} hitSlop={4}>
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <TextInput
                value={String(ex.sets)}
                onChangeText={(v) => {
                  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
                  if (Number.isFinite(n)) setSets(ex.id, n);
                }}
                keyboardType="number-pad"
                selectTextOnFocus
                maxLength={2}
                style={styles.setsInput}
              />
              <Pressable style={styles.step} onPress={() => setSets(ex.id, ex.sets + 1)} hitSlop={4}>
                <Text style={styles.stepText}>+</Text>
              </Pressable>
              <View style={styles.quickSets}>
                {[3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setSets(ex.id, n)}
                    style={[styles.quick, ex.sets === n && styles.quickOn]}
                  >
                    <Text style={[styles.quickText, ex.sets === n && { color: '#fff' }]}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {(() => {
              const { kind, distUnit } = kindFor(ex.name);
              if (kind === 'weight_reps') return null;
              return (
                <>
                  <Text style={styles.kindNote}>Tracked by {KINDS[kind].label.toLowerCase()} · change with ⚙ during a workout</Text>
                  {hasField(kind, 'time') && (
                    <View style={styles.setsRow}>
                      <Text style={styles.setsLabel}>Time</Text>
                      <TextInput
                        value={ex.time || ''}
                        onChangeText={(v) => setField(ex.id, { time: cleanTime(v) })}
                        onEndEditing={() => setField(ex.id, { time: tidyTime(ex.time) })}
                        keyboardType="numbers-and-punctuation"
                        placeholder="0:00"
                        placeholderTextColor={colors.muted}
                        selectTextOnFocus
                        maxLength={8}
                        style={[styles.targetInput, { width: 72 }]}
                      />
                      <View style={styles.quickSets}>
                        {['0:30', '1:00', '2:00', '5:00'].map((t) => (
                          <Pressable
                            key={t}
                            onPress={() => setField(ex.id, { time: ex.time === t ? '' : t })}
                            style={[styles.quickWide, ex.time === t && styles.quickOn]}
                          >
                            <Text style={[styles.quickText, ex.time === t && { color: '#fff' }]}>{t}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                  {hasField(kind, 'distance') && (
                    <View style={styles.setsRow}>
                      <Text style={styles.setsLabel}>Dist.</Text>
                      <TextInput
                        value={ex.distance || ''}
                        onChangeText={(v) => setField(ex.id, { distance: cleanWeight(v) })}
                        keyboardType="decimal-pad"
                        placeholder="–"
                        placeholderTextColor={colors.muted}
                        selectTextOnFocus
                        maxLength={7}
                        style={[styles.targetInput, { width: 72 }]}
                      />
                      <Text style={styles.unitText}>{distUnit}</Text>
                    </View>
                  )}
                  {hasField(kind, 'weight') && (
                    <View style={styles.setsRow}>
                      <Text style={styles.setsLabel}>Weight</Text>
                      <TextInput
                        value={ex.weight || ''}
                        onChangeText={(v) => setField(ex.id, { weight: cleanWeight(v) })}
                        keyboardType="decimal-pad"
                        placeholder="last"
                        placeholderTextColor={colors.muted}
                        selectTextOnFocus
                        maxLength={6}
                        style={[styles.targetInput, { width: 72 }]}
                      />
                      <Text style={styles.unitText}>{ex.unit || unit}</Text>
                      <Text style={styles.targetHint}>blank = last time’s weight</Text>
                    </View>
                  )}
                </>
              );
            })()}

            {kindFor(ex.name).kind !== 'weight_reps' ? null : !ex.perSet ? (
              <>
                <View style={styles.setsRow}>
                  <Text style={styles.setsLabel}>Reps</Text>
                  <TextInput
                    value={ex.reps || ''}
                    onChangeText={(v) => setField(ex.id, { reps: cleanReps(v) })}
                    keyboardType="number-pad"
                    placeholder="–"
                    placeholderTextColor={colors.muted}
                    selectTextOnFocus
                    maxLength={3}
                    style={styles.targetInput}
                  />
                  <View style={styles.quickSets}>
                    {[5, 8, 10, 12, 15].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setField(ex.id, { reps: ex.reps === String(n) ? '' : String(n) })}
                        style={[styles.quick, ex.reps === String(n) && styles.quickOn]}
                      >
                        <Text style={[styles.quickText, ex.reps === String(n) && { color: '#fff' }]}>{n}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={styles.setsRow}>
                  <Text style={styles.setsLabel}>Weight</Text>
                  <TextInput
                    value={ex.weight || ''}
                    onChangeText={(v) => setField(ex.id, { weight: cleanWeight(v) })}
                    keyboardType="decimal-pad"
                    placeholder="last"
                    placeholderTextColor={colors.muted}
                    selectTextOnFocus
                    maxLength={6}
                    style={[styles.targetInput, { width: 72 }]}
                  />
                  <Text style={styles.unitText}>{ex.unit || unit}</Text>
                  <Text style={styles.targetHint}>blank = last time’s weight</Text>
                </View>
              </>
            ) : (
              <View style={styles.perSetBox}>
                <View style={styles.perSetHead}>
                  <Text style={[styles.perSetHeadText, { width: 44 }]}>SET</Text>
                  <Text style={[styles.perSetHeadText, { width: 64 }]}>REPS</Text>
                  <Text style={[styles.perSetHeadText, { width: 84 }]}>{(ex.unit || unit).toUpperCase()}</Text>
                </View>
                {ex.perSet.map((p, k) => (
                  <View key={k} style={styles.perSetRow}>
                    <Text style={[styles.perSetNum, { width: 44 }]}>{k + 1}</Text>
                    <TextInput
                      value={p.reps}
                      onChangeText={(v) => setPer(ex.id, k, 'reps', cleanReps(v))}
                      keyboardType="number-pad"
                      placeholder="–"
                      placeholderTextColor={colors.muted}
                      selectTextOnFocus
                      maxLength={3}
                      style={[styles.targetInput, { width: 56, marginLeft: 0, marginRight: 8 }]}
                    />
                    <TextInput
                      value={p.weight}
                      onChangeText={(v) => setPer(ex.id, k, 'weight', cleanWeight(v))}
                      keyboardType="decimal-pad"
                      placeholder="last"
                      placeholderTextColor={colors.muted}
                      selectTextOnFocus
                      maxLength={6}
                      style={[styles.targetInput, { width: 76, marginLeft: 0 }]}
                    />
                  </View>
                ))}
              </View>
            )}
            {kindFor(ex.name).kind === 'weight_reps' && (
            <Pressable onPress={() => togglePerSet(ex)} hitSlop={6} style={{ marginTop: spacing.sm }}>
              <Text style={styles.perSetToggle}>
                {ex.perSet ? '↺ Use the same reps & weight for every set' : '⋯ Set each set separately (e.g. 12 / 10 / 8)'}
              </Text>
            </Pressable>
            )}

            <View style={styles.chipRow}>
              {g && g.pos !== 'last' ? (
                <View style={[styles.chip, { opacity: 0.7 }]}>
                  <Text style={styles.chipText}>⏱ No rest → next</Text>
                </View>
              ) : (
                <Pressable style={styles.chip} onPress={() => setRestPickerFor(ex.id)}>
                  <Text style={styles.chipText}>
                    ⏱ {g ? 'Round rest ' : 'Rest '}
                    {formatRest(restOf(ex))}
                    {ex.restSeconds == null ? ' (default)' : ''}
                  </Text>
                </Pressable>
              )}
              {g && (
                <Pressable style={styles.chip} onPress={() => setExercises((l) => unlink(l, i))}>
                  <Text style={[styles.chipText, { color: g.color }]}>⛓ Unlink</Text>
                </Pressable>
              )}
              {!isLast && (!g || g.pos === 'last') && (
                <Pressable style={styles.chip} onPress={() => setExercises((l) => linkWithNext(l, i))}>
                  <Text style={styles.chipText}>⛓ Superset with next</Text>
                </Pressable>
              )}
            </View>
            </View>
            );
          })}

          <Pressable style={styles.addBtn} onPress={() => setPickerOpen(true)}>
            <Text style={styles.addText}>+ Add Exercise</Text>
          </Pressable>

          {!isNew && (
            <Pressable style={styles.deleteBtn} onPress={remove}>
              <Text style={styles.deleteText}>Delete Template</Text>
            </Pressable>
          )}
        </ScrollView>

        <RestPicker
          visible={!!restPickerFor}
          title="Rest time"
          value={draft.exercises.find((e) => e.id === restPickerFor)?.restSeconds ?? null}
          defaultSeconds={defaultRestSeconds}
          onPick={(v) => {
            setExercises((l) => l.map((e) => (e.id === restPickerFor ? { ...e, restSeconds: v } : e)));
            setRestPickerFor(null);
          }}
          onClose={() => setRestPickerFor(null)}
        />

        <ExercisePicker
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(name) => {
            setPickerOpen(false);
            setExercises((list) => [...list, { id: uid(), name, sets: 3 }]);
          }}
          exerciseList={exerciseList}
          onCreateCustom={onCreateCustom}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cancel: { color: colors.muted, fontSize: 16 },
  save: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
  scroll: { padding: spacing.lg, paddingBottom: 80 },
  nameInput: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  notesInput: { color: colors.text, fontSize: 14, marginBottom: spacing.lg },
  exBlock: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  exRow: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 2 },
  iconText: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  setsRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  setsLabel: { color: colors.muted, fontSize: 14, fontWeight: '600', width: 54 },
  setsInput: {
    width: 44,
    height: 34,
    marginLeft: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickSets: { flexDirection: 'row', marginLeft: 'auto' },
  targetInput: {
    width: 52,
    height: 34,
    marginLeft: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  unitText: { color: colors.muted, fontSize: 13, marginLeft: 6 },
  targetHint: { color: colors.muted, fontSize: 11, marginLeft: 'auto' },
  perSetBox: { marginTop: spacing.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm },
  perSetHead: { flexDirection: 'row', marginBottom: 4 },
  perSetHeadText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  perSetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  perSetNum: { color: colors.text, fontSize: 15, fontWeight: '700' },
  perSetToggle: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  kindNote: { color: colors.muted, fontSize: 12, marginTop: spacing.sm },
  quickWide: {
    paddingHorizontal: 8,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  quick: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  quickOn: { backgroundColor: colors.accent },
  quickText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  supersetLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  chip: {
    backgroundColor: colors.cardAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  exName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  exSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  step: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  stepText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  addBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.accentDim,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addText: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  deleteBtn: { marginTop: spacing.xl, alignItems: 'center', padding: spacing.md },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
