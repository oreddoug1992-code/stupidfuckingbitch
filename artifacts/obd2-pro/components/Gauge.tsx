import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";

interface GaugeProps {
  value: number | null;
  maxValue: number;
  label: string;
  unit: string;
  size?: number;
  color?: string;
}

const START_ANGLE = 225;
const END_ANGLE = 315;
const SWEEP = 270;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const s = polarToCartesian(cx, cy, r, startAngle);
  const e = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export function Gauge({ value, maxValue, label, unit, size = 160, color = "#00BCD4" }: GaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const trackR = size * 0.42;
  const numTicks = 25;
  const tickOuterR = size * 0.44;
  const tickInnerR = size * 0.38;
  const majorTickInnerR = size * 0.34;

  const valueFraction = value != null ? Math.min(1, Math.max(0, value / maxValue)) : 0;
  const valueEndAngle = START_ANGLE + valueFraction * SWEEP;

  const ticks = [];
  for (let i = 0; i <= numTicks; i++) {
    const angle = START_ANGLE + (i / numTicks) * SWEEP;
    const isMajor = i % 5 === 0;
    const innerR = isMajor ? majorTickInnerR : tickInnerR;
    const outer = polarToCartesian(cx, cy, tickOuterR, angle);
    const inner = polarToCartesian(cx, cy, innerR, angle);
    const tickColor = i / numTicks <= valueFraction && value != null ? color : "#333333";
    ticks.push(
      <Line
        key={i}
        x1={outer.x}
        y1={outer.y}
        x2={inner.x}
        y2={inner.y}
        stroke={tickColor}
        strokeWidth={isMajor ? 2.5 : 1.5}
        strokeLinecap="round"
      />,
    );
  }

  const displayValue = value != null ? (value >= 10 ? Math.round(value) : value.toFixed(1)) : "--";

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Path
          d={arcPath(cx, cy, trackR, START_ANGLE, END_ANGLE + SWEEP)}
          stroke="#1E1E1E"
          strokeWidth={size * 0.04}
          fill="none"
        />
        {value != null && valueFraction > 0 && (
          <Path
            d={arcPath(cx, cy, trackR, START_ANGLE, valueEndAngle)}
            stroke={color}
            strokeWidth={size * 0.04}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {ticks}
        <Circle cx={cx} cy={cy} r={size * 0.22} fill="#0D0D0D" />
      </Svg>
      <View style={[styles.centerContent, { width: size, height: size }]}>
        <Text style={[styles.value, { color: value != null ? "#FFFFFF" : "#444444", fontSize: size * 0.2 }]}>
          {displayValue}
        </Text>
        <Text style={[styles.unit, { fontSize: size * 0.09 }]}>{unit}</Text>
      </View>
      <View style={styles.labelContainer}>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  centerContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    top: 0,
    left: 0,
  },
  value: {
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    letterSpacing: -1,
  },
  unit: {
    color: "#666666",
    fontFamily: "Inter_400Regular",
    marginTop: -2,
  },
  labelContainer: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
  },
  label: {
    color: "#888888",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
