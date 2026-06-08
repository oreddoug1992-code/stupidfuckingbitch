export interface ParsedPID {
  pid: string;
  value: number;
}

export interface ParsedDTC {
  code: string;
  type: "stored" | "pending" | "permanent";
}

const DTC_PREFIX: Record<string, string> = {
  "0": "P0",
  "1": "P1",
  "2": "P2",
  "3": "P3",
  "4": "C0",
  "5": "C1",
  "6": "C2",
  "7": "C3",
  "8": "B0",
  "9": "B1",
  A: "B2",
  B: "B3",
  C: "U0",
  D: "U1",
  E: "U2",
  F: "U3",
};

function hexBytes(response: string): number[] {
  return response
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((b) => /^[0-9A-Fa-f]{2}$/.test(b))
    .map((b) => parseInt(b, 16));
}

export function parseOBDResponse(raw: string): { mode: number; pid: number; data: number[] } | null {
  const cleaned = raw.replace(/[>?\r\n]/g, " ").trim();
  const bytes = hexBytes(cleaned);
  if (bytes.length < 2) return null;
  const mode = bytes[0];
  if (mode !== 0x41 && mode !== 0x43 && mode !== 0x45 && mode !== 0x49) return null;
  return { mode, pid: bytes[1], data: bytes.slice(2) };
}

export function parsePID(pid: number, data: number[]): number | null {
  const A = data[0] ?? 0;
  const B = data[1] ?? 0;

  switch (pid) {
    case 0x0c:
      return ((A * 256 + B) / 4);
    case 0x0d:
      return A;
    case 0x05:
      return A - 40;
    case 0x11:
      return (A * 100) / 255;
    case 0x04:
      return (A * 100) / 255;
    case 0x2f:
      return (A * 100) / 255;
    case 0x5c:
      return A - 40;
    case 0x0f:
      return A - 40;
    case 0x0b:
      return A;
    case 0x10:
      return (256 * A + B) / 100;
    case 0x0e:
      return A / 2 - 64;
    case 0x06:
      return ((A - 128) * 100) / 128;
    case 0x07:
      return ((A - 128) * 100) / 128;
    case 0x14:
      return A / 200;
    case 0x33:
      return A;
    case 0x42:
      return (256 * A + B) / 1000;
    default:
      return null;
  }
}

export function parseDTCs(raw: string, type: "stored" | "pending" | "permanent"): ParsedDTC[] {
  const cleaned = raw.replace(/[>?\r\n]/g, " ").trim();
  const bytes = hexBytes(cleaned);
  const dtcs: ParsedDTC[] = [];

  let startIdx = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x43 || bytes[i] === 0x47 || bytes[i] === 0x4a) {
      startIdx = i + 1;
      break;
    }
  }

  for (let i = startIdx; i + 1 < bytes.length; i += 2) {
    const hi = bytes[i];
    const lo = bytes[i + 1];
    if (hi === 0 && lo === 0) continue;

    const nibble = ((hi & 0xc0) >> 6).toString(16).toUpperCase();
    const rest = ((hi & 0x3f).toString(16).padStart(1, "0") + lo.toString(16).padStart(2, "0")).toUpperCase();
    const prefix = DTC_PREFIX[nibble] ?? "P0";
    dtcs.push({ code: prefix + rest, type });
  }

  return dtcs;
}

export function parseIMReadiness(data: number[]): Array<{ name: string; status: "complete" | "incomplete" | "not_applicable" }> {
  const A = data[0] ?? 0;
  const B = data[1] ?? 0;
  const C = data[2] ?? 0;
  const D = data[3] ?? 0;

  const monitors = [
    { name: "Misfire Monitor", supportBit: B & 0x01, incompleteBit: D & 0x01 },
    { name: "Fuel System Monitor", supportBit: B & 0x02, incompleteBit: D & 0x02 },
    { name: "Component Monitor", supportBit: B & 0x04, incompleteBit: D & 0x04 },
    { name: "Catalyst Monitor", supportBit: C & 0x01, incompleteBit: D & 0x01 },
    { name: "Heated Catalyst", supportBit: C & 0x02, incompleteBit: D & 0x02 },
    { name: "Evaporative System", supportBit: C & 0x04, incompleteBit: D & 0x04 },
    { name: "Secondary Air System", supportBit: C & 0x08, incompleteBit: D & 0x08 },
    { name: "Oxygen Sensor", supportBit: C & 0x20, incompleteBit: D & 0x20 },
    { name: "O2 Sensor Heater", supportBit: C & 0x40, incompleteBit: D & 0x40 },
    { name: "EGR System", supportBit: C & 0x80, incompleteBit: D & 0x80 },
  ];

  return monitors.map((m) => {
    if (!m.supportBit) return { name: m.name, status: "not_applicable" as const };
    return {
      name: m.name,
      status: m.incompleteBit ? ("incomplete" as const) : ("complete" as const),
    };
  });
}

export function extractPromptResponse(buffer: string): string | null {
  const promptIdx = buffer.indexOf(">");
  if (promptIdx === -1) return null;
  return buffer.substring(0, promptIdx).replace(/\r\n/g, "\n").trim();
}
