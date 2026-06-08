import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConnectSheet } from "@/components/ConnectSheet";
import { useOBD } from "@/context/OBDContext";

const VIN_FIELDS = [
  "Make", "Model", "Model Year", "Body Class", "Drive Type",
  "Engine Configuration", "Displacement (L)", "Fuel Type - Primary",
  "Number of Cylinders", "Transmission Style", "Plant Country",
];

export default function VehicleScreen() {
  const {
    connectionState, lookupVIN, vinResult, vinLoading,
    readIMReadiness, imReadiness, readMisfires, misfireCounters,
    readFreezeFrame, freezeFrame, readFromECU, ecuInfo,
  } = useOBD();
  const [vin, setVin] = useState("");
  const [showConnect, setShowConnect] = useState(false);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const handleVINSearch = () => {
    if (vin.length !== 17) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    lookupVIN(vin);
  };

  const handleConnectedAction = (action: () => void) => {
    if (!isConnected) { setShowConnect(true); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* VIN Lookup */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="search" size={16} color="#00BCD4" />
            <Text style={styles.sectionTitle}>VIN Lookup</Text>
            <Text style={styles.sectionBadge}>NHTSA database</Text>
          </View>
          <View style={styles.vinRow}>
            <TextInput
              style={styles.vinInput}
              value={vin}
              onChangeText={(t) => setVin(t.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
              placeholder="Enter 17-character VIN"
              placeholderTextColor="#444"
              maxLength={17}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.vinSearchBtn, vin.length !== 17 && styles.vinSearchBtnDisabled]}
              onPress={handleVINSearch}
              disabled={vin.length !== 17 || vinLoading}
              activeOpacity={0.8}
            >
              {vinLoading ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Feather name="search" size={20} color={vin.length === 17 ? "#000" : "#444"} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.vinCounter}>{vin.length}/17 characters</Text>

          {vinResult && (
            <View style={styles.vinResults}>
              {VIN_FIELDS.map((field) =>
                vinResult[field] ? (
                  <View key={field} style={styles.vinRow2}>
                    <Text style={styles.vinFieldLabel}>{field}</Text>
                    <Text style={styles.vinFieldValue}>{vinResult[field]}</Text>
                  </View>
                ) : null,
              )}
              {vinResult["Error"] && (
                <Text style={styles.vinError}>{vinResult["Error"]}</Text>
              )}
            </View>
          )}
        </View>

        {/* OBD2 Module Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="cpu" size={16} color="#00BCD4" />
            <Text style={styles.sectionTitle}>OBD2 Module Info</Text>
          </View>
          {ecuInfo ? (
            <View style={styles.infoGrid}>
              {[
                { label: "Protocol", value: ecuInfo.protocol },
                { label: "ECU Name", value: ecuInfo.ecuName },
                { label: "Calibration ID", value: ecuInfo.calId },
                { label: "CVN", value: ecuInfo.cvn },
              ].map((row) => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionDesc}>Protocol, ECU name, calibration ID, CVN</Text>
          )}
          <TouchableOpacity
            style={styles.readBtn}
            onPress={() => handleConnectedAction(readFromECU)}
            activeOpacity={0.8}
          >
            <Feather name="refresh-cw" size={14} color="#00BCD4" />
            <Text style={styles.readBtnText}>Read from ECU</Text>
          </TouchableOpacity>
        </View>

        {/* I/M Readiness */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="check-square" size={16} color="#00BCD4" />
            <Text style={styles.sectionTitle}>I/M Readiness Monitors</Text>
          </View>
          {imReadiness.length > 0 ? (
            <View style={styles.imGrid}>
              {imReadiness.map((item) => (
                <View key={item.name} style={styles.imRow}>
                  <Feather
                    name={
                      item.status === "complete" ? "check-circle" :
                      item.status === "incomplete" ? "circle" : "minus-circle"
                    }
                    size={14}
                    color={
                      item.status === "complete" ? "#4CAF50" :
                      item.status === "incomplete" ? "#FFB300" : "#444"
                    }
                  />
                  <Text style={[
                    styles.imName,
                    item.status === "not_applicable" && { color: "#444" },
                  ]}>
                    {item.name}
                  </Text>
                  <Text style={[
                    styles.imStatus,
                    {
                      color: item.status === "complete" ? "#4CAF50" :
                             item.status === "incomplete" ? "#FFB300" : "#444",
                    },
                  ]}>
                    {item.status === "complete" ? "Ready" :
                     item.status === "incomplete" ? "Not Ready" : "N/A"}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionDesc}>OBD2 drive cycle completion status — required for emissions / smog testing</Text>
          )}
          <TouchableOpacity
            style={styles.readBtn}
            onPress={() => handleConnectedAction(readIMReadiness)}
            activeOpacity={0.8}
          >
            <Feather name="check-square" size={14} color="#00BCD4" />
            <Text style={styles.readBtnText}>Read Monitors</Text>
          </TouchableOpacity>
        </View>

        {/* Misfire Counters */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="activity" size={16} color="#00BCD4" />
            <Text style={styles.sectionTitle}>Misfire Counters</Text>
          </View>
          {misfireCounters.length > 0 ? (
            <View style={styles.misfireGrid}>
              {misfireCounters.map((m) => (
                <View key={m.cylinder} style={styles.misfireItem}>
                  <Text style={styles.misfireCyl}>CYL {m.cylinder}</Text>
                  <Text style={[styles.misfireCount, { color: m.count > 0 ? "#F44336" : "#4CAF50" }]}>
                    {m.count}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionDesc}>Per-cylinder misfire event counts</Text>
          )}
          <TouchableOpacity
            style={styles.readBtn}
            onPress={() => handleConnectedAction(readMisfires)}
            activeOpacity={0.8}
          >
            <Feather name="activity" size={14} color="#00BCD4" />
            <Text style={styles.readBtnText}>Read Misfires</Text>
          </TouchableOpacity>
        </View>

        {/* Global Freeze Frame */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="camera" size={16} color="#00BCD4" />
            <Text style={styles.sectionTitle}>Global Freeze Frame</Text>
          </View>
          {freezeFrame ? (
            <View style={styles.infoGrid}>
              {[
                { label: "Trigger Code", value: freezeFrame.triggerCode },
                { label: "RPM", value: `${freezeFrame.rpm} RPM` },
                { label: "Speed", value: `${freezeFrame.speed} km/h` },
                { label: "Coolant Temp", value: `${freezeFrame.coolant}°C` },
                { label: "Throttle", value: `${freezeFrame.throttle}%` },
                { label: "Engine Load", value: `${freezeFrame.engineLoad}%` },
              ].map((row) => (
                <View key={row.label} style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{row.label}</Text>
                  <Text style={styles.infoValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.sectionDesc}>
              Sensor snapshot captured when a DTC was first stored (Mode 02 frame 0)
            </Text>
          )}
          <TouchableOpacity
            style={styles.readBtn}
            onPress={() => handleConnectedAction(readFreezeFrame)}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={14} color="#00BCD4" />
            <Text style={styles.readBtnText}>Read Freeze Frame</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      <ConnectSheet visible={showConnect} onClose={() => setShowConnect(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, gap: 12 },
  section: {
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    gap: 12,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  sectionBadge: { color: "#555", fontSize: 11, fontFamily: "Inter_400Regular" },
  sectionDesc: { color: "#555", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, textAlign: "center" },
  vinRow: { flexDirection: "row", gap: 10 },
  vinInput: {
    flex: 1,
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#252525",
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    letterSpacing: 1,
  },
  vinSearchBtn: {
    width: 48,
    height: 48,
    backgroundColor: "#00BCD4",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  vinSearchBtnDisabled: { backgroundColor: "#1C1C1C" },
  vinCounter: { color: "#444", fontSize: 11, fontFamily: "Inter_400Regular" },
  vinResults: { gap: 8 },
  vinRow2: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#1E1E1E" },
  vinFieldLabel: { color: "#888", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  vinFieldValue: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, textAlign: "right" },
  vinError: { color: "#F44336", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  readBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#00BCD430",
    borderRadius: 10,
    paddingVertical: 10,
  },
  readBtnText: { color: "#00BCD4", fontFamily: "Inter_500Medium", fontSize: 13 },
  infoGrid: { gap: 0 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
  },
  infoLabel: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular" },
  infoValue: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: "60%", textAlign: "right" },
  imGrid: { gap: 0 },
  imRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  imName: { flex: 1, color: "#CCCCCC", fontSize: 13, fontFamily: "Inter_400Regular" },
  imStatus: { fontSize: 12, fontFamily: "Inter_500Medium" },
  misfireGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  misfireItem: {
    backgroundColor: "#0D0D0D",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    minWidth: 70,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  misfireCyl: { color: "#666", fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.5 },
  misfireCount: { fontSize: 22, fontFamily: "Inter_700Bold", fontWeight: "700" as const, marginTop: 4 },
});
