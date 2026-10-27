import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

// exerciseList: [{ name, muscle }] already merged (built-in + custom + history).
export default function ExercisePicker({ visible, onClose, onPick, exerciseList, onCreateCustom }) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const filtered = q
    ? exerciseList.filter(
        (e) => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)
      )
    : exerciseList;
  const exactMatch = exerciseList.some((e) => e.name.toLowerCase() === q);

  const close = () => {
    setQuery('');
    onClose();
  };

  const pick = (name) => {
    setQuery('');
    onPick(name);
  };

  const createCustom = () => {
    const name = query.trim();
    if (!name) return;
    onCreateCustom({ name, muscle: 'Custom' });
    pick(name);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={close} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Add Exercise</Text>
          <View style={{ width: 52 }} />
        </View>

        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search or type a new exercise"
          placeholderTextColor={colors.muted}
          style={styles.search}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        {q.length > 0 && !exactMatch && (
          <Pressable style={styles.createRow} onPress={createCustom}>
            <Text style={styles.createText}>+ Create "{query.trim()}"</Text>
          </Pressable>
        )}

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => pick(item.name)}
            >
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMuscle}>{item.muscle}</Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
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
  cancel: { color: colors.accent, fontSize: 16 },
  title: { color: colors.text, fontSize: 17, fontWeight: '600' },
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
  createRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.accentDim,
  },
  createText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  row: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  rowPressed: { backgroundColor: colors.card },
  rowName: { color: colors.text, fontSize: 16 },
  rowMuscle: { color: colors.muted, fontSize: 13, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
});
