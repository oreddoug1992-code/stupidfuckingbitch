import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConnectSheet } from "@/components/ConnectSheet";
import { useOBD } from "@/context/OBDContext";

type BiDiCategory =
  | "All"
  | "Cooling"
  | "Fuel System"
  | "Emissions"
  | "Ignition"
  | "Injection"
  | "Suspension"
  | "Transmission";

interface BiDiTest {
  name: string;
  description: string;
  category: BiDiCategory;
  caution?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  Cooling: "#2196F3",
  "Fuel System": "#FF9800",
  Emissions: "#4CAF50",
  Ignition: "#F44336",
  Injection: "#9C27B0",
  Suspension: "#607D8B",
  Transmission: "#FF5722",
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Cooling: "wind",
  "Fuel System": "droplet",
  Emissions: "cloud",
  Ignition: "zap",
  Injection: "activity",
  Suspension: "sliders",
  Transmission: "settings",
};

const BIDI_TESTS: BiDiTest[] = [
  { name: "Cooling Fan Low", description: "Activate radiator cooling fan at low speed", category: "Cooling" },
  { name: "Cooling Fan High", description: "Activate radiator cooling fan at high speed", category: "Cooling" },
  { name: "A/C Compressor", description: "Activate A/C compressor clutch", category: "Cooling" },
  { name: "Fuel Pump", description: "Activate fuel pump relay for pressure test", category: "Fuel System" },
  { name: "EVAP Purge Valve", description: "Open EVAP purge solenoid valve", category: "Emissions" },
  { name: "EGR Valve", description: "Open EGR valve to check operation", category: "Emissions" },
  { name: "Canister Vent Valve", description: "Close EVAP canister vent valve for leak test", category: "Emissions" },
  { name: "Secondary Air Pump", description: "Activate secondary air injection pump", category: "Emissions" },
  { name: "Idle Air Control", description: "Drive IAC motor to test idle control", category: "Fuel System" },
  { name: "VVT Solenoid", description: "Activate variable valve timing solenoid", category: "Ignition" },
  { name: "Starter Relay", description: "Activate starter relay (short pulse only)", category: "Ignition", caution: true },
  { name: "Injector 1 Test", description: "Perform balance test on injector cylinder 1", category: "Injection", caution: true },
  { name: "Injector 2 Test", description: "Perform balance test on injector cylinder 2", category: "Injection", caution: true },
  { name: "Injector 3 Test", description: "Perform balance test on injector cylinder 3", category: "Injection", caution: true },
  { name: "Injector 4 Test", description: "Perform balance test on injector cylinder 4", category: "Injection", caution: true },
  { name: "Injector 5 Test", description: "Perform balance test on injector cylinder 5", category: "Injection", caution: true },
  { name: "Injector 6 Test", description: "Perform balance test on injector cylinder 6", category: "Injection", caution: true },
  { name: "Injector 7 Test", description: "Perform balance test on injector cylinder 7", category: "Injection", caution: true },
  { name: "Injector 8 Test", description: "Perform balance test on injector cylinder 8", category: "Injection", caution: true },
  { name: "ABS Pump Motor", description: "Test ABS hydraulic pump operation", category: "Suspension", caution: true },
  { name: "TCC Solenoid", description: "Apply torque converter clutch solenoid", category: "Transmission" },
  { name: "Shift Solenoid A", description: "Actuate transmission shift solenoid A", category: "Transmission", caution: true },
  { name: "Shift Solenoid B", description: "Actuate transmission shift solenoid B", category: "Transmission", caution: true },
];

const CATEGORIES: BiDiCategory[] = ["All", "Cooling", "Fuel System", "Emissions", "Ignition", "Injection", "Suspension", "Transmission"];

export default function BiDiScreen() {
  const { connectionState, runBiDiTest } = useOBD();
  const [activeCategory, setActiveCategory] = useState<BiDiCategory>("All");
  const [showConnect, setShowConnect] = useState(false);
  const [runningTest, setRunningTest] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ name: string; success: boolean } | null>(null);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const filtered =
    activeCategory === "All" ? BIDI_TESTS : BIDI_TESTS.filter((t) => t.category === activeCategory);

  const handleRun = async (test: BiDiTest) => {
    if (!isConnected) {
      setShowConnect(true);
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunningTest(test.name);
    const result = await runBiDiTest(test.name);
    setRunningTest(null);
    setResultModal({ name: test.name, success: result === "SUCCESS" });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterPill,
              activeCategory === cat && styles.filterPillActive,
              activeCategory === cat && cat !== "All" && { borderColor: CATEGORY_COLORS[cat] },
            ]}
            onPress={() => setActiveCategory(cat)}
          >
            {cat !== "All" && (
              <Feather
                name={CATEGORY_ICONS[cat]}
                size={12}
                color={activeCategory === cat ? (CATEGORY_COLORS[cat] ?? "#00BCD4") : "#555"}
              />
            )}
            <Text
              style={[
                styles.filterPillText,
                activeCategory === cat && { color: cat === "All" ? "#00BCD4" : CATEGORY_COLORS[cat] },
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Connection banner */}
        <TouchableOpacity
          style={styles.banner}
          onPress={() => !isConnected && setShowConnect(true)}
          activeOpacity={0.8}
        >
          <Feather name="bluetooth" size={14} color={isConnected ? "#00BCD4" : "#555"} />
          <Text style={[styles.bannerText, { color: isConnected ? "#00BCD4" : "#555" }]}>
            {isConnected ? "Connected — tap RUN to activate actuators" : "Connect to ELM327 to run actuator tests"}
          </Text>
        </TouchableOpacity>

        {filtered.map((test) => {
          const catColor = CATEGORY_COLORS[test.category] ?? "#00BCD4";
          const isRunning = runningTest === test.name;
          return (
            <View key={test.name} style={styles.card}>
              <View style={[styles.cardIcon, { backgroundColor: catColor + "20" }]}>
                <Feather name={CATEGORY_ICONS[test.category]} size={18} color={catColor} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{test.name}</Text>
                  {test.caution && (
                    <Feather name="alert-circle" size={14} color="#F44336" />
                  )}
                </View>
                <Text style={styles.cardDesc}>{test.description}</Text>
                <Text style={[styles.cardCategory, { color: catColor }]}>{test.category}</Text>
              </View>
              <TouchableOpacity
                style={[styles.runBtn, isRunning && styles.runBtnActive]}
                onPress={() => handleRun(test)}
                disabled={isRunning}
                activeOpacity={0.8}
              >
                {isRunning ? (
                  <Text style={[styles.runBtnText, { color: "#FFB300" }]}>...</Text>
                ) : (
                  <>
                    <Feather name="play" size={12} color="#00BCD4" />
                    <Text style={styles.runBtnText}>RUN</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })}
        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      <Modal visible={!!resultModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Feather
              name={resultModal?.success ? "check-circle" : "x-circle"}
              size={48}
              color={resultModal?.success ? "#4CAF50" : "#F44336"}
            />
            <Text style={styles.modalTitle}>{resultModal?.success ? "Test Complete" : "Test Failed"}</Text>
            <Text style={styles.modalName}>{resultModal?.name}</Text>
            <Text style={styles.modalSub}>
              {resultModal?.success ? "Actuator responded successfully." : "No response. Check connection and try again."}
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setResultModal(null)}>
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ConnectSheet visible={showConnect} onClose={() => setShowConnect(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  filterScroll: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  filterContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#252525",
    backgroundColor: "#111111",
  },
  filterPillActive: { borderColor: "#00BCD4", backgroundColor: "#00BCD415" },
  filterPillText: { color: "#555", fontSize: 12, fontFamily: "Inter_500Medium" },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, gap: 10 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#141414",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  bannerText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  card: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1, gap: 3 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  cardDesc: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular" },
  cardCategory: { fontSize: 11, fontFamily: "Inter_500Medium", marginTop: 2 },
  runBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#00BCD460",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minWidth: 60,
    justifyContent: "center",
  },
  runBtnActive: { borderColor: "#FFB30060" },
  runBtnText: { color: "#00BCD4", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#141414",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 10,
    width: "80%",
    borderWidth: 1,
    borderColor: "#252525",
  },
  modalTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  modalName: { color: "#00BCD4", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  modalSub: { color: "#666", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  modalBtn: {
    marginTop: 8,
    backgroundColor: "#00BCD4",
    paddingHorizontal: 40,
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalBtnText: { color: "#000", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
