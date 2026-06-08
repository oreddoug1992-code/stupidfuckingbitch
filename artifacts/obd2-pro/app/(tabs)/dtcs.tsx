import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConnectSheet } from "@/components/ConnectSheet";
import { DTC, useOBD } from "@/context/OBDContext";

type Tab = "ecm" | "all" | "adv";

function DTCCard({ dtc }: { dtc: DTC }) {
  const severityColor =
    dtc.severity === "high" ? "#F44336" :
    dtc.severity === "medium" ? "#FFB300" : "#4CAF50";

  const typeLabel =
    dtc.type === "stored" ? "STORED" :
    dtc.type === "pending" ? "PENDING" : "PERMANENT";

  return (
    <View style={styles.dtcCard}>
      <View style={[styles.dtcSeverityBar, { backgroundColor: severityColor }]} />
      <View style={styles.dtcBody}>
        <View style={styles.dtcRow}>
          <Text style={[styles.dtcCode, { color: severityColor }]}>{dtc.code}</Text>
          <View style={[styles.dtcBadge, { borderColor: severityColor + "60" }]}>
            <Text style={[styles.dtcBadgeText, { color: severityColor }]}>{typeLabel}</Text>
          </View>
        </View>
        <Text style={styles.dtcDesc}>{dtc.description}</Text>
        <Text style={styles.dtcModule}>{dtc.module}</Text>
      </View>
    </View>
  );
}

export default function DTCsScreen() {
  const { connectionState, dtcs, clearDTCs, readDTCs } = useOBD();
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [showConnect, setShowConnect] = useState(false);
  const insets = useSafeAreaInsets();
  const isConnected = connectionState === "connected" || connectionState === "demo";

  const displayDTCs =
    activeTab === "ecm"
      ? dtcs.filter((d) => d.module === "ECM")
      : activeTab === "adv"
        ? dtcs.filter((d) => d.type !== "stored")
        : dtcs;

  const handleClear = () => {
    if (!isConnected) return;
    Alert.alert(
      "Clear DTCs",
      "This will erase all stored fault codes from the ECM. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            clearDTCs();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Top tabs */}
      <View style={styles.tabBar}>
        {(["ecm", "all", "adv"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, activeTab === t && styles.tabItemActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabLabel, activeTab === t && styles.tabLabelActive]}>
              {t === "ecm" ? "OBD2 / ECM" : t === "all" ? "ALL MODULES" : "ADV"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isConnected ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="check-circle" size={56} color="#00BCD4" />
            </View>
            <Text style={styles.emptyTitle}>Not connected</Text>
            <Text style={styles.emptySubtitle}>Connect to ELM327 to begin diagnostics</Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => setShowConnect(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Action bar */}
            <View style={styles.actionBar}>
              <TouchableOpacity style={styles.actionBtn} onPress={readDTCs} activeOpacity={0.7}>
                <Feather name="refresh-cw" size={15} color="#00BCD4" />
                <Text style={styles.actionBtnText}>Read DTCs</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnDanger]}
                onPress={handleClear}
                activeOpacity={0.7}
                disabled={displayDTCs.length === 0}
              >
                <Feather name="trash-2" size={15} color="#F44336" />
                <Text style={[styles.actionBtnText, { color: "#F44336" }]}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {displayDTCs.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIcon, { borderColor: "#4CAF5040" }]}>
                  <Feather name="check-circle" size={56} color="#4CAF50" />
                </View>
                <Text style={styles.emptyTitle}>No fault codes</Text>
                <Text style={styles.emptySubtitle}>System is clear. No DTCs detected.</Text>
              </View>
            ) : (
              <>
                <View style={styles.dtcSummary}>
                  <Text style={styles.dtcSummaryText}>
                    {displayDTCs.length} fault code{displayDTCs.length !== 1 ? "s" : ""} found
                  </Text>
                </View>
                {displayDTCs.map((d) => (
                  <DTCCard key={d.id} dtc={d} />
                ))}
              </>
            )}
          </>
        )}
        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>

      <ConnectSheet visible={showConnect} onClose={() => setShowConnect(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1E1E1E",
    paddingHorizontal: 16,
  },
  tabItem: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: "#00BCD4" },
  tabLabel: {
    color: "#555",
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tabLabelActive: { color: "#00BCD4" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 10 },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#00BCD430",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    fontWeight: "700" as const,
  },
  emptySubtitle: {
    color: "#666",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  connectButton: {
    marginTop: 12,
    backgroundColor: "#00BCD4",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  connectButtonText: {
    color: "#000",
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  actionBar: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#141414",
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#00BCD430",
  },
  actionBtnDanger: { borderColor: "#F4433630" },
  actionBtnText: {
    color: "#00BCD4",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  dtcSummary: {
    paddingVertical: 4,
  },
  dtcSummaryText: {
    color: "#666",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  dtcCard: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  dtcSeverityBar: { width: 3 },
  dtcBody: { flex: 1, padding: 14, gap: 4 },
  dtcRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dtcCode: { fontSize: 16, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  dtcBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dtcBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  dtcDesc: {
    color: "#CCCCCC",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  dtcModule: { color: "#555", fontSize: 11, fontFamily: "Inter_400Regular" },
});
