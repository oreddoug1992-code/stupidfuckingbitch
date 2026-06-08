import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConnectSheet } from "@/components/ConnectSheet";
import { Gauge } from "@/components/Gauge";
import { SensorTile } from "@/components/SensorTile";
import { useOBD } from "@/context/OBDContext";

const SENSOR_ROWS = [
  [
    { key: "coolant" as const, label: "COOLANT", unit: "°C", color: "#E91E63" },
    { key: "throttle" as const, label: "THROTTLE", unit: "%", color: "#FFB300" },
  ],
  [
    { key: "engineLoad" as const, label: "ENGINE LOAD", unit: "%", color: "#FF5722" },
    { key: "fuelLevel" as const, label: "FUEL LEVEL", unit: "%", color: "#4CAF50" },
  ],
  [
    { key: "battery" as const, label: "BATTERY", unit: "V", color: "#FFB300" },
    { key: "oilTemp" as const, label: "OIL TEMP", unit: "°C", color: "#E91E63" },
  ],
];

const SECONDARY_ROWS = [
  [
    { key: "intakeTemp" as const, label: "INTAKE TEMP", unit: "°C", color: "#00BCD4" },
    { key: "map" as const, label: "MAP", unit: "kPa", color: "#00E676" },
  ],
  [
    { key: "maf" as const, label: "MAF", unit: "g/s", color: "#9C27B0" },
    { key: "timingAdv" as const, label: "TIMING ADV.", unit: "°", color: "#E91E63" },
  ],
  [
    { key: "shortFuelTrim" as const, label: "SHORT FT", unit: "%", color: "#FF9800" },
    { key: "longFuelTrim" as const, label: "LONG FT", unit: "%", color: "#FF9800" },
  ],
  [
    { key: "o2Voltage" as const, label: "O2 SENSOR", unit: "V", color: "#26C6DA" },
    { key: "baroPressure" as const, label: "BARO", unit: "kPa", color: "#78909C" },
  ],
];

export default function DashboardScreen() {
  const { connectionState, deviceName, protocol, protocolNumber, sensorData, disconnect } = useOBD();
  const [showConnect, setShowConnect] = useState(false);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const handleConnectPress = () => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isConnected) {
      disconnect();
    } else {
      setShowConnect(true);
    }
  };

  const statusColor =
    connectionState === "demo" ? "#00BCD4" :
    connectionState === "connected" ? "#4CAF50" :
    connectionState === "connecting" ? "#FFB300" : "#555555";

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: isConnected ? "#4CAF50" : "#555" }]} />
          <View style={[styles.dot, { backgroundColor: connectionState === "connecting" ? "#FFB300" : "#333" }]} />
          <View style={[styles.dot, { backgroundColor: "#333" }]} />
          <Text style={styles.headerTitle}>Live Graph</Text>
          <Text style={styles.headerSub}>
            {isConnected ? "Real-time data" : "Connect to start graphing"}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Feather name="trending-up" size={16} color="#555" />
          <Feather name="chevron-right" size={16} color="#555" />
        </View>
      </View>

      {/* Status bar */}
      <TouchableOpacity
        style={[styles.statusBar, { borderColor: statusColor + "40" }]}
        onPress={handleConnectPress}
        activeOpacity={0.8}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.statusText}>
          {connectionState === "connecting"
            ? "Connecting to adapter..."
            : isConnected
              ? `${deviceName}  •  ${protocol || "Auto"}`
              : "Not connected — tap CONNECT to link your ELM327 adapter"}
        </Text>
        <View style={[styles.connectBtn, { borderColor: isConnected ? "#F44336" : "#00BCD4" }]}>
          <Text style={[styles.connectBtnText, { color: isConnected ? "#F44336" : "#00BCD4" }]}>
            {isConnected ? "DISCON." : "CONNECT"}
          </Text>
        </View>
      </TouchableOpacity>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Gauges */}
        <View style={styles.gaugesRow}>
          <View style={styles.gaugeCard}>
            <Gauge
              value={sensorData.rpm}
              maxValue={8000}
              label="ENGINE RPM"
              unit="RPM"
              size={158}
              color="#00BCD4"
            />
          </View>
          <View style={styles.gaugeCard}>
            <Gauge
              value={sensorData.speed}
              maxValue={200}
              label="SPEED"
              unit="km/h"
              size={158}
              color="#00BCD4"
            />
          </View>
        </View>

        {/* Primary sensors */}
        {SENSOR_ROWS.map((row, ri) => (
          <View key={ri} style={styles.tileRow}>
            {row.map((s) => (
              <SensorTile
                key={s.key}
                label={s.label}
                value={sensorData[s.key]}
                unit={s.unit}
                accentColor={s.color}
              />
            ))}
          </View>
        ))}

        {/* Section divider */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>INTAKE & AIR</Text>
          <View style={styles.sectionLine} />
        </View>

        {SECONDARY_ROWS.map((row, ri) => (
          <View key={ri} style={styles.tileRow}>
            {row.map((s) => (
              <SensorTile
                key={s.key}
                label={s.label}
                value={sensorData[s.key]}
                unit={s.unit}
                accentColor={s.color}
              />
            ))}
          </View>
        ))}

        {protocolNumber ? (
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Protocol</Text>
            <Text style={styles.protocolValue}>{protocol} (#{protocolNumber})</Text>
          </View>
        ) : null}

        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      <ConnectSheet visible={showConnect} onClose={() => setShowConnect(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#111111",
    borderRadius: 12,
    marginHorizontal: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginLeft: 4,
  },
  headerSub: { color: "#555", fontSize: 12, fontFamily: "Inter_400Regular" },
  headerRight: { flexDirection: "row", gap: 8 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111111",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    gap: 8,
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: {
    flex: 1,
    color: "#888",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  connectBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 12, paddingTop: 10, gap: 8 },
  gaugesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  gaugeCard: {
    flex: 1,
    backgroundColor: "#111111",
    borderRadius: 14,
    alignItems: "center",
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  tileRow: { flexDirection: "row", gap: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  sectionTitle: {
    color: "#555",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#1E1E1E" },
  protocolRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  protocolLabel: { color: "#555", fontSize: 11, fontFamily: "Inter_400Regular" },
  protocolValue: { color: "#00BCD4", fontSize: 11, fontFamily: "Inter_500Medium" },
});
