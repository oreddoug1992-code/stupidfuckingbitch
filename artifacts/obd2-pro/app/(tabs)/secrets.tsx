import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const UNLOCK_KEY = "obd2pro_secrets_unlocked";
const UNLOCK_TAPS = 7;
const UNLOCK_WINDOW = 3000;

type TrickCategory = "Pin Jump" | "Diagnostic Mode" | "ELM327 Command" | "Manufacturer";

interface Trick {
  title: string;
  category: TrickCategory;
  difficulty: "Easy" | "Medium" | "Advanced";
  makes?: string[];
  body: string;
  footnote: string;
}

const CAT_COLORS: Record<TrickCategory, string> = {
  "Pin Jump": "#FFB300",
  "Diagnostic Mode": "#00BCD4",
  "ELM327 Command": "#4CAF50",
  Manufacturer: "#9C27B0",
};

const TRICKS: Trick[] = [
  {
    title: "Verify OBD2 Power: Pin 16 → 12V Always-On",
    category: "Pin Jump",
    difficulty: "Easy",
    makes: ["All"],
    body: "OBD2 pin 16 is unswitched battery power (always on regardless of ignition). Use a multimeter to confirm 12V between pin 16 (+) and pin 4 or 5 (ground) before connecting any scan tool. If voltage is absent or low, suspect a blown fuse or wiring fault.",
    footnote: "Pin 16 (+), Pin 4 Chassis GND, Pin 5 Signal GND",
  },
  {
    title: "CAN Bus Health Check: Pin 6 vs Pin 14",
    category: "Pin Jump",
    difficulty: "Easy",
    makes: ["All"],
    body: "On any CAN vehicle, you can verify the CAN bus is alive using a multimeter. With ignition ON, CAN High should sit ~2.5–3.5V and CAN Low ~1.5–2.5V. Differential should be ~2V. If both lines read identical voltage, a node is pulling the bus. If both read 0V, check battery and fuses.",
    footnote: "Pin 6: CAN High, Pin 14: CAN Low",
  },
  {
    title: "Toyota / Lexus: Bridge TE1 to E1 for Diagnostic Mode",
    category: "Diagnostic Mode",
    difficulty: "Easy",
    makes: ["Toyota", "Lexus"],
    body: "On pre-2005 Toyota and Lexus with the OBDI-style 17-pin diagnostic connector (in addition to OBDII), shorting TE1 to E1 forces the ECM into diagnostic mode. The check engine light will flash stored DTC codes in two-digit patterns (tens digit then units digit). Count the flashes to decode codes without a scan tool.",
    footnote: "17-pin Toyota/Lexus diagnostic connector: TE1 → E1",
  },
  {
    title: "Honda: Short Service Check Connector to Enter Diagnostic Mode",
    category: "Diagnostic Mode",
    difficulty: "Easy",
    makes: ["Honda", "Acura"],
    body: "Honda OBDI vehicles (pre-1996) have a 2-pin 'Service Check Connector' usually located under the dashboard on the passenger side. Shorting these two pins with a jumper wire forces the ECM into self-diagnostic mode. The MIL will flash two-digit DTC codes. Consult Honda service data for code definitions.",
    footnote: "2-pin SCS connector: short both pins",
  },
  {
    title: "GM: ALDL 12-Pin Connector Diagnostic Enable",
    category: "Diagnostic Mode",
    difficulty: "Easy",
    makes: ["GM", "Chevrolet", "Buick", "Oldsmobile"],
    body: "Pre-OBD2 GM vehicles (pre-1996) used the ALDL (Assembly Line Diagnostic Link) connector. Jumping pin A (ground) to pin B (diagnostic enable) with the key ON and engine off puts the ECM into field service mode. The 'Check Engine' light will flash DTC codes. Some vehicles require the serial data line for full communication.",
    footnote: "ALDL pin A (GND) → pin B (Diag Enable)",
  },
  {
    title: "ELM327 ATMA — Monitor All Traffic",
    category: "ELM327 Command",
    difficulty: "Medium",
    body: "Send 'ATMA' to the ELM327 to enter Monitor All mode. The adapter will continuously receive and display all bus traffic without sending any requests. Useful for sniffing unsolicited messages like broadcast RPM, transmission data, and body control events. Send any character to stop.",
    footnote: "AT command: ATMA (press any key to exit)",
  },
  {
    title: "ELM327 ATSH — Set Header for Custom Addressing",
    category: "ELM327 Command",
    difficulty: "Advanced",
    body: "Use 'ATSH xyz' to manually set the 11-bit CAN header for requests. Standard OBD2 requests use header 7DF (functional) or 7E0–7E7 (physical). To address a specific module (e.g., ABS = 7A0, TCM = 7E1), set the header and then send raw PIDs directly. Combine with ATFCSH and ATFCSD for ISO-TP flow control on multi-frame responses.",
    footnote: "e.g., ATSH 7E1 → then '09 02' for VIN from TCM",
  },
  {
    title: "Ford: KOEO / KOER Self-Test via OBD1 EEC-IV",
    category: "Diagnostic Mode",
    difficulty: "Medium",
    makes: ["Ford", "Lincoln", "Mercury"],
    body: "Pre-1996 Ford EEC-IV uses Key On Engine Off (KOEO) and Key On Engine Running (KOER) self-tests accessible via the 6-pin or single-pin STI connector. Ground the STI pin to trigger tests. Codes are output as pulses on the SIGNAL RETURN wire. Use an analog voltmeter or LED to decode. Codes are separated by a single pulse divider and end with a code 11 (pass) or specific fault codes.",
    footnote: "EEC-IV STI pin to ground — read pulses on signal return",
  },
  {
    title: "OBD2 Pin Map Reference",
    category: "Pin Jump",
    difficulty: "Easy",
    makes: ["All"],
    body: "Standard OBD2 (J1962) 16-pin connector layout:\nPins 1, 3, 8, 9, 11, 12, 13 — OEM defined (varies by manufacturer)\nPin 2 — J1850 Bus+\nPin 4 — Chassis Ground\nPin 5 — Signal Ground\nPin 6 — CAN High (ISO 15765)\nPin 7 — K-Line (ISO 9141 / KWP2000)\nPin 10 — J1850 Bus–\nPin 14 — CAN Low (ISO 15765)\nPin 15 — L-Line (ISO 9141)\nPin 16 — Battery Power (12V constant)",
    footnote: "SAE J1962 Type A connector (12V) — Type B (hybrid/EV) adds notch",
  },
  {
    title: "ISO-TP Frame Structure for CAN Multi-Frame Responses",
    category: "ELM327 Command",
    difficulty: "Advanced",
    body: "CAN bus OBD2 uses ISO 15765-2 (ISO-TP) for multi-frame messages. Single frame: byte 0 is 0x0N where N = data length. First frame: byte 0 = 0x1x, byte 1 = total length. Flow control: 0x30 0x00 0x00. Consecutive: 0x2N where N increments 1–F then wraps. ELM327 handles this automatically, but use ATCAF0 to see raw CAN frames for debugging.",
    footnote: "CAN IDs: 7E0–7E7 (request), 7E8–7EF (response)",
  },
  {
    title: "Chrysler: DRBIII Protocol via CCD Bus (Pin 3)",
    category: "Diagnostic Mode",
    difficulty: "Advanced",
    makes: ["Chrysler", "Dodge", "Jeep", "Plymouth"],
    body: "Pre-2003 Chrysler vehicles use the Chrysler Collision Detection (CCD) bus for inter-module communication, accessible on pin 3 of the DLC. This is a two-wire differential 7812.5 baud bus. Standard OBD2 scanners cannot access it — you need a DRBIII or compatible tool. However, many post-1996 Chrysler vehicles also respond to standard OBD2 Mode 01–09 requests on the ISO 9141-2 bus simultaneously.",
    footnote: "CCD bus on pin 3 — requires DRBIII-compatible tool",
  },
  {
    title: "Subaru Select Monitor: K-Line Activation",
    category: "Diagnostic Mode",
    difficulty: "Medium",
    makes: ["Subaru"],
    body: "Older Subaru vehicles (pre-2004) use a proprietary K-Line protocol on the DLC. The Subaru Select Monitor communicates at 1953 baud (much slower than KWP2000). Connecting an ELM327 and sending ATSP4 (ISO 14230-4 KWP slow init) may allow partial communication. Full SSM access requires Subaru-specific software.",
    footnote: "ATSP4 (5-baud init) or ATSP5 (fast init) — SSM protocol",
  },
];

const ALL_CATEGORIES: ("All" | TrickCategory)[] = ["All", "Pin Jump", "Diagnostic Mode", "ELM327 Command", "Manufacturer"];

export default function SecretsScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"All" | TrickCategory>("All");
  const [searchText, setSearchText] = useState("");
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem(UNLOCK_KEY).then((val) => {
      if (val === "true") setUnlocked(true);
    });
  }, []);

  const handleUnlockTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setTapCount(0), UNLOCK_WINDOW);

    if (newCount >= UNLOCK_TAPS) {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setUnlocked(true);
      setTapCount(0);
      AsyncStorage.setItem(UNLOCK_KEY, "true");
    } else if (newCount >= 3) {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const filtered = TRICKS.filter((t) => {
    const catMatch = activeFilter === "All" || t.category === activeFilter;
    const searchMatch =
      !searchText ||
      t.title.toLowerCase().includes(searchText.toLowerCase()) ||
      t.body.toLowerCase().includes(searchText.toLowerCase()) ||
      (t.makes ?? []).some((m) => m.toLowerCase().includes(searchText.toLowerCase()));
    return catMatch && searchMatch;
  });

  if (!unlocked) {
    return (
      <View style={[styles.root, styles.lockedRoot, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
        <TouchableOpacity onPress={handleUnlockTap} style={styles.lockContent} activeOpacity={0.95}>
          <View style={[styles.lockIconWrap, tapCount >= 3 && styles.lockIconWrapActive]}>
            <Feather name="zap" size={40} color={tapCount >= 3 ? "#FFB300" : "#333"} />
          </View>
          <Text style={styles.lockTitle}>Technician Access</Text>
          <Text style={styles.lockSub}>This section contains advanced diagnostic techniques.</Text>
          {tapCount >= 3 && tapCount < UNLOCK_TAPS ? (
            <Text style={styles.lockHint}>
              {UNLOCK_TAPS - tapCount} more to unlock...
            </Text>
          ) : (
            <Text style={styles.lockHint2}>Tap here to continue</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0) }]}>
      {/* Search */}
      <View style={styles.searchRow}>
        <Feather name="search" size={15} color="#555" />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search tricks, makes, keywords..."
          placeholderTextColor="#444"
        />
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContent}
      >
        {ALL_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.filterPill,
              activeFilter === cat && styles.filterPillActive,
              activeFilter === cat && cat !== "All" && { borderColor: CAT_COLORS[cat as TrickCategory] },
            ]}
            onPress={() => setActiveFilter(cat)}
          >
            <Text
              style={[
                styles.filterPillText,
                activeFilter === cat && {
                  color: cat === "All" ? "#00BCD4" : CAT_COLORS[cat as TrickCategory],
                },
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
        <Text style={styles.trickCount}>{filtered.length} tricks · 0 custom</Text>

        {filtered.map((trick, i) => (
          <View key={i} style={styles.trickCard}>
            <View style={styles.trickMeta}>
              <View style={[styles.catBadge, { borderColor: CAT_COLORS[trick.category] + "60", backgroundColor: CAT_COLORS[trick.category] + "15" }]}>
                <View style={[styles.catDot, { backgroundColor: CAT_COLORS[trick.category] }]} />
                <Text style={[styles.catLabel, { color: CAT_COLORS[trick.category] }]}>{trick.category}</Text>
              </View>
              <View style={[
                styles.diffBadge,
                { backgroundColor: trick.difficulty === "Easy" ? "#4CAF5020" : trick.difficulty === "Medium" ? "#FFB30020" : "#F4433620" },
              ]}>
                <Text style={[
                  styles.diffLabel,
                  { color: trick.difficulty === "Easy" ? "#4CAF50" : trick.difficulty === "Medium" ? "#FFB300" : "#F44336" },
                ]}>
                  {trick.difficulty}
                </Text>
              </View>
            </View>
            <Text style={styles.trickTitle}>{trick.title}</Text>
            {trick.makes && (
              <View style={styles.makesRow}>
                {trick.makes.map((m) => (
                  <View key={m} style={styles.makeBadge}>
                    <Text style={styles.makeLabel}>{m}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.trickBody}>{trick.body}</Text>
            <View style={styles.footnoteBox}>
              <Feather name="cpu" size={12} color="#555" />
              <Text style={styles.footnoteText}>{trick.footnote}</Text>
            </View>
          </View>
        ))}
        <View style={{ height: Platform.OS === "web" ? 34 : 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  lockedRoot: { alignItems: "center", justifyContent: "center" },
  lockContent: { alignItems: "center", gap: 14, padding: 40 },
  lockIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111111",
    marginBottom: 8,
  },
  lockIconWrapActive: { borderColor: "#FFB30050", backgroundColor: "#FFB30010" },
  lockTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  lockSub: { color: "#444", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 260 },
  lockHint: { color: "#FFB300", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 8 },
  lockHint2: { color: "#2A2A2A", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#111111",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1A1A",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  filterScroll: { maxHeight: 44, borderBottomWidth: 1, borderBottomColor: "#1A1A1A" },
  filterContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  filterPill: {
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
  scrollContent: { padding: 14, gap: 12 },
  trickCount: { color: "#555", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  trickCard: {
    backgroundColor: "#141414",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1E1E1E",
    gap: 8,
  },
  trickMeta: { flexDirection: "row", gap: 8, alignItems: "center" },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  catLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  diffLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  trickTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  makesRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  makeBadge: {
    backgroundColor: "#1E1E1E",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  makeLabel: { color: "#888", fontSize: 11, fontFamily: "Inter_400Regular" },
  trickBody: {
    color: "#AAAAAA",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },
  footnoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0D0D0D",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#1A1A1A",
  },
  footnoteText: { color: "#666", fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
});
