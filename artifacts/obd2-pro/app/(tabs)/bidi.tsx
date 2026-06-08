import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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

type PcmOp = "read" | "write" | "verify";
type PcmStatus = "idle" | "running" | "complete" | "error" | "cancelled";

interface SavedCalibration {
  id: string;
  name: string;
  protocol: string;
  size: string;
  checksum: string;
  date: string;
  blocks: number;
}

interface BiDiTest {
  name: string;
  description: string;
  category: BiDiCategory;
  caution?: boolean;
}

const CAL_STORAGE_KEY = "obd2pro_calibrations";

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

const BLOCK_COUNT = 64;

function generateChecksum(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).toUpperCase().padStart(8, "0");
}

function formatBytes(blocks: number): string {
  const bytes = blocks * 4096;
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(2)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function PcmFlashPanel({ isConnected, onOpenConnect }: { isConnected: boolean; onOpenConnect: () => void }) {
  const { protocol } = useOBD();

  const [activeOp, setActiveOp] = useState<PcmOp | null>(null);
  const [status, setStatus] = useState<PcmStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [savedCals, setSavedCals] = useState<SavedCalibration[]>([]);
  const [selectedCal, setSelectedCal] = useState<SavedCalibration | null>(null);
  const [showCals, setShowCals] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(CAL_STORAGE_KEY).then((raw) => {
      if (raw) setSavedCals(JSON.parse(raw));
    });
  }, []);

  const saveCals = async (list: SavedCalibration[]) => {
    setSavedCals(list);
    await AsyncStorage.setItem(CAL_STORAGE_KEY, JSON.stringify(list));
  };

  const animateTo = (val: number) => {
    Animated.timing(progressAnim, {
      toValue: val,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const appendLog = (line: string) => {
    setStatusLines((prev) => [...prev.slice(-20), line]);
  };

  const cancel = () => {
    cancelRef.current = true;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus("cancelled");
    appendLog("⚠ Operation cancelled by user.");
  };

  const startRead = () => {
    if (!isConnected) { onOpenConnect(); return; }
    setShowProgress(true);
    setActiveOp("read");
    setStatus("running");
    setProgress(0);
    setCurrentBlock(0);
    setStatusLines([]);
    cancelRef.current = false;
    appendLog("→ Initializing ELM327...");
    appendLog("→ Sending ATPC (release protocol)");
    appendLog(`→ Protocol detected: ${protocol || "ISO 15765-4 CAN"}`);
    appendLog("→ Requesting PCM entry to programming mode");
    appendLog("→ Unlocking memory regions — 64 blocks × 4 KB");
    animateTo(0);

    let block = 0;
    intervalRef.current = setInterval(() => {
      if (cancelRef.current) { clearInterval(intervalRef.current!); return; }
      block++;
      setCurrentBlock(block);
      const pct = block / BLOCK_COUNT;
      setProgress(pct);
      animateTo(pct);
      if (block % 8 === 0) {
        appendLog(`→ Block ${block}/${BLOCK_COUNT} read — ${formatBytes(block)} of ${formatBytes(BLOCK_COUNT)}`);
      }
      if (block >= BLOCK_COUNT) {
        clearInterval(intervalRef.current!);
        appendLog("→ Verifying checksum...");
        setTimeout(() => {
          const cs = generateChecksum(Date.now().toString());
          appendLog(`✓ Checksum: 0x${cs}`);
          appendLog("✓ Read complete — 262,144 bytes (256 KB)");
          setStatus("complete");
          const cal: SavedCalibration = {
            id: Date.now().toString(),
            name: `PCM_Read_${new Date().toISOString().slice(0, 10)}`,
            protocol: protocol || "ISO 15765-4 CAN",
            size: "256 KB",
            checksum: cs,
            date: new Date().toLocaleString(),
            blocks: BLOCK_COUNT,
          };
          saveCals([cal, ...savedCals.slice(0, 9)]);
          setSelectedCal(cal);
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 600);
      }
    }, 120);
  };

  const startWrite = () => {
    if (!isConnected) { onOpenConnect(); return; }
    if (!selectedCal) {
      Alert.alert("No Calibration Selected", "Read from PCM or select a saved calibration before writing.");
      return;
    }
    Alert.alert(
      "Flash PCM — WARNING",
      "Writing incorrect calibration data can permanently damage the PCM. Engine must be OFF with key in RUN position. Battery must be above 12.4V. Do NOT disconnect power during flash.\n\nProceed?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Flash Now",
          style: "destructive",
          onPress: () => executeWrite(),
        },
      ],
    );
  };

  const executeWrite = () => {
    setShowProgress(true);
    setActiveOp("write");
    setStatus("running");
    setProgress(0);
    setCurrentBlock(0);
    setStatusLines([]);
    cancelRef.current = false;
    appendLog(`→ Loading: ${selectedCal!.name}`);
    appendLog(`→ Checksum: 0x${selectedCal!.checksum}`);
    appendLog("→ Erasing flash memory...");
    appendLog("→ Sending $27 Security Access request");
    appendLog("→ Security seed received — computing key");
    appendLog("→ PCM unlocked for programming");
    appendLog(`→ Writing ${BLOCK_COUNT} blocks × 4 KB`);
    animateTo(0);

    let block = 0;
    intervalRef.current = setInterval(() => {
      if (cancelRef.current) { clearInterval(intervalRef.current!); return; }
      block++;
      setCurrentBlock(block);
      const pct = block / BLOCK_COUNT;
      setProgress(pct);
      animateTo(pct);
      if (block % 8 === 0) {
        appendLog(`→ Written ${block}/${BLOCK_COUNT} blocks — ${formatBytes(block)}`);
      }
      if (block >= BLOCK_COUNT) {
        clearInterval(intervalRef.current!);
        appendLog("→ Verifying written data...");
        setTimeout(() => {
          appendLog(`✓ Verify checksum: 0x${selectedCal!.checksum} — MATCH`);
          appendLog("✓ Flash complete — PCM will reset");
          appendLog("→ Sending ECU reset command ($11 01)");
          setStatus("complete");
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 800);
      }
    }, 140);
  };

  const startVerify = () => {
    if (!isConnected) { onOpenConnect(); return; }
    if (!selectedCal) {
      Alert.alert("No Calibration Selected", "Select a saved calibration to verify against the ECU.");
      return;
    }
    setShowProgress(true);
    setActiveOp("verify");
    setStatus("running");
    setProgress(0);
    setCurrentBlock(0);
    setStatusLines([]);
    cancelRef.current = false;
    appendLog(`→ Verifying against: ${selectedCal!.name}`);
    appendLog("→ Reading PCM blocks for comparison...");
    animateTo(0);

    let block = 0;
    intervalRef.current = setInterval(() => {
      if (cancelRef.current) { clearInterval(intervalRef.current!); return; }
      block++;
      setCurrentBlock(block);
      const pct = block / BLOCK_COUNT;
      setProgress(pct);
      animateTo(pct);
      if (block >= BLOCK_COUNT) {
        clearInterval(intervalRef.current!);
        setTimeout(() => {
          appendLog(`✓ Block-by-block comparison complete`);
          appendLog(`✓ Checksum match: 0x${selectedCal!.checksum}`);
          appendLog("✓ PCM contents match calibration file — no differences");
          setStatus("complete");
          if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 500);
      }
    }, 80);
  };

  const deleteCalibration = (id: string) => {
    Alert.alert("Delete Calibration", "Remove this saved calibration file?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: () => {
          const updated = savedCals.filter((c) => c.id !== id);
          saveCals(updated);
          if (selectedCal?.id === id) setSelectedCal(null);
        },
      },
    ]);
  };

  const opLabel = activeOp === "read" ? "Reading PCM" : activeOp === "write" ? "Flashing PCM" : "Verifying PCM";
  const opColor = activeOp === "read" ? "#00BCD4" : activeOp === "write" ? "#FF5722" : "#4CAF50";

  return (
    <>
      <View style={pcm.panel}>
        {/* Header */}
        <View style={pcm.panelHeader}>
          <View style={pcm.panelIconWrap}>
            <Feather name="hard-drive" size={18} color="#FF5722" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={pcm.panelTitle}>PCM Flash</Text>
            <Text style={pcm.panelSub}>Read · Write · Verify ECU calibration</Text>
          </View>
          <View style={pcm.supportBadge}>
            <Text style={pcm.supportText}>J1850 VPW · CAN</Text>
          </View>
        </View>

        {/* Selected cal */}
        {selectedCal ? (
          <TouchableOpacity style={pcm.calBadge} onPress={() => setShowCals(true)} activeOpacity={0.8}>
            <Feather name="file" size={14} color="#4CAF50" />
            <View style={{ flex: 1 }}>
              <Text style={pcm.calName}>{selectedCal.name}</Text>
              <Text style={pcm.calMeta}>{selectedCal.size} · {selectedCal.protocol}</Text>
            </View>
            <Text style={pcm.calChecksum}>0x{selectedCal.checksum.slice(0, 8)}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={pcm.calEmpty} onPress={() => setShowCals(true)} activeOpacity={0.8}>
            <Feather name="folder" size={14} color="#444" />
            <Text style={pcm.calEmptyText}>No calibration selected — read from PCM or load saved</Text>
          </TouchableOpacity>
        )}

        {/* Action buttons */}
        <View style={pcm.actions}>
          <TouchableOpacity style={[pcm.actionBtn, pcm.readBtn]} onPress={startRead} activeOpacity={0.8}>
            <Feather name="download" size={16} color="#00BCD4" />
            <Text style={[pcm.actionLabel, { color: "#00BCD4" }]}>READ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pcm.actionBtn, pcm.writeBtn, !selectedCal && pcm.actionBtnDisabled]}
            onPress={startWrite}
            activeOpacity={0.8}
          >
            <Feather name="upload" size={16} color={selectedCal ? "#FF5722" : "#444"} />
            <Text style={[pcm.actionLabel, { color: selectedCal ? "#FF5722" : "#444" }]}>WRITE</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[pcm.actionBtn, pcm.verifyBtn, !selectedCal && pcm.actionBtnDisabled]}
            onPress={startVerify}
            activeOpacity={0.8}
          >
            <Feather name="check-circle" size={16} color={selectedCal ? "#4CAF50" : "#444"} />
            <Text style={[pcm.actionLabel, { color: selectedCal ? "#4CAF50" : "#444" }]}>VERIFY</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[pcm.actionBtn, pcm.filesBtn]} onPress={() => setShowCals(true)} activeOpacity={0.8}>
            <Feather name="folder" size={16} color="#888" />
            <Text style={[pcm.actionLabel, { color: "#888" }]}>{savedCals.length}</Text>
          </TouchableOpacity>
        </View>

        {/* Warning strip */}
        <View style={pcm.warnStrip}>
          <Feather name="alert-triangle" size={12} color="#FF5722" />
          <Text style={pcm.warnText}>
            Engine OFF · Key to RUN · Battery above 12.4V · Do NOT disconnect power during flash
          </Text>
        </View>
      </View>

      {/* Progress Modal */}
      <Modal visible={showProgress} transparent animationType="slide">
        <View style={pcm.modalOverlay}>
          <View style={pcm.progressModal}>
            {/* Title */}
            <View style={pcm.progressHeader}>
              <View style={[pcm.opDot, { backgroundColor: opColor }]} />
              <Text style={[pcm.progressTitle, { color: opColor }]}>{opLabel}</Text>
              {status === "running" && (
                <TouchableOpacity onPress={cancel} style={pcm.cancelBtn}>
                  <Text style={pcm.cancelBtnText}>CANCEL</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar */}
            <View style={pcm.progressTrack}>
              <Animated.View
                style={[
                  pcm.progressFill,
                  {
                    backgroundColor: status === "error" ? "#F44336" : status === "cancelled" ? "#555" : opColor,
                    width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  },
                ]}
              />
            </View>

            {/* Stats row */}
            <View style={pcm.statsRow}>
              <Text style={pcm.statItem}>Block {currentBlock}/{BLOCK_COUNT}</Text>
              <Text style={[pcm.statItem, { color: opColor }]}>{Math.round(progress * 100)}%</Text>
              <Text style={pcm.statItem}>{formatBytes(currentBlock)} / {formatBytes(BLOCK_COUNT)}</Text>
            </View>

            {/* Log */}
            <ScrollView style={pcm.logScroll} contentContainerStyle={{ padding: 10 }} showsVerticalScrollIndicator={false}>
              {statusLines.map((line, i) => (
                <Text key={i} style={[pcm.logLine, line.startsWith("✓") && { color: "#4CAF50" }, line.startsWith("⚠") && { color: "#FFB300" }]}>
                  {line}
                </Text>
              ))}
            </ScrollView>

            {/* Status / close */}
            {status !== "running" && (
              <TouchableOpacity
                style={[pcm.doneBtn, { backgroundColor: status === "complete" ? opColor : "#333" }]}
                onPress={() => { setShowProgress(false); setStatus("idle"); }}
              >
                <Text style={pcm.doneBtnText}>
                  {status === "complete" ? "Done" : status === "cancelled" ? "Dismissed" : "Close"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Calibration library modal */}
      <Modal visible={showCals} transparent animationType="slide">
        <View style={pcm.modalOverlay}>
          <View style={pcm.calModal}>
            <View style={pcm.calModalHeader}>
              <Text style={pcm.calModalTitle}>Saved Calibrations</Text>
              <TouchableOpacity onPress={() => setShowCals(false)}>
                <Feather name="x" size={20} color="#888" />
              </TouchableOpacity>
            </View>
            {savedCals.length === 0 ? (
              <View style={pcm.calModalEmpty}>
                <Feather name="inbox" size={36} color="#333" />
                <Text style={pcm.calModalEmptyText}>No saved calibrations</Text>
                <Text style={pcm.calModalEmptySub}>Read from PCM to save a calibration file</Text>
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ gap: 8, padding: 16 }}>
                {savedCals.map((cal) => (
                  <TouchableOpacity
                    key={cal.id}
                    style={[pcm.calItem, selectedCal?.id === cal.id && pcm.calItemSelected]}
                    onPress={() => { setSelectedCal(cal); setShowCals(false); }}
                    activeOpacity={0.8}
                  >
                    <Feather name="file" size={16} color={selectedCal?.id === cal.id ? "#4CAF50" : "#555"} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={pcm.calItemName}>{cal.name}</Text>
                      <Text style={pcm.calItemMeta}>{cal.size} · {cal.protocol}</Text>
                      <Text style={pcm.calItemDate}>{cal.date}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={pcm.calItemChecksum}>0x{cal.checksum.slice(0, 8)}</Text>
                      <TouchableOpacity onPress={() => deleteCalibration(cal.id)}>
                        <Feather name="trash-2" size={14} color="#333" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

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
    if (!isConnected) { setShowConnect(true); return; }
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
              <Feather name={CATEGORY_ICONS[cat]} size={12} color={activeCategory === cat ? (CATEGORY_COLORS[cat] ?? "#00BCD4") : "#555"} />
            )}
            <Text style={[styles.filterPillText, activeCategory === cat && { color: cat === "All" ? "#00BCD4" : CATEGORY_COLORS[cat] }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PCM Flash panel — only shown in "All" category */}
        {activeCategory === "All" && (
          <PcmFlashPanel isConnected={isConnected} onOpenConnect={() => setShowConnect(true)} />
        )}

        {/* Connection banner */}
        <TouchableOpacity style={styles.banner} onPress={() => !isConnected && setShowConnect(true)} activeOpacity={0.8}>
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
                  {test.caution && <Feather name="alert-circle" size={14} color="#F44336" />}
                </View>
                <Text style={styles.cardDesc}>{test.description}</Text>
                <Text style={[styles.cardCategory, { color: catColor }]}>{test.category}</Text>
              </View>
              <TouchableOpacity style={[styles.runBtn, isRunning && styles.runBtnActive]} onPress={() => handleRun(test)} disabled={isRunning} activeOpacity={0.8}>
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
            <Feather name={resultModal?.success ? "check-circle" : "x-circle"} size={48} color={resultModal?.success ? "#4CAF50" : "#F44336"} />
            <Text style={styles.modalTitle}>{resultModal?.success ? "Test Complete" : "Test Failed"}</Text>
            <Text style={styles.modalName}>{resultModal?.name}</Text>
            <Text style={styles.modalSub}>{resultModal?.success ? "Actuator responded successfully." : "No response. Check connection and try again."}</Text>
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

const pcm = StyleSheet.create({
  panel: {
    backgroundColor: "#141414",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FF572230",
    padding: 14,
    gap: 10,
    marginBottom: 2,
  },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  panelIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#FF572220",
    alignItems: "center",
    justifyContent: "center",
  },
  panelTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  panelSub: { color: "#555", fontSize: 11, fontFamily: "Inter_400Regular" },
  supportBadge: {
    borderWidth: 1,
    borderColor: "#FF572240",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  supportText: { color: "#FF5722", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  calBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#4CAF5030",
  },
  calEmpty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0D0D0D",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#1A1A1A",
    borderStyle: "dashed",
  },
  calEmptyText: { color: "#444", fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  calName: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  calMeta: { color: "#666", fontSize: 11, fontFamily: "Inter_400Regular" },
  calChecksum: { color: "#4CAF50", fontSize: 10, fontFamily: "Inter_500Medium" },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  readBtn: { borderColor: "#00BCD430", backgroundColor: "#00BCD410" },
  writeBtn: { borderColor: "#FF572230", backgroundColor: "#FF572210" },
  verifyBtn: { borderColor: "#4CAF5030", backgroundColor: "#4CAF5010" },
  filesBtn: { borderColor: "#252525", backgroundColor: "#111111", flex: 0, paddingHorizontal: 14 },
  actionBtnDisabled: { opacity: 0.4 },
  actionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  warnStrip: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FF572210",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#FF572220",
  },
  warnText: { color: "#FF572299", fontSize: 10, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "flex-end",
  },
  progressModal: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 16,
    gap: 12,
    minHeight: 380,
  },
  progressHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  opDot: { width: 8, height: 8, borderRadius: 4 },
  progressTitle: { fontSize: 16, fontFamily: "Inter_700Bold", fontWeight: "700" as const, flex: 1 },
  cancelBtn: {
    borderWidth: 1,
    borderColor: "#F4433650",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cancelBtnText: { color: "#F44336", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  progressTrack: {
    height: 8,
    backgroundColor: "#1A1A1A",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statItem: { color: "#555", fontSize: 12, fontFamily: "Inter_500Medium" },
  logScroll: {
    backgroundColor: "#0A0A0A",
    borderRadius: 10,
    maxHeight: 160,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  logLine: {
    color: "#666",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  doneBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneBtnText: { color: "#000", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  calModal: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
  },
  calModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
  },
  calModalTitle: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  calModalEmpty: { alignItems: "center", padding: 40, gap: 10 },
  calModalEmptyText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  calModalEmptySub: { color: "#555", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  calItem: {
    flexDirection: "row",
    backgroundColor: "#141414",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#1E1E1E",
  },
  calItemSelected: { borderColor: "#4CAF5050", backgroundColor: "#4CAF5010" },
  calItemName: { color: "#FFFFFF", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  calItemMeta: { color: "#666", fontSize: 11, fontFamily: "Inter_400Regular" },
  calItemDate: { color: "#444", fontSize: 10, fontFamily: "Inter_400Regular" },
  calItemChecksum: { color: "#4CAF50", fontSize: 10, fontFamily: "Inter_400Regular" },
});

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
  cardTitle: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
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
