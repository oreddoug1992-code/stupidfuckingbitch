import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConnectionType, useOBD } from "@/context/OBDContext";

interface ConnectSheetProps {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: { type: ConnectionType; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { type: "bluetooth", label: "Bluetooth", sub: "Pair a Bluetooth ELM327 adapter", icon: "bluetooth" },
  { type: "wifi", label: "Wi-Fi", sub: "TCP socket to 192.168.0.10:35000", icon: "wifi" },
  { type: "usb", label: "USB / OTG", sub: "Serial over USB via UsbManager", icon: "usb" as keyof typeof Feather.glyphMap },
  { type: "demo", label: "Demo Mode", sub: "Preview all features without hardware", icon: "play-circle" },
];

export function ConnectSheet({ visible, onClose }: ConnectSheetProps) {
  const { connect, connectionState } = useOBD();
  const insets = useSafeAreaInsets();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async (type: ConnectionType) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConnecting(true);
    connect(type);
    setTimeout(() => {
      setConnecting(false);
      onClose();
    }, 1900);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Connect to ELM327</Text>
          {OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.type}
              style={[styles.option, opt.type === "demo" && styles.optionDemo]}
              onPress={() => handleConnect(opt.type)}
              activeOpacity={0.7}
              disabled={connecting}
            >
              <View style={[styles.iconWrap, opt.type === "demo" && styles.iconWrapDemo]}>
                <Feather name={opt.icon} size={20} color={opt.type === "demo" ? "#000" : "#00BCD4"} />
              </View>
              <View style={styles.optionText}>
                <Text style={[styles.optionLabel, opt.type === "demo" && styles.optionLabelDemo]}>
                  {opt.label}
                </Text>
                <Text style={styles.optionSub}>{opt.sub}</Text>
              </View>
              {connecting ? null : (
                <Feather name="chevron-right" size={18} color="#444" />
              )}
            </TouchableOpacity>
          ))}
          {connecting && (
            <View style={styles.connectingRow}>
              <ActivityIndicator color="#00BCD4" size="small" />
              <Text style={styles.connectingText}>Connecting...</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111111",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: "#333",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#252525",
  },
  optionDemo: {
    borderColor: "#00BCD4",
    backgroundColor: "#00BCD410",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#00BCD415",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconWrapDemo: {
    backgroundColor: "#00BCD4",
  },
  optionText: { flex: 1 },
  optionLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  optionLabelDemo: {
    color: "#00BCD4",
  },
  optionSub: {
    color: "#666",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  connectingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  connectingText: {
    color: "#00BCD4",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
});
