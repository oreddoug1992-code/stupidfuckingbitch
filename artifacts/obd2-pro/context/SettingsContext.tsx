import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const SETTINGS_KEY = "obd2pro_settings_v2";

export type UnitSystem = "metric" | "imperial";
export type PollingRate = 250 | 500 | 1000 | 2000;
export type PreferredProtocol =
  | "auto"
  | "can_11_500"
  | "can_29_500"
  | "can_11_250"
  | "iso9141"
  | "kwp2000"
  | "j1850_vpw"
  | "j1850_pwm";
export type MaxRPM = 6000 | 8000 | 10000 | 12000;
export type MaxSpeed = 120 | 160 | 200 | 260;

export interface AppSettings {
  unitSystem: UnitSystem;
  maxRpm: MaxRPM;
  maxSpeed: MaxSpeed;
  pollingRateMs: PollingRate;
  preferredProtocol: PreferredProtocol;
  autoConnect: boolean;
  showProtocolInDashboard: boolean;
  alertsEnabled: boolean;
  overheatThreshold: number;
  lowFuelThreshold: number;
  hapticFeedback: boolean;
  keepScreenOn: boolean;
  logDataEnabled: boolean;
  showPcmBlockNumbers: boolean;
  darkGaugeAccent: string;
}

const DEFAULTS: AppSettings = {
  unitSystem: "metric",
  maxRpm: 8000,
  maxSpeed: 200,
  pollingRateMs: 500,
  preferredProtocol: "auto",
  autoConnect: false,
  showProtocolInDashboard: true,
  alertsEnabled: true,
  overheatThreshold: 105,
  lowFuelThreshold: 15,
  hapticFeedback: true,
  keepScreenOn: true,
  logDataEnabled: false,
  showPcmBlockNumbers: true,
  darkGaugeAccent: "#00BCD4",
};

interface SettingsContextValue {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) {
        try {
          setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
        } catch {}
      }
    });
  }, []);

  const save = useCallback(async (next: AppSettings) => {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  }, []);

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        save(next);
        return next;
      });
    },
    [save],
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    save(DEFAULTS);
  }, [save]);

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
