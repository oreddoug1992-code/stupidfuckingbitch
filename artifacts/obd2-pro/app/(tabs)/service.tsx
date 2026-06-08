import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
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

type Category =
  | "All"
  | "Engine"
  | "Transmission"
  | "Brakes"
  | "Steering"
  | "Body"
  | "Battery"
  | "HVAC"
  | "Keys & Security"
  | "Tires";

const CATEGORY_COLORS: Record<string, string> = {
  Engine: "#00BCD4",
  Transmission: "#9C27B0",
  Brakes: "#F44336",
  Steering: "#4CAF50",
  Body: "#607D8B",
  Battery: "#FF9800",
  HVAC: "#2196F3",
  "Keys & Security": "#E91E63",
  Tires: "#FFB300",
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Engine: "activity",
  Transmission: "settings",
  Brakes: "lock",
  Steering: "navigation",
  Body: "square",
  Battery: "battery-charging",
  HVAC: "thermometer",
  "Keys & Security": "key",
  Tires: "circle",
};

interface ServiceItem {
  name: string;
  description: string;
  category: Category;
  engineState?: "Engine ON" | "Engine OFF";
  warning?: boolean;
}

const SERVICE_ITEMS: ServiceItem[] = [
  { name: "Oil Life Reset", description: "Reset engine oil life monitor to 100% after oil change", category: "Engine" },
  { name: "Throttle Body Relearn", description: "Relearn throttle body idle position after cleaning or replacement", category: "Engine", engineState: "Engine OFF" },
  { name: "Idle Speed Relearn", description: "Reset idle speed adaptive values after throttle body service", category: "Engine", engineState: "Engine ON" },
  { name: "EVAP Monitor Reset", description: "Reset evaporative emission system monitor readiness", category: "Engine" },
  { name: "Injector Fuel Trim Reset", description: "Clear long-term injector correction values and relearn", category: "Engine" },
  { name: "MAF Adaptation Reset", description: "Reset MAF sensor adaptive values after sensor cleaning/replacement", category: "Engine" },
  { name: "Trans Adaptive Reset", description: "Clear transmission shift adaptive data and relearn optimal shift points", category: "Transmission", warning: true },
  { name: "TCC Adaptation Reset", description: "Reset torque converter clutch slip adaptation values", category: "Transmission" },
  { name: "EPB Retract (Service)", description: "Retract electric park brake pistons for rear brake pad replacement", category: "Brakes", engineState: "Engine OFF", warning: true },
  { name: "EPB Apply (Service Complete)", description: "Apply/reset electric park brake after rear brake pad replacement", category: "Brakes", warning: true },
  { name: "ABS Pump Bleeding", description: "Cycle ABS pump solenoids during brake bleeding for complete air purge", category: "Brakes", warning: true },
  { name: "Brake Wear Indicator Reset", description: "Reset brake pad wear indicator sensor after pad replacement", category: "Brakes" },
  { name: "Steering Angle Calibration", description: "Calibrate steering angle sensor after wheel alignment or component replace", category: "Steering", engineState: "Engine ON" },
  { name: "EPS Torque Sensor Reset", description: "Reset electric power steering torque sensor calibration", category: "Steering" },
  { name: "TPMS Sensor Relearn", description: "Register new TPMS sensor IDs after tire rotation or sensor replacement", category: "Tires" },
  { name: "TPMS Pressure Baseline", description: "Set current tire pressures as the TPMS baseline reference", category: "Tires" },
  { name: "Window Auto-Up Calibration", description: "Recalibrate power window one-touch auto-up/down after battery disconnect", category: "Body" },
  { name: "Sunroof Calibration", description: "Recalibrate sunroof positions after battery disconnect or motor replacement", category: "Body" },
  { name: "Battery Registration", description: "Register new battery specs with BCM to maintain proper charging algorithm", category: "Battery" },
  { name: "Charging System Reset", description: "Reset alternator and charging system adaptive values", category: "Battery" },
  { name: "HVAC Blend Door Calibration", description: "Calibrate HVAC blend door actuator positions", category: "HVAC" },
  { name: "A/C Service Reset", description: "Reset A/C service interval counter after refrigerant service", category: "HVAC" },
  { name: "Add Key Fob / Remote", description: "Program an additional RF key fob or smart entry remote to the vehicle", category: "Keys & Security", engineState: "Engine OFF" },
  { name: "Relearn All Remotes", description: "Erase all stored fob IDs and relearn from scratch — use after BCM replacement", category: "Keys & Security", engineState: "Engine OFF", warning: true },
  { name: "Add Transponder / Chip Key", description: "Program a new IMMO transponder key to the immobilizer module", category: "Keys & Security", engineState: "Engine OFF" },
  { name: "IMMO Relearn After BCM Swap", description: "Re-synchronize the immobilizer and ECM after replacing the BCM", category: "Keys & Security", warning: true },
  { name: "All Keys Lost Recovery", description: "Emergency IMMO reset when all transponder keys are lost or damaged", category: "Keys & Security", warning: true },
  { name: "Remote Start Module Relearn", description: "Re-pair an aftermarket or OEM remote start module after key reprogram", category: "Keys & Security" },
  { name: "Key Fob Button Test", description: "Verify each fob button transmits a valid RF signal to the BCM", category: "Keys & Security" },
  { name: "Passive Entry Antenna Calibration", description: "Calibrate the low-frequency antenna zones for keyless entry proximity", category: "Keys & Security" },
];

const CATEGORIES: Category[] = ["All", "Engine", "Transmission", "Brakes", "Steering", "Body", "Battery", "HVAC", "Keys & Security", "Tires"];

export default function ServiceScreen() {
  const { connectionState, runServiceCommand } = useOBD();
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [showConnect, setShowConnect] = useState(false);
  const [runningItem, setRunningItem] = useState<string | null>(null);
  const [resultModal, setResultModal] = useState<{ name: string; success: boolean } | null>(null);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const filtered =
    activeCategory === "All" ? SERVICE_ITEMS : SERVICE_ITEMS.filter((i) => i.category === activeCategory);

  const handleRun = async (item: ServiceItem) => {
    if (!isConnected) {
      setShowConnect(true);
      return;
    }
    if (item.warning) {
      Alert.alert(
        "Warning",
        `${item.name} may affect vehicle operation. Proceed only when vehicle is safely stationary.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Proceed",
            onPress: () => execute(item),
          },
        ],
      );
    } else {
      execute(item);
    }
  };

  const execute = async (item: ServiceItem) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRunningItem(item.name);
    const result = await runServiceCommand(item.name);
    setRunningItem(null);
    setResultModal({ name: item.name, success: result === "SUCCESS" });
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
        {/* Demo banner */}
        <TouchableOpacity
          style={styles.demoBanner}
          onPress={() => !isConnected && setShowConnect(true)}
          activeOpacity={0.8}
        >
          <Feather name="info" size={14} color="#888" />
          <Text style={styles.demoBannerText}>
            {isConnected ? "Connected — tap any procedure to execute" : "Connect in Demo mode to preview all service procedures"}
          </Text>
        </TouchableOpacity>

        {filtered.map((item) => {
          const catColor = CATEGORY_COLORS[item.category] ?? "#00BCD4";
          const isRunning = runningItem === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.card, { borderLeftColor: catColor }]}
              onPress={() => handleRun(item)}
              activeOpacity={0.75}
              disabled={isRunning}
            >
              <View style={[styles.cardIcon, { backgroundColor: catColor + "20" }]}>
                <Feather name={CATEGORY_ICONS[item.category]} size={18} color={catColor} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  {item.warning && (
                    <Feather name="alert-triangle" size={14} color="#FFB300" />
                  )}
                </View>
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.cardMeta}>
                  <Text style={[styles.cardCategory, { color: catColor }]}>{item.category}</Text>
                  {item.engineState && (
                    <View style={[
                      styles.engineBadge,
                      { backgroundColor: item.engineState === "Engine ON" ? "#4CAF5020" : "#FF5722" + "20", borderColor: item.engineState === "Engine ON" ? "#4CAF50" : "#FF5722" },
                    ]}>
                      <Text style={[styles.engineBadgeText, { color: item.engineState === "Engine ON" ? "#4CAF50" : "#FF5722" }]}>
                        {item.engineState}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.cardArrow}>
                {isRunning ? (
                  <Feather name="loader" size={16} color="#00BCD4" />
                ) : (
                  <Feather name="chevron-right" size={18} color="#444" />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      {/* Result modal */}
      <Modal visible={!!resultModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Feather
              name={resultModal?.success ? "check-circle" : "x-circle"}
              size={48}
              color={resultModal?.success ? "#4CAF50" : "#F44336"}
            />
            <Text style={styles.modalTitle}>{resultModal?.success ? "Complete" : "Failed"}</Text>
            <Text style={styles.modalName}>{resultModal?.name}</Text>
            <Text style={styles.modalSub}>
              {resultModal?.success ? "Procedure completed successfully." : "Command failed. Check connection and try again."}
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
  scrollContent: { padding: 12, gap: 8 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#141414",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#252525",
  },
  demoBannerText: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  card: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    borderLeftWidth: 3,
    padding: 14,
    alignItems: "center",
    gap: 12,
  },
  cardIcon: {
    width: 42,
    height: 42,
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
  cardDesc: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 16 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  cardCategory: { fontSize: 11, fontFamily: "Inter_500Medium" },
  engineBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  engineBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardArrow: { marginLeft: 4 },
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
