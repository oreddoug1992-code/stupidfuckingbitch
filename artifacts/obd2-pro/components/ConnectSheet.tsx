import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type BluetoothDevice } from "@/services/ELM327Bluetooth";
import { ConnectionType, useOBD } from "@/context/OBDContext";

interface ConnectSheetProps {
  visible: boolean;
  onClose: () => void;
}

type Screen = "main" | "bluetooth";

const OPTIONS: { type: ConnectionType; label: string; sub: string; icon: keyof typeof Feather.glyphMap }[] = [
  { type: "bluetooth", label: "Bluetooth", sub: "Scan for nearby ELM327 adapters", icon: "bluetooth" },
  { type: "wifi", label: "Wi-Fi", sub: "TCP socket to 192.168.0.10:35000", icon: "wifi" },
  { type: "usb", label: "USB / OTG", sub: "Serial over USB via UsbManager", icon: "usb" as keyof typeof Feather.glyphMap },
  { type: "demo", label: "Demo Mode", sub: "Preview all features without hardware", icon: "play-circle" },
];

export function ConnectSheet({ visible, onClose }: ConnectSheetProps) {
  const { connect, connectBluetooth, connectionState, btDevices, btScanning, btError, scanBluetooth } = useOBD();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>("main");
  const [connecting, setConnecting] = useState(false);
  const [connectingAddress, setConnectingAddress] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setTimeout(() => {
        setScreen("main");
        setConnecting(false);
        setConnectingAddress(null);
      }, 300);
    }
  }, [visible]);

  useEffect(() => {
    if (screen === "bluetooth" && visible) {
      scanBluetooth();
    }
  }, [screen, visible, scanBluetooth]);

  const handleMainOption = async (type: ConnectionType) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (type === "bluetooth") {
      setScreen("bluetooth");
      return;
    }
    setConnecting(true);
    connect(type);
    setTimeout(() => {
      setConnecting(false);
      onClose();
    }, 1900);
  };

  const handleDeviceConnect = async (device: BluetoothDevice) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConnectingAddress(device.address);
    setConnecting(true);
    const result = await connectBluetooth(device.address, device.name);
    setConnecting(false);
    setConnectingAddress(null);
    if (result.success) {
      onClose();
    }
    // On failure: stay on the bluetooth screen so btError is visible
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={screen === "main" ? onClose : undefined}
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          {screen === "main" ? (
            <>
              <Text style={styles.title}>Connect to ELM327</Text>
              {OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.type}
                  style={[styles.option, opt.type === "demo" && styles.optionDemo]}
                  onPress={() => handleMainOption(opt.type)}
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
            </>
          ) : (
            <>
              <View style={styles.btHeader}>
                <TouchableOpacity
                  onPress={() => setScreen("main")}
                  style={styles.backBtn}
                  disabled={connecting}
                >
                  <Feather name="arrow-left" size={20} color="#00BCD4" />
                </TouchableOpacity>
                <Text style={styles.title}>Bluetooth Devices</Text>
                <TouchableOpacity
                  onPress={scanBluetooth}
                  style={styles.scanBtn}
                  disabled={btScanning || connecting}
                >
                  {btScanning ? (
                    <ActivityIndicator size="small" color="#00BCD4" />
                  ) : (
                    <Feather name="refresh-cw" size={18} color="#00BCD4" />
                  )}
                </TouchableOpacity>
              </View>

              <Text style={styles.btHint}>
                Paired ELM327 adapters appear below. To add a new adapter, pair it in{" "}
                <Text style={styles.btHintBold}>Android Settings → Bluetooth</Text> first.
              </Text>

              <ScrollView
                style={styles.deviceList}
                contentContainerStyle={styles.deviceListContent}
                showsVerticalScrollIndicator={false}
              >
                {btScanning && btDevices.length === 0 && (
                  <View style={styles.scanningRow}>
                    <ActivityIndicator color="#00BCD4" size="small" />
                    <Text style={styles.scanningText}>Scanning for devices…</Text>
                  </View>
                )}

                {!btScanning && btDevices.length === 0 && !btError && (
                  <View style={styles.emptyRow}>
                    <Feather name="bluetooth" size={32} color="#333" />
                    <Text style={styles.emptyText}>No paired devices found</Text>
                    <Text style={styles.emptySub}>Pair your ELM327 adapter in Android Bluetooth Settings</Text>
                  </View>
                )}

                {btError && btDevices.length === 0 && (
                  <View style={styles.errorRow}>
                    <Feather name="alert-circle" size={20} color="#FF5252" />
                    <Text style={styles.errorText}>{btError}</Text>
                  </View>
                )}

                {btDevices.map((device) => {
                  const isConnectingThis = connectingAddress === device.address;
                  return (
                    <TouchableOpacity
                      key={device.address}
                      style={[styles.deviceRow, isConnectingThis && styles.deviceRowActive]}
                      onPress={() => handleDeviceConnect(device)}
                      activeOpacity={0.7}
                      disabled={connecting}
                    >
                      <View style={styles.deviceIcon}>
                        <Feather name="bluetooth" size={18} color="#00BCD4" />
                      </View>
                      <View style={styles.deviceInfo}>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceAddress}>{device.address}</Text>
                        {device.bonded && (
                          <View style={styles.pairedBadge}>
                            <Text style={styles.pairedBadgeText}>PAIRED</Text>
                          </View>
                        )}
                      </View>
                      {isConnectingThis ? (
                        <ActivityIndicator size="small" color="#00BCD4" />
                      ) : (
                        <Feather name="chevron-right" size={18} color="#444" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {btError && btDevices.length > 0 && (
                <View style={styles.errorBanner}>
                  <Feather name="alert-circle" size={14} color="#FF5252" />
                  <Text style={styles.errorBannerText}>{btError}</Text>
                </View>
              )}
            </>
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
    maxHeight: "85%",
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
    flex: 1,
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
  btHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
    marginBottom: 16,
  },
  scanBtn: {
    padding: 4,
    marginBottom: 16,
    width: 30,
    alignItems: "center",
  },
  btHint: {
    color: "#555",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
    lineHeight: 18,
  },
  btHintBold: {
    color: "#777",
    fontFamily: "Inter_600SemiBold",
  },
  deviceList: {
    maxHeight: 320,
  },
  deviceListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  scanningRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 32,
  },
  scanningText: {
    color: "#666",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
  },
  emptyRow: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    color: "#555",
    fontFamily: "Inter_500Medium",
    fontSize: 14,
  },
  emptySub: {
    color: "#444",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FF525210",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FF525230",
  },
  errorText: {
    color: "#FF5252",
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF525210",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#FF525230",
  },
  errorBannerText: {
    color: "#FF5252",
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    flex: 1,
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#252525",
    gap: 12,
  },
  deviceRowActive: {
    borderColor: "#00BCD4",
    backgroundColor: "#00BCD410",
  },
  deviceIcon: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#00BCD415",
    alignItems: "center",
    justifyContent: "center",
  },
  deviceInfo: { flex: 1 },
  deviceName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  deviceAddress: {
    color: "#555",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pairedBadge: {
    marginTop: 4,
    backgroundColor: "#00BCD420",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
  pairedBadgeText: {
    color: "#00BCD4",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
