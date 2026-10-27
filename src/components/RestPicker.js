import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { REST_OPTIONS, formatRest } from '../supersets';
import { colors, radius, spacing } from '../theme';

// Small sheet for choosing an exercise's (or superset's) rest time.
// value: null means "use the default from Profile".
export default function RestPicker({ visible, title, value, defaultSeconds, onPick, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.grid}>
            {REST_OPTIONS.map((opt) => {
              const on = opt === value || (opt === null && value == null);
              const label = opt === null ? `Default (${formatRest(defaultSeconds)})` : formatRest(opt);
              return (
                <Pressable
                  key={String(opt)}
                  onPress={() => onPick(opt)}
                  style={[styles.chip, opt === null && styles.chipWide, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xl * 1.5,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    width: '22%',
    marginRight: '3%',
    marginBottom: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
  },
  chipWide: { width: '97%' },
  chipOn: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  close: { alignItems: 'center', paddingTop: spacing.md },
  closeText: { color: colors.muted, fontSize: 15 },
});
