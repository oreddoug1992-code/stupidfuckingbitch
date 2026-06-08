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
import { SettingsSheet } from "@/components/SettingsSheet";
import { SensorTile } from "@/components/SensorTile";
import { useOBD } from "@/context/OBDContext";
import { useSettings } from "@/context/SettingsContext";

export default function DashboardScreen() {
  const { connectionState, deviceName, protocol, protocolNumber, sensorData, disconnect } = useOBD();
  const { settings } = useSettings();
  const [showConnect, setShowConnect] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const isMetric = settings.unitSystem === "metric";

  // Convert values based on unit system
  const speedValue = sensorData.speed != null
    ? isMetric ? sensorData.speed : Math.round(sensorData.speed * 0.621371)
    : null;
  const coolantValue = sensorData.coolant != null
    ? isMetric ? sensorData.coolant : Math.round(sensorData.coolant * 9 / 5 + 32)
    : null;
  const oilTempValue = sensorData.oilTemp != null
    ? isMetric ? sensorData.oilTemp : Math.round(sensorData.oilTemp * 9 / 5 + 32)
    : null;
  const intakeTempValue = sensorData.intakeTemp != null
    ? isMetric ? sensorData.intakeTemp : Math.round(sensorData.intakeTemp * 9 / 5 + 32)
    : null;
  const mapValue = sensorData.map != null
    ? isMetric ? sensorData.map : parseFloat((sensorData.map * 0.145038).toFixed(1))
    : null;

  const SENSOR_ROWS = [
    [
      { label: "COOLANT", value: coolantValue, unit: isMetric ? "°C" : "°F", color: "#E91E63" },
      { label: "THROTTLE", value: sensorData.throttle, unit: "%", color: "#FFB300" },
    ],
    [
      { label: "ENGINE LOAD", value: sensorData.engineLoad, unit: "%", color: "#FF5722" },
      { label: "FUEL LEVEL", value: sensorData.fuelLevel, unit: "%", color: "#4CAF50" },
    ],
    [
      { label: "BATTERY", value: sensorData.battery, unit: "V", color: "#FFB300" },
      { label: "OIL TEMP", value: oilTempValue, unit: isMetric ? "°C" : "°F", color: "#E91E63" },
    ],
  ];

  const SECONDARY_ROWS = [
    [
      { label: "INTAKE TEMP", value: intakeTempValue, unit: isMetric ? "°C" : "°F", color: "#00BCD4" },
      { label: "MAP", value: mapValue, unit: isMetric ? "kPa" : "psi", color: "#00E676" },
    ],
    [
      { label: "MAF", value: sensorData.maf, unit: "g/s", color: "#9C27B0" },
      { label: "TIMING ADV.", value: sensorData.timingAdv, unit: "°", color: "#E91E63" },
    ],
    [
      { label: "SHORT FT", value: sensorData.shortFuelTrim, unit: "%", color: "#FF9800" },
      { label: "LONG FT", value: sensorData.longFuelTrim, unit: "%", color: "#FF9800" },
    ],
    [
      { label: "O2 SENSOR", value: sensorData.o2Voltage, unit: "V", color: "#26C6DA" },
      { label: "BARO", value: sensorData.baroPressure, unit: isMetric ? "kPa" : "psi", color: "#78909C" },
    ],
  ];

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
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowSettings(true)}
            activeOpacity={0.7}
          >
            <Feather name="settings" size={17} color="#666" />
          </TouchableOpacity>
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
              maxValue={settings.maxRpm}
              label="ENGINE RPM"
              unit="RPM"
              size={158}
              color={settings.darkGaugeAccent}
            />
          </View>
          <View style={styles.gaugeCard}>
            <Gauge
              value={speedValue}
              maxValue={settings.maxSpeed}
              label="SPEED"
              unit={isMetric ? "km/h" : "mph"}
              size={158}
              color={settings.darkGaugeAccent}
            />
          </View>
        </View>

        {/* Primary sensors */}
        {SENSOR_ROWS.map((row, ri) => (
          <View key={ri} style={styles.tileRow}>
            {row.map((s) => (
              <SensorTile
                key={s.label}
                label={s.label}
                value={s.value ?? null}
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
                key={s.label}
                label={s.label}
                value={s.value ?? null}
                unit={s.unit}
                accentColor={s.color}
              />
            ))}
          </View>
        ))}

        {settings.showProtocolInDashboard && protocolNumber ? (
          <View style={styles.protocolRow}>
            <Text style={styles.protocolLabel}>Protocol</Text>
            <Text style={styles.protocolValue}>{protocol} (#{protocolNumber})</Text>
          </View>
        ) : null}

        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      <ConnectSheet visible={showConnect} onClose={() => setShowConnect(false)} />
      <SettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
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
