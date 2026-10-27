import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { formatDuration } from '../utils';

// rest: { endsAt, total } — time is derived from endsAt, so the countdown
// stays correct even if the app is backgrounded.
export default function RestTimerBar({ rest, onAdjust, onSkip }) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest.endsAt]);

  const remaining = rest.endsAt - now;

  useEffect(() => {
    if (remaining <= 0 && !fired.current) {
      fired.current = true;
      if (Platform.OS === 'web') {
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } else {
        Vibration.vibrate([0, 300, 150, 300]);
      }
      onSkip();
    }
  }, [remaining, onSkip]);

  const pct = Math.max(0, Math.min(1, remaining / (rest.total * 1000)));

  return (
    <View style={styles.wrap}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
      <View style={styles.content}>
        <Pressable onPress={() => onAdjust(-15)} style={styles.adj} hitSlop={6}>
          <Text style={styles.adjText}>−15</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.label}>Rest</Text>
          <Text style={styles.time}>{formatDuration(Math.max(0, remaining) + 999)}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Pressable onPress={() => onAdjust(15)} style={styles.adj} hitSlop={6}>
            <Text style={styles.adjText}>+15</Text>
          </Pressable>
          <Pressable onPress={onSkip} style={[styles.adj, styles.skip]} hitSlop={6}>
            <Text style={styles.adjText}>Skip</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accentDim },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  time: { color: colors.text, fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  adj: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  skip: { marginLeft: spacing.sm },
  adjText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
