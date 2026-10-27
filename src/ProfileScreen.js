import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import WeeklyBars from './components/WeeklyBars';
import { confirm, notify } from './dialogs';
import { exportWorkoutCSV, importWorkoutCSV } from './csv';
import { pickTextFile, shareTextFile } from './files';
import { colors, radius, spacing } from './theme';
import { convert, formatVolume, startOfWeek, workoutVolume, workoutsPerWeek } from './utils';

const REST_CHOICES = [0, 60, 90, 120, 180, 240];
const restLabel = (s) => (s === 0 ? 'Off' : s % 60 === 0 ? `${s / 60}:00` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`);

export default function ProfileScreen({
  history,
  templates,
  customExercises,
  settings,
  onChangeSettings,
  onImportWorkouts,
  onRestoreBackup,
  onClearAll,
}) {
  const [busy, setBusy] = useState(false);
  const { unit, restSeconds } = settings;

  const totalVolume = history.reduce((sum, w) => sum + convert(workoutVolume(w), w.unit || unit, unit), 0);
  const thisWeek = history.filter((w) => w.startedAt >= startOfWeek(Date.now())).length;
  const stamp = new Date().toISOString().slice(0, 10);

  const doImport = async () => {
    try {
      const file = await pickTextFile();
      if (!file) return;
      setBusy(true);
      const text = file.text.trim();
      if (text.startsWith('{')) {
        const data = JSON.parse(text);
        if (data.app !== 'liftlog') throw new Error('This JSON file is not a Lift Log backup.');
        const result = onRestoreBackup(data);
        notify('Backup restored', `Added ${result.added} workout${result.added === 1 ? '' : 's'} and ${result.templates} template${result.templates === 1 ? '' : 's'}.`);
      } else {
        const { workouts, skippedRows } = importWorkoutCSV(text, unit);
        if (!workouts.length) throw new Error('No workouts with reps were found in that file.');
        const added = onImportWorkouts(workouts);
        const dupes = workouts.length - added;
        notify(
          'Import complete',
          `Imported ${added} workout${added === 1 ? '' : 's'}.` +
            (dupes ? ` Skipped ${dupes} already in your history.` : '') +
            (skippedRows ? ` Skipped ${skippedRows} empty rows.` : '')
        );
      }
    } catch (e) {
      notify('Import failed', e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const doExportCSV = async () => {
    if (!history.length) return notify('Nothing to export', 'Log a workout first.');
    try {
      await shareTextFile(`liftlog-workouts-${stamp}.csv`, exportWorkoutCSV(history, unit), 'text/csv');
    } catch (e) {
      notify('Export failed', e?.message || String(e));
    }
  };

  const doBackup = async () => {
    const data = {
      app: 'liftlog',
      version: 1,
      exportedAt: new Date().toISOString(),
      settings,
      history,
      templates,
      customExercises,
    };
    try {
      await shareTextFile(`liftlog-backup-${stamp}.json`, JSON.stringify(data), 'application/json');
    } catch (e) {
      notify('Backup failed', e?.message || String(e));
    }
  };

  const doClear = async () => {
    const ok = await confirm(
      'Delete all data?',
      'This removes every workout, template and setting from this device. Export a backup first if you might want it back.',
      { confirmText: 'Delete everything', destructive: true }
    );
    if (ok) onClearAll();
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.header}>Profile</Text>

      <View style={styles.statsRow}>
        <Stat label="Workouts" value={String(history.length)} />
        <Stat label="This week" value={String(thisWeek)} />
        <Stat label={`Total ${unit}`} value={formatVolume(totalVolume)} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Workouts per week</Text>
        <WeeklyBars buckets={workoutsPerWeek(history, 12)} />
      </View>

      <Text style={styles.section}>Settings</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Weight unit</Text>
        <View style={styles.chips}>
          {['lb', 'kg'].map((u) => (
            <Chip key={u} label={u} on={unit === u} onPress={() => onChangeSettings({ unit: u })} />
          ))}
        </View>
        <Text style={styles.help}>
          Past workouts keep the unit they were logged in. Charts and records convert automatically.
        </Text>

        <Text style={[styles.label, { marginTop: spacing.lg }]}>Rest timer after each set</Text>
        <View style={styles.chips}>
          {REST_CHOICES.map((s) => (
            <Chip key={s} label={restLabel(s)} on={restSeconds === s} onPress={() => onChangeSettings({ restSeconds: s })} />
          ))}
        </View>
      </View>

      <Text style={styles.section}>Your data</Text>
      <View style={styles.card}>
        <Row title="Import from Strong" sub="Strong → Settings → Export Data, then pick the CSV here. Lift Log backups work too." onPress={doImport} />
        <Row title="Export workouts (CSV)" sub="Opens in Excel, Numbers or Google Sheets." onPress={doExportCSV} />
        <Row title="Back up everything (JSON)" sub="Workouts, templates and settings. Restore with Import." onPress={doBackup} last />
      </View>
      <Text style={styles.note}>
        Your data lives only on this {Platform.OS === 'web' ? 'phone, in this home-screen app' : 'device'}. Back it
        up now and then — save the file to iCloud Drive or email it to yourself.
      </Text>

      <Pressable style={styles.danger} onPress={doClear}>
        <Text style={styles.dangerText}>Delete all data</Text>
      </Pressable>

      {busy && (
        <View style={styles.busy}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </ScrollView>
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

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function Row({ title, sub, onPress, last }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: 120 },
  header: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', marginBottom: spacing.lg },
  stat: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, marginRight: spacing.sm },
  statValue: { color: colors.text, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  section: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: spacing.lg, marginBottom: spacing.md },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: spacing.sm },
  help: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.cardAlt,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  chev: { color: colors.muted, fontSize: 24, marginLeft: spacing.sm },
  note: { color: colors.muted, fontSize: 12, lineHeight: 17, marginBottom: spacing.xl },
  danger: { alignItems: 'center', padding: spacing.md },
  dangerText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  busy: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
