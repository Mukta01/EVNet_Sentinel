/**
 * The CICEVSE2024 testbed, transcribed from the dataset's own device table
 * (Network Traffic/Readme.txt). Nothing here is invented: names, roles,
 * interfaces and addresses are the real ones, which is what lets a replayed
 * flow be placed on the link it actually crossed.
 */

export type NodeId =
  | "remote-csms" | "local-csms" | "sentinel"
  | "evse-a" | "evse-b" | "evcc" | "attacker";

export type TopoNode = {
  id: NodeId;
  name: string;
  role: string;
  device: string;
  address: string;
  iface: string;
  x: number; y: number; w: number; h: number;
  kind: "csms" | "evse" | "vehicle" | "attacker" | "sentinel";
};

/** Canvas is 640 x 420 user units; the component scales it responsively. */
export const NODES: TopoNode[] = [
  { id: "remote-csms", name: "Remote CSMS", role: "Remote OCPP server", device: "Remote server",
    address: "162.159.140.98", iface: "internet", x: 246, y: 18, w: 148, h: 52, kind: "csms" },
  { id: "local-csms", name: "Local CSMS", role: "Local OCPP server", device: "Raspberry Pi",
    address: "dc:a6:32:c9:e5:3e", iface: "wifi", x: 246, y: 118, w: 148, h: 52, kind: "csms" },
  { id: "sentinel", name: "EVNet Sentinel", role: "Inline network tap", device: "IDS",
    address: "—", iface: "mirror", x: 240, y: 210, w: 160, h: 56, kind: "sentinel" },
  { id: "evse-a", name: "EVSE-A", role: "Charging station · OCPP client", device: "Grizzl-E Smart Connect",
    address: "oc:8b:95:09:c6:08", iface: "wifi", x: 60, y: 328, w: 148, h: 56, kind: "evse" },
  { id: "evse-b", name: "EVSE-B", role: "Charging station · OCPP + V2G server", device: "Raspberry Pi",
    address: "dc:a6:32:c9:e5:5f", iface: "wifi / eth0", x: 246, y: 328, w: 148, h: 56, kind: "evse" },
  { id: "evcc", name: "EVCC", role: "The vehicle · ISO 15118 client", device: "Raspberry Pi",
    address: "dc:a6:32:c9:e6:9f", iface: "eth0", x: 434, y: 328, w: 138, h: 56, kind: "vehicle" },
  { id: "attacker", name: "Attacker", role: "Kali PC or Raspberry Pi", device: "Kali Linux / RPi",
    address: "a8:6b:ad:1f:9b:e5", iface: "wifi", x: 456, y: 118, w: 138, h: 52, kind: "attacker" },
];

export const nodeById = (id: NodeId) => NODES.find((n) => n.id === id)!;

/**
 * Paths a packet can travel. Every route passes through the tap, because that
 * is where the product sits: on the wire between the stations and the CSMS.
 */
export const PATHS: Record<string, string> = {
  // EVSE-A -> tap -> local CSMS -> remote CSMS
  "evse-a": "M134,328 L134,292 Q134,238 240,238 L320,238 L320,170",
  // EVSE-B -> tap -> local CSMS
  "evse-b": "M320,328 L320,266",
  // vehicle -> EVSE-B (V2G, then onward)
  evcc: "M503,328 L503,300 Q503,282 470,282 L394,282 L320,282 L320,266",
  // attacker -> the OCPP link, converging on the same wire
  attacker: "M525,170 Q525,238 400,238 L320,238 L320,266",
  // compromised EV attacking through the charging cable
  "malicious-ev": "M503,328 L503,300 Q503,282 470,282 L394,282 L320,282 L320,266",
  // CSMS uplink, used for the benign heartbeat's last leg
  uplink: "M320,118 L320,70",
};

export type LaunchPoint = { id: string; label: string; note: string; path: keyof typeof PATHS };

export const LAUNCH_POINTS: LaunchPoint[] = [
  { id: "kali", label: "Kali Linux PC", note: "External attacker on the station wifi", path: "attacker" },
  { id: "rpi", label: "Raspberry Pi attacker", note: "External attacker on the station wifi", path: "attacker" },
  { id: "malicious-ev", label: "Malicious EV (EVCC)", note: "Compromised vehicle over the V2G link", path: "malicious-ev" },
];

/** Which path a replayed flow travels, from the metadata it carries. */
export function pathForFlow(evse: string, state: string, launchPath: string, attacking: boolean) {
  if (attacking) {
    return state === "maliciousev" ? PATHS["malicious-ev"] : PATHS[launchPath] ?? PATHS.attacker;
  }
  return evse === "EVSE-A" ? PATHS["evse-a"] : PATHS["evse-b"];
}

/** Point on the tap where a verdict is issued, as a fraction of path length. */
export const TAP_AT = 0.82;
