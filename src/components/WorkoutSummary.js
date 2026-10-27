import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';
import {
  PR_LABEL,
  formatDate,
  formatShortDuration,
  formatVolume,
  workoutSetCount,
  workoutVolume,
} from '../utils';

export default function WorkoutSummary({ workout, unit, onClose, onSaveTemplate }) {
  if (!workout) return null;
  const prs = workout.prs || [];
  return (
    <Modal visible animationType="fade" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.big}>Workout complete</Text>
          <Text style={styles.name}>{workout.name}</Text>
          <Text style={styles.date}>{formatDate(workout.startedAt)}</Text>

          <View style={styles.stats}>
            <Stat label="Time" value={formatShortDuration(workout.finishedAt - workout.startedAt)} />
            <Stat label="Volume" value={`${formatVolume(workoutVolume(workout))} ${workout.unit || unit}`} />
            <Stat label="Sets" value={String(workoutSetCount(workout))} />
            <Stat label="PRs" value={String(prs.length)} />
          </View>

          {prs.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 New personal records</Text>
              {prs.map((pr, i) => (
                <View key={i} style={styles.prRow}>
                  <Text style={styles.prEx} numberOfLines={1}>
                    {pr.exercise}
                  </Text>
                  <Text style={styles.prVal}>
                    {PR_LABEL[pr.type]}: {pr.display || `${pr.value}${pr.type === 'maxReps' ? '' : ` ${workout.unit || unit}`}`}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.card}>
            {workout.exercises.map((ex) => (
              <Text key={ex.id} style={styles.exLine}>
                {ex.sets.length} × {ex.name}
              </Text>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {!workout.templateId && (
            <Pressable style={[styles.btn, styles.btnAlt]} onPress={onSaveTemplate}>
              <Text style={styles.btnAltText}>Save as Template</Text>
            </Pressable>
          )}
          <Pressable style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>Done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
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
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl },
  big: { color: colors.success, fontSize: 15, fontWeight: '700', textTransform: 'uppercase' },
  name: { color: colors.text, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  date: { color: colors.muted, fontSize: 14, marginTop: 2 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.xl },
  stat: { alignItems: 'flex-start' },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: { color: colors.gold, fontSize: 15, fontWeight: '700', marginBottom: spacing.sm },
  prRow: { paddingVertical: 4 },
  prEx: { color: colors.text, fontSize: 15, fontWeight: '600' },
  prVal: { color: colors.muted, fontSize: 13, marginTop: 1 },
  exLine: { color: colors.text, fontSize: 15, paddingVertical: 3 },
  footer: { padding: spacing.lg, flexDirection: 'row' },
  btn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnAlt: { backgroundColor: colors.card },
  btnAltText: { color: colors.text, fontSize: 16, fontWeight: '600' },
});
