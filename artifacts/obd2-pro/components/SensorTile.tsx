import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface SensorTileProps {
  label: string;
  value: number | string | null;
  unit: string;
  accentColor: string;
}

export function SensorTile({ label, value, unit, accentColor }: SensorTileProps) {
  const displayValue =
    value === null
      ? "--"
      : typeof value === "number"
        ? value >= 100
          ? Math.round(value).toString()
          : value >= 10
            ? value.toFixed(1)
            : value.toFixed(2)
        : value;

  return (
    <View style={styles.tile}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, { color: value !== null ? "#FFFFFF" : "#404040" }]}>
          {displayValue}
        </Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: "#141414",
    borderRadius: 10,
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 74,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  accent: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "space-between",
  },
  label: {
    color: "#888888",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
    marginTop: 2,
  },
  unit: {
    color: "#555555",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
