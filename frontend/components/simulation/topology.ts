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
  { id: "sentinel", name: "EVNet Sentinel", role: "Passive IDS on the switch's mirrored port — sees a copy of every packet, blocks nothing", device: "IDS",
    address: "—", iface: "switch mirror port", x: 240, y: 210, w: 160, h: 56, kind: "sentinel" },
  { id: "evse-a", name: "EVSE-A", role: "Charging station · OCPP client", device: "Grizzl-E Smart Connect",
    address: "oc:8b:95:09:c6:08", iface: "wifi", x: 60, y: 328, w: 148, h: 56, kind: "evse" },
  { id: "evse-b", name: "EVSE-B", role: "Charging station · OCPP + V2G server", device: "Raspberry Pi",
    address: "dc:a6:32:c9:e5:5f", iface: "wifi / eth0", x: 246, y: 328, w: 148, h: 56, kind: "evse" },
  { id: "evcc", name: "EVCC", role: "The vehicle · ISO 15118 client", device: "Raspberry Pi",
    address: "dc:a6:32:c9:e6:9f", iface: "eth0", x: 434, y: 328, w: 138, h: 56, kind: "vehicle" },
  { id: "attacker", name: "Attacker", role: "Kali Linux PC (most attacks) or Raspberry Pi (UDP floods); one at a time", device: "Kali Linux PC / Raspberry Pi",
    address: "a8:6b:ad:1f:9b:e5 / dc:a6:32:dc:27:d5", iface: "wifi · AP1", x: 456, y: 118, w: 138, h: 52, kind: "attacker" },
];

export const nodeById = (id: NodeId) => NODES.find((n) => n.id === id)!;

/**
 * Paths a packet can travel. Every attack ends at the charging station it
 * targeted in the recording (src/reproduction/attack_routes.py): no capture
 * in CICEVSE2024 targets the CSMS or the vehicle. All traffic crosses the
 * switch whose mirrored port feeds Sentinel, so every route passes the tap.
 */
export const PATHS: Record<string, string> = {
  // benign: station -> switch/tap -> local CSMS
  "evse-a": "M134,328 L134,292 Q134,238 240,238 L320,238 L320,170",
  "evse-b": "M320,328 L320,170",
  // attacker on AP1 -> switch -> the targeted station
  "attacker->evse-a": "M525,170 Q525,238 440,238 L240,238 Q134,238 134,292 L134,328",
  "attacker->evse-b": "M525,170 Q525,238 440,238 L336,238 Q320,238 320,256 L320,328",
  // compromised vehicle -> EVSE-B over the ISO 15118 link, through the switch
  "evcc->evse-b": "M503,328 L503,300 Q503,252 452,252 L384,252 Q360,252 360,290 L360,328",
  // CSMS uplink
  uplink: "M320,118 L320,70",
};

export type Sender = "kali" | "rpi" | "evcc";
export const SENDERS: Record<Sender, { label: string; note: string }> = {
  kali: { label: "Kali Linux PC", note: "on the site wifi (AP1)" },
  rpi: { label: "Raspberry Pi attacker", note: "on the site wifi (AP1) — the UDP floods" },
  evcc: { label: "Malicious EV", note: "a compromised car, over the charging cable (ISO 15118)" },
};

/** Where a flow travels and what it hits, from its recorded sender and station. */
export function routeFor(evse: string, sender: Sender | null, attacking: boolean) {
  const target: NodeId = evse === "EVSE-A" ? "evse-a" : "evse-b";
  if (!attacking || !sender) return { pathD: PATHS[target], target: null };
  if (sender === "evcc") return { pathD: PATHS["evcc->evse-b"], target: "evse-b" as NodeId };
  return { pathD: PATHS[`attacker->${target}`], target };
}

/** Where the tap sits: the point on a path closest to Sentinel's centre. */
export const TAP_POINT = { x: 320, y: 238 };
