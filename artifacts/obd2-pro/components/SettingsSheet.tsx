import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppSettings,
  MaxRPM,
  MaxSpeed,
  PollingRate,
  PreferredProtocol,
  UnitSystem,
  useSettings,
} from "@/context/SettingsContext";

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Section = "units" | "gauges" | "connection" | "alerts" | "display" | "data" | "about";

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Feather.glyphMap }) {
  return (
    <View style={s.sectionHeader}>
      <View style={s.sectionIconWrap}>
        <Feather name={icon} size={13} color="#00BCD4" />
      </View>
      <Text style={s.sectionTitle}>{title}</Text>
    </View>
  );
}

function SettingRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub && <Text style={s.rowSub}>{sub}</Text>}
      </View>
      <View style={s.rowRight}>{children}</View>
    </View>
  );
}

function SegmentPicker<T extends string | number>({
  options,
  value,
  onChange,
  labels,
  color,
}: {
  options: T[];
  value: T;
  onChange: (v: T) => void;
  labels?: Record<string | number, string>;
  color?: string;
}) {
  return (
    <View style={s.segWrap}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <TouchableOpacity
            key={String(opt)}
            style={[s.segBtn, active && { backgroundColor: (color ?? "#00BCD4") + "20", borderColor: color ?? "#00BCD4" }]}
            onPress={() => {
              if (Platform.OS !== "web") Haptics.selectionAsync();
              onChange(opt);
            }}
            activeOpacity={0.7}
          >
            <Text style={[s.segBtnText, active && { color: color ?? "#00BCD4" }]}>
              {labels ? labels[opt as string | number] : String(opt)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const COLORS = ["#00BCD4", "#4CAF50", "#FF9800", "#E91E63", "#9C27B0", "#F44336", "#2196F3", "#FFD600"];
  return (
    <View style={s.colorRow}>
      {COLORS.map((c) => (
        <TouchableOpacity
          key={c}
          style={[s.colorDot, { backgroundColor: c }, value === c && s.colorDotActive]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.selectionAsync();
            onChange(c);
          }}
          activeOpacity={0.8}
        />
      ))}
    </View>
  );
}

const PROTOCOL_LABELS: Record<PreferredProtocol, string> = {
  auto: "Auto",
  can_11_500: "CAN 11/500",
  can_29_500: "CAN 29/500",
  can_11_250: "CAN 11/250",
  iso9141: "ISO 9141",
  kwp2000: "KWP 2000",
  j1850_vpw: "J1850 VPW",
  j1850_pwm: "J1850 PWM",
};

const NAV_SECTIONS: { id: Section; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { id: "units", label: "Units", icon: "thermometer" },
  { id: "gauges", label: "Gauges", icon: "activity" },
  { id: "connection", label: "Connection", icon: "bluetooth" },
  { id: "alerts", label: "Alerts", icon: "bell" },
  { id: "display", label: "Display", icon: "monitor" },
  { id: "data", label: "Data", icon: "database" },
  { id: "about", label: "About", icon: "info" },
];

export function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const insets = useSafeAreaInsets();
  const [activeSection, setActiveSection] = useState<Section>("units");

  const toggle = (key: keyof AppSettings) =>
    updateSetting(key, !settings[key] as AppSettings[typeof key]);

  const handleReset = () => {
    Alert.alert(
      "Reset Settings",
      "Restore all settings to defaults?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            resetSettings();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>Settings</Text>
            <TouchableOpacity style={s.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Feather name="x" size={18} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={s.body}>
            {/* Sidebar nav */}
            <View style={s.sidebar}>
              {NAV_SECTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec.id}
                  style={[s.navItem, activeSection === sec.id && s.navItemActive]}
                  onPress={() => setActiveSection(sec.id)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={sec.icon}
                    size={15}
                    color={activeSection === sec.id ? "#00BCD4" : "#555"}
                  />
                  <Text style={[s.navLabel, activeSection === sec.id && s.navLabelActive]}>
                    {sec.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Content */}
            <ScrollView
              style={s.content}
              contentContainerStyle={s.contentInner}
              showsVerticalScrollIndicator={false}
            >
              {/* ── UNITS ── */}
              {activeSection === "units" && (
                <>
                  <SectionHeader title="Units & Measurement" icon="thermometer" />

                  <SettingRow label="Unit System" sub="Affects speed, temperature, and pressure">
                    <SegmentPicker<UnitSystem>
                      options={["metric", "imperial"]}
                      value={settings.unitSystem}
                      onChange={(v) => updateSetting("unitSystem", v)}
                      labels={{ metric: "Metric", imperial: "Imperial" }}
                    />
                  </SettingRow>

                  <View style={s.infoCard}>
                    <Text style={s.infoCardTitle}>{settings.unitSystem === "metric" ? "Metric" : "Imperial"} units active</Text>
                    <Text style={s.infoCardSub}>
                      {settings.unitSystem === "metric"
                        ? "Speed: km/h · Temperature: °C · Pressure: kPa · Distance: km"
                        : "Speed: mph · Temperature: °F · Pressure: psi · Distance: mi"}
                    </Text>
                  </View>

                  <SettingRow label="Overheat Threshold">
                    <SegmentPicker<number>
                      options={[95, 100, 105, 110, 115]}
                      value={settings.overheatThreshold}
                      onChange={(v) => updateSetting("overheatThreshold", v as AppSettings["overheatThreshold"])}
                      labels={{ 95: "95°", 100: "100°", 105: "105°", 110: "110°", 115: "115°" }}
                      color="#F44336"
                    />
                  </SettingRow>
                </>
              )}

              {/* ── GAUGES ── */}
              {activeSection === "gauges" && (
                <>
                  <SectionHeader title="Gauge Scales" icon="activity" />

                  <SettingRow label="Max RPM" sub="Upper limit on tachometer gauge">
                    <SegmentPicker<MaxRPM>
                      options={[6000, 8000, 10000, 12000]}
                      value={settings.maxRpm}
                      onChange={(v) => updateSetting("maxRpm", v)}
                      labels={{ 6000: "6k", 8000: "8k", 10000: "10k", 12000: "12k" }}
                    />
                  </SettingRow>

                  <SettingRow
                    label="Max Speed"
                    sub={settings.unitSystem === "metric" ? "km/h" : "mph"}
                  >
                    <SegmentPicker<MaxSpeed>
                      options={[120, 160, 200, 260]}
                      value={settings.maxSpeed}
                      onChange={(v) => updateSetting("maxSpeed", v)}
                      labels={{ 120: "120", 160: "160", 200: "200", 260: "260" }}
                    />
                  </SettingRow>

                  <SettingRow label="Gauge Accent Color" sub="Active arc and value color">
                    <ColorPicker
                      value={settings.darkGaugeAccent}
                      onChange={(v) => updateSetting("darkGaugeAccent", v)}
                    />
                  </SettingRow>
                </>
              )}

              {/* ── CONNECTION ── */}
              {activeSection === "connection" && (
                <>
                  <SectionHeader title="Connection" icon="bluetooth" />

                  <SettingRow label="Polling Rate" sub="How often sensor data is requested">
                    <SegmentPicker<PollingRate>
                      options={[250, 500, 1000, 2000]}
                      value={settings.pollingRateMs}
                      onChange={(v) => updateSetting("pollingRateMs", v)}
                      labels={{ 250: "250ms", 500: "500ms", 1000: "1s", 2000: "2s" }}
                    />
                  </SettingRow>

                  <SettingRow label="Auto-connect on Launch" sub="Re-connect to last device at startup">
                    <Switch
                      value={settings.autoConnect}
                      onValueChange={() => toggle("autoConnect")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.autoConnect ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  <SettingRow label="Preferred Protocol" sub="ELM327 ATSP command value">
                    <View style={{ gap: 4 }}>
                      {(Object.keys(PROTOCOL_LABELS) as PreferredProtocol[]).map((proto) => (
                        <TouchableOpacity
                          key={proto}
                          style={[s.radioRow, settings.preferredProtocol === proto && s.radioRowActive]}
                          onPress={() => {
                            if (Platform.OS !== "web") Haptics.selectionAsync();
                            updateSetting("preferredProtocol", proto);
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[s.radioDot, settings.preferredProtocol === proto && s.radioDotActive]} />
                          <Text style={[s.radioLabel, settings.preferredProtocol === proto && s.radioLabelActive]}>
                            {PROTOCOL_LABELS[proto]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </SettingRow>
                </>
              )}

              {/* ── ALERTS ── */}
              {activeSection === "alerts" && (
                <>
                  <SectionHeader title="Alerts" icon="bell" />

                  <SettingRow label="Enable Alerts" sub="DTC warnings and sensor thresholds">
                    <Switch
                      value={settings.alertsEnabled}
                      onValueChange={() => toggle("alertsEnabled")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.alertsEnabled ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  <SettingRow label="Haptic Feedback" sub="Vibration on actions and alerts">
                    <Switch
                      value={settings.hapticFeedback}
                      onValueChange={() => toggle("hapticFeedback")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.hapticFeedback ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  <SettingRow label="Low Fuel Alert" sub="Alert below this fuel level">
                    <SegmentPicker<number>
                      options={[5, 10, 15, 20, 25]}
                      value={settings.lowFuelThreshold}
                      onChange={(v) => updateSetting("lowFuelThreshold", v as AppSettings["lowFuelThreshold"])}
                      labels={{ 5: "5%", 10: "10%", 15: "15%", 20: "20%", 25: "25%" }}
                      color="#FFB300"
                    />
                  </SettingRow>

                  <View style={s.infoCard}>
                    <Feather name="alert-triangle" size={13} color="#FFB300" />
                    <Text style={s.infoCardSub}>
                      Alerts require connection to an ELM327 adapter. Demo mode simulates thresholds.
                    </Text>
                  </View>
                </>
              )}

              {/* ── DISPLAY ── */}
              {activeSection === "display" && (
                <>
                  <SectionHeader title="Display" icon="monitor" />

                  <SettingRow label="Keep Screen On" sub="Prevent sleep while connected">
                    <Switch
                      value={settings.keepScreenOn}
                      onValueChange={() => toggle("keepScreenOn")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.keepScreenOn ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  <SettingRow label="Show Protocol in Dashboard" sub="Display active OBD2 protocol">
                    <Switch
                      value={settings.showProtocolInDashboard}
                      onValueChange={() => toggle("showProtocolInDashboard")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.showProtocolInDashboard ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  <SettingRow label="PCM Block Numbers" sub="Show block count in flash progress">
                    <Switch
                      value={settings.showPcmBlockNumbers}
                      onValueChange={() => toggle("showPcmBlockNumbers")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.showPcmBlockNumbers ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>
                </>
              )}

              {/* ── DATA ── */}
              {activeSection === "data" && (
                <>
                  <SectionHeader title="Data & Logging" icon="database" />

                  <SettingRow label="Data Logging" sub="Record sensor data to a local file">
                    <Switch
                      value={settings.logDataEnabled}
                      onValueChange={() => toggle("logDataEnabled")}
                      trackColor={{ false: "#252525", true: "#00BCD440" }}
                      thumbColor={settings.logDataEnabled ? "#00BCD4" : "#555"}
                    />
                  </SettingRow>

                  {settings.logDataEnabled && (
                    <View style={[s.infoCard, { borderColor: "#4CAF5030" }]}>
                      <Feather name="check-circle" size={13} color="#4CAF50" />
                      <Text style={s.infoCardSub}>
                        Logging active. CSV will be saved to app storage when you disconnect.
                      </Text>
                    </View>
                  )}

                  <View style={s.dangerZone}>
                    <Text style={s.dangerZoneLabel}>DANGER ZONE</Text>
                    <TouchableOpacity style={s.dangerBtn} onPress={handleReset} activeOpacity={0.8}>
                      <Feather name="refresh-cw" size={14} color="#F44336" />
                      <Text style={s.dangerBtnText}>Reset All Settings</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {/* ── ABOUT ── */}
              {activeSection === "about" && (
                <>
                  <SectionHeader title="About OBD2 Pro" icon="info" />

                  <View style={s.aboutCard}>
                    <View style={s.aboutIconWrap}>
                      <Feather name="zap" size={28} color="#00BCD4" />
                    </View>
                    <Text style={s.aboutName}>OBD2 Pro</Text>
                    <Text style={s.aboutVersion}>Version 1.0.0 · Build 20260608</Text>
                  </View>

                  {[
                    { label: "OBD2 Adapter", value: "ELM327 compatible" },
                    { label: "Supported Protocols", value: "CAN, ISO 9141, KWP2000, J1850 VPW/PWM" },
                    { label: "PCM Flash", value: "64 blocks × 4 KB (256 KB max)" },
                    { label: "VIN Lookup", value: "NHTSA vPIC API" },
                    { label: "Demo Polling", value: "500 ms sine-wave simulation" },
                    { label: "Calibration Storage", value: "AsyncStorage (up to 10 files)" },
                  ].map((row) => (
                    <View key={row.label} style={s.aboutRow}>
                      <Text style={s.aboutRowLabel}>{row.label}</Text>
                      <Text style={s.aboutRowValue}>{row.value}</Text>
                    </View>
                  ))}

                  <View style={s.infoCard}>
                    <Text style={s.infoCardSub}>
                      OBD2 Pro is an independent diagnostic tool. Always consult a qualified technician before performing ECU calibration changes. The developer is not responsible for damage caused by incorrect calibration files or improper use.
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0F0F0F",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flexDirection: "row",
    flex: 1,
    minHeight: 440,
  },
  sidebar: {
    width: 80,
    backgroundColor: "#0A0A0A",
    borderRightWidth: 1,
    borderRightColor: "#1A1A1A",
    paddingVertical: 8,
    gap: 2,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
    marginHorizontal: 6,
    borderRadius: 10,
  },
  navItemActive: { backgroundColor: "#00BCD415" },
  navLabel: { color: "#555", fontSize: 9, fontFamily: "Inter_500Medium", textAlign: "center" },
  navLabelActive: { color: "#00BCD4" },
  content: { flex: 1 },
  contentInner: { padding: 16, gap: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  sectionIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "#00BCD415",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  row: {
    gap: 10,
  },
  rowLeft: { gap: 2 },
  rowRight: {},
  rowLabel: { color: "#CCCCCC", fontSize: 13, fontFamily: "Inter_500Medium" },
  rowSub: { color: "#555", fontSize: 11, fontFamily: "Inter_400Regular" },
  segWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  segBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#252525",
    backgroundColor: "#141414",
  },
  segBtnText: { color: "#555", fontSize: 12, fontFamily: "Inter_500Medium" },
  infoCard: {
    backgroundColor: "#141414",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    gap: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoCardTitle: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  infoCardSub: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, flex: 1 },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    backgroundColor: "#111111",
  },
  radioRowActive: { borderColor: "#00BCD440", backgroundColor: "#00BCD410" },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#444",
  },
  radioDotActive: { borderColor: "#00BCD4", backgroundColor: "#00BCD4" },
  radioLabel: { color: "#555", fontSize: 12, fontFamily: "Inter_400Regular" },
  radioLabelActive: { color: "#00BCD4" },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: {
    borderColor: "#FFFFFF",
    transform: [{ scale: 1.15 }],
  },
  dangerZone: {
    borderWidth: 1,
    borderColor: "#F4433630",
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: 8,
  },
  dangerZoneLabel: {
    color: "#F44336",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F4433650",
    borderRadius: 10,
    paddingVertical: 10,
  },
  dangerBtnText: { color: "#F44336", fontSize: 13, fontFamily: "Inter_500Medium" },
  aboutCard: {
    backgroundColor: "#141414",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  aboutIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#00BCD420",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  aboutName: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  aboutVersion: { color: "#555", fontSize: 12, fontFamily: "Inter_400Regular" },
  aboutRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  aboutRowLabel: { color: "#666", fontSize: 12, fontFamily: "Inter_400Regular" },
  aboutRowValue: { color: "#AAAAAA", fontSize: 12, fontFamily: "Inter_500Medium", maxWidth: "55%", textAlign: "right" },
});
