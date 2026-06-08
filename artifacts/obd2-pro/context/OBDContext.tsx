import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";

import { type BluetoothDevice, elm327 } from "@/services/ELM327Bluetooth";
import { parseDTCs, parseIMReadiness, parseOBDResponse } from "@/services/OBDParser";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "demo";
export type ConnectionType = "bluetooth" | "wifi" | "usb" | "demo";

export interface SensorData {
  rpm: number | null;
  speed: number | null;
  coolant: number | null;
  throttle: number | null;
  engineLoad: number | null;
  fuelLevel: number | null;
  battery: number | null;
  oilTemp: number | null;
  intakeTemp: number | null;
  map: number | null;
  maf: number | null;
  timingAdv: number | null;
  shortFuelTrim: number | null;
  longFuelTrim: number | null;
  o2Voltage: number | null;
  baroPressure: number | null;
}

export interface DTC {
  id: string;
  code: string;
  description: string;
  type: "stored" | "pending" | "permanent";
  severity: "high" | "medium" | "low";
  module: string;
}

export interface IMReadiness {
  name: string;
  status: "complete" | "incomplete" | "not_applicable";
}

export interface MisfireCounter {
  cylinder: number;
  count: number;
}

export interface FreezeFrameData {
  triggerCode: string;
  rpm: number;
  speed: number;
  coolant: number;
  throttle: number;
  engineLoad: number;
}

interface OBDContextValue {
  connectionState: ConnectionState;
  connectionType: ConnectionType | null;
  deviceName: string;
  protocol: string;
  protocolNumber: string;
  sensorData: SensorData;
  dtcs: DTC[];
  imReadiness: IMReadiness[];
  misfireCounters: MisfireCounter[];
  freezeFrame: FreezeFrameData | null;
  vinResult: Record<string, string> | null;
  vinLoading: boolean;
  connect: (type: ConnectionType) => void;
  connectBluetooth: (address: string, name: string) => Promise<{ success: boolean; error?: string }>;
  disconnect: () => Promise<void>;
  clearDTCs: () => Promise<void>;
  readDTCs: () => Promise<void>;
  readIMReadiness: () => Promise<void>;
  readMisfires: () => void;
  readFreezeFrame: () => void;
  lookupVIN: (vin: string) => void;
  runBiDiTest: (testName: string) => Promise<string>;
  runServiceCommand: (commandName: string) => Promise<string>;
  readFromECU: () => Promise<void>;
  ecuInfo: { protocol: string; ecuName: string; calId: string; cvn: string } | null;
  btDevices: BluetoothDevice[];
  btScanning: boolean;
  btError: string | null;
  scanBluetooth: () => Promise<void>;
}

const emptySensorData: SensorData = {
  rpm: null,
  speed: null,
  coolant: null,
  throttle: null,
  engineLoad: null,
  fuelLevel: null,
  battery: null,
  oilTemp: null,
  intakeTemp: null,
  map: null,
  maf: null,
  timingAdv: null,
  shortFuelTrim: null,
  longFuelTrim: null,
  o2Voltage: null,
  baroPressure: null,
};

const DEMO_DTCS: DTC[] = [
  {
    id: "1",
    code: "P0300",
    description: "Random/Multiple Cylinder Misfire Detected",
    type: "stored",
    severity: "high",
    module: "ECM",
  },
  {
    id: "2",
    code: "P0171",
    description: "System Too Lean (Bank 1)",
    type: "stored",
    severity: "medium",
    module: "ECM",
  },
  {
    id: "3",
    code: "P0420",
    description: "Catalyst System Efficiency Below Threshold (Bank 1)",
    type: "pending",
    severity: "medium",
    module: "ECM",
  },
];

const DEMO_IM: IMReadiness[] = [
  { name: "Catalyst Monitor", status: "complete" },
  { name: "Heated Catalyst", status: "not_applicable" },
  { name: "Evaporative System", status: "incomplete" },
  { name: "Secondary Air System", status: "not_applicable" },
  { name: "A/C Refrigerant", status: "not_applicable" },
  { name: "Oxygen Sensor", status: "complete" },
  { name: "O2 Sensor Heater", status: "complete" },
  { name: "EGR System", status: "complete" },
];

const DEMO_MISFIRES: MisfireCounter[] = [
  { cylinder: 1, count: 0 },
  { cylinder: 2, count: 0 },
  { cylinder: 3, count: 3 },
  { cylinder: 4, count: 0 },
  { cylinder: 5, count: 0 },
  { cylinder: 6, count: 0 },
];

const DEMO_FREEZE: FreezeFrameData = {
  triggerCode: "P0300",
  rpm: 1850,
  speed: 35,
  coolant: 91,
  throttle: 18,
  engineLoad: 42,
};

const DTC_DESCRIPTIONS: Record<string, { description: string; severity: "high" | "medium" | "low" }> = {
  P0300: { description: "Random/Multiple Cylinder Misfire Detected", severity: "high" },
  P0301: { description: "Cylinder 1 Misfire Detected", severity: "high" },
  P0302: { description: "Cylinder 2 Misfire Detected", severity: "high" },
  P0303: { description: "Cylinder 3 Misfire Detected", severity: "high" },
  P0304: { description: "Cylinder 4 Misfire Detected", severity: "high" },
  P0171: { description: "System Too Lean (Bank 1)", severity: "medium" },
  P0172: { description: "System Too Rich (Bank 1)", severity: "medium" },
  P0420: { description: "Catalyst System Efficiency Below Threshold (Bank 1)", severity: "medium" },
  P0440: { description: "Evaporative Emission Control System Malfunction", severity: "low" },
  P0442: { description: "Evaporative Emission System Leak Detected (small leak)", severity: "low" },
  P0455: { description: "Evaporative Emission System Leak Detected (large leak)", severity: "medium" },
};

const OBDContext = createContext<OBDContextValue | null>(null);

export function OBDProvider({ children }: { children: React.ReactNode }) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [connectionType, setConnectionType] = useState<ConnectionType | null>(
    null,
  );
  const [deviceName, setDeviceName] = useState("");
  const [protocol, setProtocol] = useState("");
  const [protocolNumber, setProtocolNumber] = useState("");
  const [sensorData, setSensorData] = useState<SensorData>(emptySensorData);
  const [dtcs, setDTCs] = useState<DTC[]>([]);
  const [imReadiness, setIMReadiness] = useState<IMReadiness[]>([]);
  const [misfireCounters, setMisfireCounters] = useState<MisfireCounter[]>([]);
  const [freezeFrame, setFreezeFrame] = useState<FreezeFrameData | null>(null);
  const [vinResult, setVinResult] = useState<Record<string, string> | null>(null);
  const [vinLoading, setVinLoading] = useState(false);
  const [ecuInfo, setEcuInfo] = useState<OBDContextValue["ecuInfo"]>(null);
  const [btDevices, setBtDevices] = useState<BluetoothDevice[]>([]);
  const [btScanning, setBtScanning] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTickRef = useRef(0);

  const startDemoSimulation = useCallback(() => {
    demoIntervalRef.current = setInterval(() => {
      demoTickRef.current += 1;
      const t = demoTickRef.current;
      const rpm = Math.round(800 + Math.sin(t * 0.08) * 1200 + Math.sin(t * 0.23) * 300);
      setSensorData({
        rpm: Math.max(700, rpm),
        speed: 0,
        coolant: Math.round(88 + Math.sin(t * 0.02) * 3),
        throttle: Math.round(3 + Math.abs(Math.sin(t * 0.1)) * 8),
        engineLoad: Math.round(18 + Math.sin(t * 0.07) * 12),
        fuelLevel: 74,
        battery: parseFloat((12.6 + Math.sin(t * 0.05) * 0.2).toFixed(1)),
        oilTemp: Math.round(85 + Math.sin(t * 0.03) * 5),
        intakeTemp: Math.round(28 + Math.sin(t * 0.04) * 4),
        map: Math.round(34 + Math.sin(t * 0.09) * 10),
        maf: parseFloat((3.2 + Math.abs(Math.sin(t * 0.11)) * 2.1).toFixed(1)),
        timingAdv: Math.round(14 + Math.sin(t * 0.06) * 5),
        shortFuelTrim: parseFloat((1.6 + Math.sin(t * 0.13) * 2.2).toFixed(1)),
        longFuelTrim: parseFloat((3.1 + Math.sin(t * 0.04) * 1.1).toFixed(1)),
        o2Voltage: parseFloat((0.45 + Math.sin(t * 0.19) * 0.35).toFixed(2)),
        baroPressure: 101,
      });
    }, 500);
  }, []);

  const stopDemoSimulation = useCallback(() => {
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current);
      demoIntervalRef.current = null;
    }
  }, []);

  const scanBluetooth = useCallback(async () => {
    if (Platform.OS === "web") {
      setBtError("Bluetooth is not available in the browser. Use the Android app.");
      return;
    }
    setBtScanning(true);
    setBtError(null);
    setBtDevices([]);
    try {
      const paired = await elm327.getPairedDevices();
      setBtDevices(paired);
      if (paired.length === 0) {
        setBtError("No paired Bluetooth devices found. Pair your ELM327 adapter in Android Bluetooth Settings first.");
      }
      elm327.startDiscovery((device) => {
        setBtDevices((prev) => {
          const exists = prev.some((d) => d.address === device.address);
          return exists ? prev : [...prev, device];
        });
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setBtError(msg);
    } finally {
      setBtScanning(false);
    }
  }, []);

  const connectBluetooth = useCallback(async (address: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setConnectionState("connecting");
    setConnectionType("bluetooth");
    setBtError(null);
    try {
      const result = await elm327.connect(address, name);
      if (!result.success) {
        setConnectionState("disconnected");
        setConnectionType(null);
        setBtError(result.error ?? "Connection failed");
        return { success: false, error: result.error };
      }

      setDeviceName(result.deviceName);
      setProtocol(result.protocol);
      setProtocolNumber(result.protocolNumber);
      setConnectionState("connected");

      elm327.startPolling(
        (data) => {
          setSensorData((prev) => ({ ...prev, ...data }));
        },
        (error) => {
          setBtError(error);
          setConnectionState("disconnected");
          setConnectionType(null);
          setDeviceName("");
          setProtocol("");
          setProtocolNumber("");
          setSensorData(emptySensorData);
        },
      );

      try {
        const storedRaw = await elm327.readDTCs();
        const pendingRaw = await elm327.readPendingDTCs();
        const storedParsed = parseDTCs(storedRaw, "stored");
        const pendingParsed = parseDTCs(pendingRaw, "pending");
        const allCodes = [...storedParsed, ...pendingParsed];
        const mapped: DTC[] = allCodes.map((d, i) => {
          const known = DTC_DESCRIPTIONS[d.code];
          return {
            id: String(i + 1),
            code: d.code,
            description: known?.description ?? "Unknown fault code",
            type: d.type,
            severity: known?.severity ?? "medium",
            module: "ECM",
          };
        });
        setDTCs(mapped);
      } catch {
        // DTC read failure is non-fatal
      }

      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setConnectionState("disconnected");
      setConnectionType(null);
      setBtError(msg);
      return { success: false, error: msg };
    }
  }, []);

  const connect = useCallback(
    (type: ConnectionType) => {
      if (type === "bluetooth") {
        return;
      }
      setConnectionState("connecting");
      setConnectionType(type);
      setTimeout(() => {
        if (type === "demo") {
          setConnectionState("demo");
          setDeviceName("Demo Mode");
          setProtocol("ISO 15765-4 CAN (11/500)");
          setProtocolNumber("6");
          setDTCs(DEMO_DTCS);
          startDemoSimulation();
        } else {
          setConnectionState("disconnected");
          setDeviceName("");
        }
      }, 1800);
    },
    [startDemoSimulation],
  );

  const disconnect = useCallback(async () => {
    stopDemoSimulation();
    if (connectionType === "bluetooth") {
      await elm327.disconnect();
    }
    setConnectionState("disconnected");
    setConnectionType(null);
    setDeviceName("");
    setProtocol("");
    setProtocolNumber("");
    setSensorData(emptySensorData);
    setDTCs([]);
    setIMReadiness([]);
    setMisfireCounters([]);
    setFreezeFrame(null);
    setEcuInfo(null);
    setBtError(null);
  }, [stopDemoSimulation, connectionType]);

  const clearDTCs = useCallback(async () => {
    if (connectionType === "bluetooth" && elm327.isConnected()) {
      try {
        await elm327.clearDTCs();
      } catch {
        // Ignore
      }
    }
    setDTCs([]);
  }, [connectionType]);

  const readDTCs = useCallback(async () => {
    if (connectionState === "demo") {
      setDTCs(DEMO_DTCS);
      return;
    }
    if (connectionType === "bluetooth" && elm327.isConnected()) {
      try {
        const storedRaw = await elm327.readDTCs();
        const pendingRaw = await elm327.readPendingDTCs();
        const allCodes = [
          ...parseDTCs(storedRaw, "stored"),
          ...parseDTCs(pendingRaw, "pending"),
        ];
        const mapped: DTC[] = allCodes.map((d, i) => {
          const known = DTC_DESCRIPTIONS[d.code];
          return {
            id: String(i + 1),
            code: d.code,
            description: known?.description ?? "Unknown fault code",
            type: d.type,
            severity: known?.severity ?? "medium",
            module: "ECM",
          };
        });
        setDTCs(mapped);
      } catch {
        // Ignore
      }
    }
  }, [connectionState, connectionType]);

  const readIMReadiness = useCallback(async () => {
    if (connectionState === "demo") {
      setTimeout(() => setIMReadiness(DEMO_IM), 800);
      return;
    }
    if (connectionType === "bluetooth" && elm327.isConnected()) {
      try {
        const raw = await elm327.readIMReadiness();
        const parsed = parseOBDResponse(raw);
        if (parsed) {
          const items = parseIMReadiness(parsed.data);
          setIMReadiness(items);
        }
      } catch {
        // Ignore
      }
    }
  }, [connectionState, connectionType]);

  const readMisfires = useCallback(() => {
    if (connectionState === "demo") {
      setTimeout(() => setMisfireCounters(DEMO_MISFIRES), 600);
    }
  }, [connectionState]);

  const readFreezeFrame = useCallback(() => {
    if (connectionState === "demo") {
      setTimeout(() => setFreezeFrame(DEMO_FREEZE), 700);
    }
  }, [connectionState]);

  const readFromECU = useCallback(async () => {
    if (connectionState === "demo") {
      setTimeout(
        () =>
          setEcuInfo({
            protocol: "ISO 15765-4 CAN (11/500)",
            ecuName: "PCM (Powertrain Control Module)",
            calId: "U3DK4A0A",
            cvn: "EA8B3F12",
          }),
        900,
      );
      return;
    }
    if (connectionType === "bluetooth" && elm327.isConnected()) {
      try {
        const protocolResp = await elm327.readECUName();
        setEcuInfo({
          protocol,
          ecuName: protocolResp.trim() || "Unknown ECU",
          calId: "N/A",
          cvn: "N/A",
        });
      } catch {
        // Ignore
      }
    }
  }, [connectionState, connectionType, protocol]);

  const lookupVIN = useCallback(async (vin: string) => {
    if (vin.length !== 17) return;
    setVinLoading(true);
    setVinResult(null);
    try {
      const res = await fetch(
        `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`,
      );
      const data = await res.json();
      const results: Record<string, string> = {};
      for (const item of data.Results ?? []) {
        if (item.Value && item.Value !== "Not Applicable" && item.Value !== "0" && item.Variable) {
          results[item.Variable] = item.Value;
        }
      }
      setVinResult(results);
    } catch {
      setVinResult({ Error: "Failed to fetch VIN data. Check connection." });
    } finally {
      setVinLoading(false);
    }
  }, []);

  const runBiDiTest = useCallback(
    async (_testName: string): Promise<string> => {
      if (connectionState !== "demo" && connectionState !== "connected") {
        return "NOT_CONNECTED";
      }
      await new Promise((r) => setTimeout(r, 1500));
      return "SUCCESS";
    },
    [connectionState],
  );

  const runServiceCommand = useCallback(
    async (_commandName: string): Promise<string> => {
      if (connectionState !== "demo" && connectionState !== "connected") {
        return "NOT_CONNECTED";
      }
      await new Promise((r) => setTimeout(r, 2000));
      return "SUCCESS";
    },
    [connectionState],
  );

  useEffect(() => {
    return () => {
      stopDemoSimulation();
      elm327.disconnect().catch(() => {});
    };
  }, [stopDemoSimulation]);

  return (
    <OBDContext.Provider
      value={{
        connectionState,
        connectionType,
        deviceName,
        protocol,
        protocolNumber,
        sensorData,
        dtcs,
        imReadiness,
        misfireCounters,
        freezeFrame,
        vinResult,
        vinLoading,
        connect,
        connectBluetooth,
        disconnect,
        clearDTCs,
        readDTCs,
        readIMReadiness,
        readMisfires,
        readFreezeFrame,
        lookupVIN,
        runBiDiTest,
        runServiceCommand,
        readFromECU,
        ecuInfo,
        btDevices,
        btScanning,
        btError,
        scanBluetooth,
      }}
    >
      {children}
    </OBDContext.Provider>
  );
}

export function useOBD() {
  const ctx = useContext(OBDContext);
  if (!ctx) throw new Error("useOBD must be used within OBDProvider");
  return ctx;
}
