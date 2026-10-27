import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import { formatShortDate } from '../utils';

// buckets: [{ start: timestamp, count }]
export default function WeeklyBars({ buckets, height = 110 }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <View>
      <View style={[styles.row, { height }]}>
        {buckets.map((b, i) => {
          const last = i === buckets.length - 1;
          return (
            <View key={b.start} style={styles.col}>
              {b.count > 0 && <Text style={styles.count}>{b.count}</Text>}
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(3, (b.count / max) * (height - 20)),
                    backgroundColor: b.count ? (last ? colors.accent : colors.accentDim) : colors.border,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{formatShortDate(buckets[0].start)}</Text>
        <Text style={styles.label}>This week</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', marginHorizontal: 2 },
  bar: { width: '100%', borderRadius: radius.sm / 2 },
  count: { color: colors.muted, fontSize: 10, marginBottom: 2 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  label: { color: colors.muted, fontSize: 11 },
});
