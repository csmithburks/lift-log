import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { confirm } from './dialogs';
import { supersetInfo } from './supersets';
import { SET_TYPE_COLOR, colors, radius, spacing } from './theme';
import {
  bestSet,
  formatDate,
  formatSet,
  formatShortDuration,
  formatVolume,
  setLabels,
  workoutSetCount,
  workoutVolume,
} from './utils';

export default function HistoryScreen({ history, unit, onDelete, onRepeat, canRepeat }) {
  const [expanded, setExpanded] = useState(null);

  if (!history.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No workouts yet</Text>
        <Text style={styles.emptySub}>
          Finished workouts show up here. You can also import your Strong history from the Profile tab.
        </Text>
      </View>
    );
  }

  const del = async (w) => {
    if (await confirm('Delete workout?', `${w.name} — ${formatDate(w.startedAt)}`, { confirmText: 'Delete', destructive: true })) {
      onDelete(w.id);
    }
  };

  return (
    <FlatList
      data={history}
      keyExtractor={(w) => w.id}
      contentContainerStyle={styles.list}
      initialNumToRender={8}
      ListHeaderComponent={
        <Text style={styles.header}>
          History <Text style={styles.headerCount}>{history.length}</Text>
        </Text>
      }
      renderItem={({ item: w }) => {
        const open = expanded === w.id;
        const u = w.unit || unit;
        const prCount = (w.prs || []).length;
        const groups = supersetInfo(w.exercises);
        return (
          <Pressable style={styles.card} onPress={() => setExpanded(open ? null : w.id)} onLongPress={() => del(w)}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>
                {w.name}
              </Text>
              {prCount > 0 && <Text style={styles.pr}>🏆 {prCount}</Text>}
            </View>
            <Text style={styles.date}>{formatDate(w.startedAt)}</Text>

            <View style={styles.stats}>
              <Stat label="Time" value={formatShortDuration((w.finishedAt || w.startedAt) - w.startedAt)} />
              <Stat label="Volume" value={`${formatVolume(workoutVolume(w))} ${u}`} />
              <Stat label="Sets" value={String(workoutSetCount(w))} />
            </View>

            {!open && (
              <View style={styles.tableHead}>
                <Text style={styles.headText}>Exercise</Text>
                <Text style={styles.headText}>Best set</Text>
              </View>
            )}

            {w.exercises.map((ex, exIndex) => {
              const g = groups[exIndex];
              if (!open) {
                return (
                  <View key={ex.id} style={styles.summaryRow}>
                    <Text style={styles.exSummary} numberOfLines={1}>
                      {g && <Text style={{ color: g.color, fontWeight: '800' }}>{g.letter} </Text>}
                      {ex.sets.length} × {ex.name}
                    </Text>
                    <Text style={styles.best}>{formatSet(bestSet(ex.sets), u, ex.distUnit)}</Text>
                  </View>
                );
              }
              const labels = setLabels(ex.sets);
              return (
                <View key={ex.id} style={[styles.exBlock, g && { borderLeftWidth: 3, borderLeftColor: g.color, paddingLeft: 8 }]}>
                  {g && g.pos === 'first' && (
                    <Text style={{ color: g.color, fontSize: 11, fontWeight: '800', marginTop: 6 }}>SUPERSET {g.letter}</Text>
                  )}
                  <Text style={styles.exName}>{ex.name}</Text>
                  {!!ex.notes && <Text style={styles.exNote}>{ex.notes}</Text>}
                  {ex.sets.map((s, i) => (
                    <View key={s.id} style={styles.setLine}>
                      <Text style={[styles.setLabel, SET_TYPE_COLOR[s.type] && { color: SET_TYPE_COLOR[s.type] }]}>
                        {labels[i]}
                      </Text>
                      <Text style={styles.setText}>{formatSet(s, u, ex.distUnit)}</Text>
                    </View>
                  ))}
                </View>
              );
            })}

            {open && !!w.notes && <Text style={styles.workoutNote}>{w.notes}</Text>}

            {open ? (
              <View style={styles.actions}>
                {canRepeat && (
                  <Pressable style={styles.actionBtn} onPress={() => onRepeat(w)}>
                    <Text style={styles.actionText}>Repeat workout</Text>
                  </Pressable>
                )}
                <Pressable style={styles.actionBtn} onPress={() => del(w)}>
                  <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.more}>Tap for details</Text>
            )}
          </Pressable>
        );
      }}
    />
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
  emptySub: { color: colors.muted, fontSize: 15, marginTop: spacing.sm, textAlign: 'center', lineHeight: 21 },
  list: { padding: spacing.lg, paddingBottom: 120 },
  header: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.lg },
  headerCount: { color: colors.muted, fontSize: 18, fontWeight: '600' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  pr: { color: colors.gold, fontSize: 14, fontWeight: '700', marginLeft: spacing.sm },
  date: { color: colors.muted, fontSize: 13, marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: spacing.md, marginBottom: spacing.md },
  stat: { marginRight: spacing.xl },
  statValue: { color: colors.text, fontSize: 15, fontWeight: '600' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  headText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  exSummary: { color: colors.text, fontSize: 14, flex: 1, marginRight: spacing.sm },
  best: { color: colors.muted, fontSize: 14 },
  exBlock: { paddingVertical: spacing.xs },
  exName: { color: colors.accent, fontSize: 15, fontWeight: '700', marginTop: spacing.sm },
  exNote: { color: colors.muted, fontSize: 13, fontStyle: 'italic', marginTop: 2 },
  setLine: { flexDirection: 'row', marginTop: 3 },
  setLabel: { color: colors.muted, fontSize: 14, fontWeight: '700', width: 24 },
  setText: { color: colors.text, fontSize: 14 },
  workoutNote: { color: colors.muted, fontSize: 13, fontStyle: 'italic', marginTop: spacing.md },
  actions: { flexDirection: 'row', marginTop: spacing.md },
  actionBtn: {
    backgroundColor: colors.cardAlt,
    borderRadius: radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: spacing.sm,
  },
  actionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  more: { color: colors.muted, fontSize: 12, marginTop: spacing.md },
});
