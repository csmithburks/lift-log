import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LineChart from './components/LineChart';
import { colors, radius, spacing } from './theme';
import { formatTime, kindOf, paceLabel } from './kinds';
import {
  PR_KEYS,
  PR_LABEL,
  formatRecord,
  formatDate,
  formatSet,
  formatShortDate,
  formatVolume,
  recordsFor,
  round1,
  sessionsFor,
  setLabels,
} from './utils';

// Chart options per tracking type.
const METRICS = {
  weight_reps: [
    { key: 'e1rm', label: 'Est. 1RM' },
    { key: 'heaviest', label: 'Heaviest' },
    { key: 'volume', label: 'Volume' },
    { key: 'maxReps', label: 'Best reps' },
  ],
  duration: [
    { key: 'longestTime', label: 'Longest' },
    { key: 'totalTime', label: 'Total time' },
  ],
  distance_time: [
    { key: 'longestDistance', label: 'Distance' },
    { key: 'bestPace', label: 'Pace' },
    { key: 'totalTime', label: 'Time' },
  ],
  weight_time: [
    { key: 'heaviest', label: 'Heaviest' },
    { key: 'longestTime', label: 'Longest' },
  ],
  weight_distance: [
    { key: 'heaviest', label: 'Heaviest' },
    { key: 'longestDistance', label: 'Distance' },
  ],
};
const TIME_KEYS = ['longestTime', 'totalTime', 'bestPace'];

export default function ExercisesScreen({ history, unit, exerciseList }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  // How often and how recently each exercise was done, for sorting and labels.
  const usage = useMemo(() => {
    const map = {};
    for (const w of history) {
      for (const ex of w.exercises) {
        const u = map[ex.name] || (map[ex.name] = { count: 0, last: 0 });
        u.count += 1;
        u.last = Math.max(u.last, w.startedAt);
      }
    }
    return map;
  }, [history]);

  const q = query.trim().toLowerCase();
  const list = exerciseList
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q))
    .sort((a, b) => (usage[b.name]?.last || 0) - (usage[a.name]?.last || 0) || a.name.localeCompare(b.name));

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list}
        keyExtractor={(e) => e.name}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.header}>Exercises</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises"
              placeholderTextColor={colors.muted}
              style={styles.search}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
        }
        renderItem={({ item }) => {
          const u = usage[item.name];
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.card }]}
              onPress={() => setSelected(item.name)}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowSub}>{item.muscle}</Text>
              </View>
              <Text style={styles.rowMeta}>
                {u ? `${u.count}× · ${formatShortDate(u.last)}` : 'Not done yet'}
              </Text>
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />

      <ExerciseDetail name={selected} history={history} unit={unit} onClose={() => setSelected(null)} />
    </View>
  );
}

function ExerciseDetail({ name, history, unit, onClose }) {
  const [metric, setMetric] = useState('e1rm');
  if (!name) return null;

  const sessions = sessionsFor(history, name, unit);
  const rec = recordsFor(history, name, unit);
  const kind = kindOf(rec);
  const du = rec.distUnit || 'm';
  const metrics = METRICS[kind] || METRICS.weight_reps;
  const m = metrics.some((x) => x.key === metric) ? metric : metrics[0].key;
  const points = sessions.filter((s) => s[m] > 0).map((s) => ({ x: s.date, y: s[m] }));
  const recent = [...sessions].reverse().slice(0, 30);
  const fmt = (v) =>
    TIME_KEYS.includes(m) ? formatTime(v) : m === 'maxReps' ? String(Math.round(v)) : formatVolume(v);
  const chartUnit =
    m === 'maxReps' ? 'reps' : m === 'bestPace' ? `pace ${paceLabel(du)} (lower is faster)` : TIME_KEYS.includes(m) ? 'time' : m === 'longestDistance' ? du : unit;
  const recKeys = [...new Set([...(PR_KEYS[kind] || []), ...(kind === 'weight_reps' ? ['maxReps'] : [])])];

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.modalHeader}>
          <View style={{ width: 52 }} />
          <Text style={styles.modalTitle} numberOfLines={1}>
            {name}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.detailScroll}>
          {!sessions.length ? (
            <Text style={styles.emptyText}>Log this exercise to see charts and records.</Text>
          ) : (
            <>
              <View style={styles.chips}>
                {metrics.map((x) => (
                  <Pressable
                    key={x.key}
                    onPress={() => setMetric(x.key)}
                    style={[styles.chip, m === x.key && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, m === x.key && styles.chipTextOn]}>{x.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.card}>
                <LineChart points={points} formatY={fmt} />
                <Text style={styles.chartNote}>
                  {chartUnit} · warm-ups excluded
                </Text>
              </View>

              <Text style={styles.section}>Personal records</Text>
              <View style={styles.card}>
                {recKeys.map((k) =>
                  rec[k] ? (
                    <View key={k} style={styles.recRow}>
                      <Text style={styles.recLabel}>{PR_LABEL[k]}</Text>
                      <Text style={styles.recValue}>
                        {formatRecord(k, rec[k].value, unit, du)}
                        <Text style={styles.recDate}>  {formatShortDate(rec[k].date)}</Text>
                      </Text>
                    </View>
                  ) : null
                )}
                <View style={styles.recRow}>
                  <Text style={styles.recLabel}>Lifetime</Text>
                  <Text style={styles.recValue}>
                    {rec.sessions} sessions ·{' '}
                    {kind === 'weight_reps'
                      ? `${formatVolume(rec.totalVolume)} ${unit}`
                      : [rec.totalDistance > 0 ? `${round1(rec.totalDistance).toLocaleString()} ${du}` : null, rec.totalTime > 0 ? formatTime(rec.totalTime) : null]
                          .filter(Boolean)
                          .join(' · ')}
                  </Text>
                </View>
              </View>

              <Text style={styles.section}>History</Text>
              {recent.map((s) => {
                const labels = setLabels(s.sets);
                return (
                  <View key={s.workoutId} style={styles.card}>
                    <Text style={styles.histName}>{s.workoutName}</Text>
                    <Text style={styles.histDate}>{formatDate(s.date)}</Text>
                    {s.sets.map((set, i) => (
                      <Text key={set.id} style={styles.histSet}>
                        {labels[i]}.  {formatSet(set, s.unit, s.distUnit)}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  header: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowName: { color: colors.text, fontSize: 16 },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  rowMeta: { color: colors.muted, fontSize: 13, marginLeft: spacing.sm },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },

  container: { flex: 1, backgroundColor: colors.bg },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  done: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  detailScroll: { padding: spacing.lg, paddingBottom: 60 },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center', marginTop: spacing.xl },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.card,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  chartNote: { color: colors.muted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  section: { color: colors.text, fontSize: 18, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  recRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  recLabel: { color: colors.muted, fontSize: 14 },
  recValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  recDate: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  histName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  histDate: { color: colors.muted, fontSize: 12, marginBottom: spacing.xs },
  histSet: { color: colors.text, fontSize: 14, marginTop: 2 },
});
