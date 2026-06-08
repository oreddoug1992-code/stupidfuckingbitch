import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
  disconnect: () => void;
  clearDTCs: () => void;
  readDTCs: () => void;
  readIMReadiness: () => void;
  readMisfires: () => void;
  readFreezeFrame: () => void;
  lookupVIN: (vin: string) => void;
  runBiDiTest: (testName: string) => Promise<string>;
  runServiceCommand: (commandName: string) => Promise<string>;
  readFromECU: () => void;
  ecuInfo: { protocol: string; ecuName: string; calId: string; cvn: string } | null;
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
  const [vinResult, setVinResult] = useState<Record<string, string> | null>(
    null,
  );
  const [vinLoading, setVinLoading] = useState(false);
  const [ecuInfo, setEcuInfo] = useState<OBDContextValue["ecuInfo"]>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const demoTickRef = useRef(0);

  const startDemoSimulation = useCallback(() => {
    demoIntervalRef.current = setInterval(() => {
      demoTickRef.current += 1;
      const t = demoTickRef.current;
      const rpm = Math.round(800 + Math.sin(t * 0.08) * 1200 + Math.sin(t * 0.23) * 300);
      const speed = 0;
      setSensorData({
        rpm: Math.max(700, rpm),
        speed,
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

  const connect = useCallback(
    (type: ConnectionType) => {
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

  const disconnect = useCallback(() => {
    stopDemoSimulation();
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
  }, [stopDemoSimulation]);

  const clearDTCs = useCallback(() => {
    setDTCs([]);
  }, []);

  const readDTCs = useCallback(() => {
    if (connectionState === "demo") {
      setDTCs(DEMO_DTCS);
    }
  }, [connectionState]);

  const readIMReadiness = useCallback(() => {
    if (connectionState === "demo") {
      setTimeout(() => setIMReadiness(DEMO_IM), 800);
    }
  }, [connectionState]);

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

  const readFromECU = useCallback(() => {
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
    }
  }, [connectionState]);

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
    async (testName: string): Promise<string> => {
      if (connectionState !== "demo" && connectionState !== "connected") {
        return "NOT_CONNECTED";
      }
      await new Promise((r) => setTimeout(r, 1500));
      return "SUCCESS";
    },
    [connectionState],
  );

  const runServiceCommand = useCallback(
    async (commandName: string): Promise<string> => {
      if (connectionState !== "demo" && connectionState !== "connected") {
        return "NOT_CONNECTED";
      }
      await new Promise((r) => setTimeout(r, 2000));
      return "SUCCESS";
    },
    [connectionState],
  );

  useEffect(() => {
    return () => stopDemoSimulation();
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
