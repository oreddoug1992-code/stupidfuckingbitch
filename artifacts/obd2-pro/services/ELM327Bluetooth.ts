import { Platform } from "react-native";

export interface BluetoothDevice {
  address: string;
  name: string;
  bonded: boolean;
}

export interface ELM327ConnectionResult {
  success: boolean;
  protocol: string;
  protocolNumber: string;
  deviceName: string;
  error?: string;
}

export interface PIDReadResult {
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

const COMMAND_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 400;

const PROTOCOL_NAMES: Record<string, string> = {
  "0": "Auto",
  "1": "SAE J1850 PWM",
  "2": "SAE J1850 VPW",
  "3": "ISO 9141-2",
  "4": "ISO 14230-4 KWP (5-baud init)",
  "5": "ISO 14230-4 KWP (fast init)",
  "6": "ISO 15765-4 CAN (11/500)",
  "7": "ISO 15765-4 CAN (29/500)",
  "8": "ISO 15765-4 CAN (11/250)",
  "9": "ISO 15765-4 CAN (29/250)",
  A: "SAE J1939 CAN",
};

const PID_LIST: Array<{ pid: string; key: keyof PIDReadResult }> = [
  { pid: "010C", key: "rpm" },
  { pid: "010D", key: "speed" },
  { pid: "0105", key: "coolant" },
  { pid: "0111", key: "throttle" },
  { pid: "0104", key: "engineLoad" },
  { pid: "012F", key: "fuelLevel" },
  { pid: "0142", key: "battery" },
  { pid: "015C", key: "oilTemp" },
  { pid: "010F", key: "intakeTemp" },
  { pid: "010B", key: "map" },
  { pid: "0110", key: "maf" },
  { pid: "010E", key: "timingAdv" },
  { pid: "0106", key: "shortFuelTrim" },
  { pid: "0107", key: "longFuelTrim" },
  { pid: "0114", key: "o2Voltage" },
  { pid: "0133", key: "baroPressure" },
];

type DataCallback = (data: Partial<PIDReadResult>) => void;
type ErrorCallback = (error: string) => void;

interface QueuedCommand {
  cmd: string;
  timeoutMs: number;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
}

function getRNBTClassic() {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-bluetooth-classic");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

class ELM327BluetoothService {
  private device: {
    address: string;
    name: string;
    write: (data: string) => Promise<void>;
    available: () => Promise<number>;
    read: () => Promise<string | null>;
    disconnect: () => Promise<void>;
  } | null = null;

  // Serialized command queue — only one command in-flight at a time
  private cmdQueue: QueuedCommand[] = [];
  private cmdRunning = false;

  private pollingTimer: ReturnType<typeof setTimeout> | null = null;
  private pollingActive = false;
  private pidIndex = 0;
  private accumulated: Partial<PIDReadResult> = {};
  private onDataCallback: DataCallback | null = null;
  private onErrorCallback: ErrorCallback | null = null;

  async getPairedDevices(): Promise<BluetoothDevice[]> {
    const RNBTClassic = getRNBTClassic();
    if (!RNBTClassic) return [];
    try {
      const enabled = await RNBTClassic.isBluetoothEnabled();
      if (!enabled) {
        await RNBTClassic.requestBluetoothEnabled();
      }
      const bonded: Array<{ address: string; name: string }> =
        await RNBTClassic.getBondedDevices();
      return bonded.map((d) => ({ address: d.address, name: d.name ?? d.address, bonded: true }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to list paired devices: ${msg}`);
    }
  }

  async startDiscovery(onFound: (d: BluetoothDevice) => void): Promise<void> {
    const RNBTClassic = getRNBTClassic();
    if (!RNBTClassic) return;
    try {
      const devices: Array<{ address: string; name: string }> =
        await RNBTClassic.startDiscovery();
      for (const d of devices) {
        onFound({ address: d.address, name: d.name ?? d.address, bonded: false });
      }
    } catch {
      // Discovery cancelled or timed out — ignore
    }
  }

  async cancelDiscovery(): Promise<void> {
    const RNBTClassic = getRNBTClassic();
    if (!RNBTClassic) return;
    try {
      await RNBTClassic.cancelDiscovery();
    } catch {
      // Ignore
    }
  }

  async connect(address: string, name: string): Promise<ELM327ConnectionResult> {
    const RNBTClassic = getRNBTClassic();
    if (!RNBTClassic) {
      return { success: false, protocol: "", protocolNumber: "", deviceName: name, error: "Bluetooth not available on this platform" };
    }

    try {
      const rawDevice = await RNBTClassic.connectToDevice(address, {
        delimiter: ">",
        charset: "utf-8",
      });

      this.device = rawDevice;

      const handshakeResult = await this.runHandshake();
      if (!handshakeResult.success) {
        await this.device?.disconnect().catch(() => {});
        this.device = null;
        return { success: false, protocol: "", protocolNumber: "", deviceName: name, error: handshakeResult.error };
      }

      return {
        success: true,
        protocol: handshakeResult.protocol,
        protocolNumber: handshakeResult.protocolNumber,
        deviceName: name,
      };
    } catch (e: unknown) {
      this.device = null;
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, protocol: "", protocolNumber: "", deviceName: name, error: `Connection failed: ${msg}` };
    }
  }

  /**
   * Enqueue a command so it is sent only when no other command is in-flight.
   * This prevents concurrent writes/reads on the serial stream.
   */
  private enqueueCommand(cmd: string, timeoutMs = COMMAND_TIMEOUT_MS): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.cmdQueue.push({ cmd, timeoutMs, resolve, reject });
      this.drainQueue();
    });
  }

  private drainQueue(): void {
    if (this.cmdRunning || this.cmdQueue.length === 0) return;
    const entry = this.cmdQueue.shift()!;
    this.cmdRunning = true;
    this.execCommand(entry.cmd, entry.timeoutMs)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.cmdRunning = false;
        this.drainQueue();
      });
  }

  private async execCommand(cmd: string, timeoutMs: number): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    await this.device.write(cmd + "\r");
    return this.waitForPrompt(timeoutMs);
  }

  private async waitForPrompt(timeoutMs: number): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    let accumulated = "";
    while (Date.now() < deadline) {
      const chunk = await this.device!.read();
      if (chunk) {
        accumulated += chunk;
        if (accumulated.includes(">")) {
          return accumulated.replace(">", "").replace(/\r\n/g, "\n").trim();
        }
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error("Command timeout");
  }

  private async runHandshake(): Promise<{ success: boolean; protocol: string; protocolNumber: string; error?: string }> {
    try {
      await this.enqueueCommand("ATZ", 5000);
      await this.enqueueCommand("ATE0");
      await this.enqueueCommand("ATL0");
      await this.enqueueCommand("ATS0");
      await this.enqueueCommand("ATH0");
      await this.enqueueCommand("ATSP0");
      await this.enqueueCommand("0100", 5000);

      const protocolResp = await this.enqueueCommand("ATDPN");
      const protocolNumber = protocolResp.replace(/[^0-9A-Fa-f]/g, "").trim() || "0";
      const protocol = PROTOCOL_NAMES[protocolNumber.toUpperCase()] ?? `Protocol ${protocolNumber}`;

      return { success: true, protocol, protocolNumber };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, protocol: "", protocolNumber: "", error: `ELM327 handshake failed: ${msg}` };
    }
  }

  startPolling(onData: DataCallback, onError: ErrorCallback): void {
    this.onDataCallback = onData;
    this.onErrorCallback = onError;
    this.pollingActive = true;
    this.pidIndex = 0;
    this.accumulated = {};
    this.scheduleNextPoll();
  }

  /**
   * Schedule polling using setTimeout (not setInterval) so the next tick
   * is only queued after the current one fully completes — naturally
   * preventing command overlap even before the queue serializer.
   */
  private scheduleNextPoll(): void {
    if (!this.pollingActive) return;
    this.pollingTimer = setTimeout(() => this.runNextPoll(), POLL_INTERVAL_MS);
  }

  private async runNextPoll(): Promise<void> {
    if (!this.pollingActive || !this.device) {
      if (!this.device && this.pollingActive) {
        this.pollingActive = false;
        this.onErrorCallback?.("Device disconnected");
      }
      return;
    }

    const { pid, key } = PID_LIST[this.pidIndex % PID_LIST.length];
    this.pidIndex++;

    try {
      const resp = await this.enqueueCommand(pid, 1500);
      const value = this.parseResponse(pid, resp);
      if (value !== null) {
        this.accumulated = { ...this.accumulated, [key]: value };
        this.onDataCallback?.({ ...this.accumulated });
      }
    } catch {
      // Skip unsupported PIDs silently
    }

    // Schedule the next poll only after this one finishes
    this.scheduleNextPoll();
  }

  private parseResponse(pid: string, raw: string): number | null {
    const pidNum = parseInt(pid.slice(2), 16);
    const cleaned = raw.replace(/[>?\r\n]/g, " ").trim();
    const parts = cleaned.split(/\s+/).filter((p) => /^[0-9A-Fa-f]{2}$/.test(p));
    if (parts.length < 3) return null;

    const responseMode = parseInt(parts[0], 16);
    const responsePid = parseInt(parts[1], 16);
    if (responseMode !== 0x41) return null;
    if (responsePid !== pidNum) return null;

    const data = parts.slice(2).map((p) => parseInt(p, 16));
    const A = data[0] ?? 0;
    const B = data[1] ?? 0;

    switch (pidNum) {
      case 0x0c: return (A * 256 + B) / 4;
      case 0x0d: return A;
      case 0x05: return A - 40;
      case 0x11: return Math.round((A * 100) / 255);
      case 0x04: return Math.round((A * 100) / 255);
      case 0x2f: return Math.round((A * 100) / 255);
      case 0x42: return parseFloat(((256 * A + B) / 1000).toFixed(1));
      case 0x5c: return A - 40;
      case 0x0f: return A - 40;
      case 0x0b: return A;
      case 0x10: return parseFloat(((256 * A + B) / 100).toFixed(1));
      case 0x0e: return parseFloat((A / 2 - 64).toFixed(1));
      case 0x06: return parseFloat((((A - 128) * 100) / 128).toFixed(1));
      case 0x07: return parseFloat((((A - 128) * 100) / 128).toFixed(1));
      case 0x14: return parseFloat((A / 200).toFixed(2));
      case 0x33: return A;
      default: return null;
    }
  }

  async readDTCs(): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    return this.enqueueCommand("03", 4000);
  }

  async readPendingDTCs(): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    return this.enqueueCommand("07", 4000);
  }

  async clearDTCs(): Promise<void> {
    if (!this.device) throw new Error("Not connected");
    await this.enqueueCommand("04", 4000);
  }

  async readIMReadiness(): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    return this.enqueueCommand("0101", 4000);
  }

  async readVIN(): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    return this.enqueueCommand("0902", 5000);
  }

  async readECUName(): Promise<string> {
    if (!this.device) throw new Error("Not connected");
    return this.enqueueCommand("0904", 4000);
  }

  stopPolling(): void {
    this.pollingActive = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }
    // Drain any queued poll commands
    this.cmdQueue.length = 0;
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    if (this.device) {
      try {
        await this.device.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.device = null;
    }
    this.accumulated = {};
    this.pidIndex = 0;
    this.onDataCallback = null;
    this.onErrorCallback = null;
    this.cmdRunning = false;
    this.cmdQueue.length = 0;
  }

  isConnected(): boolean {
    return this.device !== null;
  }
}

export const elm327 = new ELM327BluetoothService();
