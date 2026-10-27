import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { colors } from '../theme';
import { formatShortDate } from '../utils';

const PAD = { left: 44, right: 12, top: 12, bottom: 24 };

// points: [{ x: timestamp, y: number }] sorted by x.
export default function LineChart({ points, height = 180, color = colors.accent, formatY = String }) {
  const [width, setWidth] = useState(0);

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>
          {points.length ? 'Log this exercise again to see a trend.' : 'No data yet.'}
        </Text>
      </View>
    );
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const spanY = maxY - minY;
  minY = Math.max(0, minY - spanY * 0.1);
  maxY = maxY + spanY * 0.1;

  const innerW = Math.max(1, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const px = (x) => PAD.left + (maxX === minX ? innerW / 2 : ((x - minX) / (maxX - minX)) * innerW);
  const py = (y) => PAD.top + innerH - ((y - minY) / (maxY - minY)) * innerH;
  const ticks = [minY, (minY + maxY) / 2, maxY];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {ticks.map((t, i) => (
            <Line
              key={`g${i}`}
              x1={PAD.left}
              x2={width - PAD.right}
              y1={py(t)}
              y2={py(t)}
              stroke={colors.border}
              strokeWidth={1}
            />
          ))}
          {ticks.map((t, i) => (
            <SvgText
              key={`t${i}`}
              x={PAD.left - 6}
              y={py(t) + 4}
              fill={colors.muted}
              fontSize={11}
              textAnchor="end"
            >
              {formatY(t)}
            </SvgText>
          ))}
          <Polyline
            points={points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.length <= 40 &&
            points.map((p, i) => (
              <Circle key={`c${i}`} cx={px(p.x)} cy={py(p.y)} r={3} fill={color} />
            ))}
          <SvgText x={PAD.left} y={height - 6} fill={colors.muted} fontSize={11} textAnchor="start">
            {formatShortDate(minX)}
          </SvgText>
          <SvgText x={width - PAD.right} y={height - 6} fill={colors.muted} fontSize={11} textAnchor="end">
            {formatShortDate(maxX)}
          </SvgText>
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: colors.muted, fontSize: 13 },
});
