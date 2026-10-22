/**
 * Plain-language key to the testbed diagram: what each box is and why it is
 * there. Device facts come from the dataset's own device table (topology.ts).
 */
const TERMS: { term: string; full: string; body: string }[] = [
  { term: "EVSE", full: "Electric Vehicle Supply Equipment",
    body: "The charging station. It talks to the CSMS over OCPP and, when a car is plugged in, to the car over ISO 15118." },
  { term: "EVSE-A", full: "Real charger · Grizzl-E Smart Connect",
    body: "A commercial station on the site wifi. OCPP only: no car was ever connected to it, and all recorded normal traffic comes from it." },
  { term: "EVSE-B", full: "Emulated charger · Raspberry Pi",
    body: "Runs OCPP and the ISO 15118 server, so the car is cabled to it. The testbed needed it because the real charger can't host the car link." },
  { term: "EVCC", full: "Electric Vehicle Communication Controller",
    body: "The car's charging computer (a Raspberry Pi here). In the malicious-EV captures it is the attacker, scanning EVSE-B over the cable." },
  { term: "CSMS", full: "Charging Station Management System",
    body: "The operator's server that authorises, meters and bills sessions. A Local CSMS sits on site; a Remote one is reached over the internet." },
  { term: "OCPP", full: "Open Charge Point Protocol",
    body: "Station ↔ CSMS messages over WebSocket/TCP: heartbeats, start/stop, meter values. The link the attacks disrupt." },
  { term: "ISO 15118 · V2G", full: "Vehicle-to-Grid communication",
    body: "Car ↔ station messages over the charging cable. This traffic never crosses the site wifi." },
  { term: "Attacker", full: "Kali Linux PC or Raspberry Pi",
    body: "A device on the site wifi (AP1) that launched the floods and scans. One at a time." },
  { term: "Sentinel", full: "Passive IDS on a mirror port",
    body: "The switch copies every packet to it. It watches and recommends; it blocks nothing itself." },
  { term: "Idle / charging", full: "Station state when recorded",
    body: "Idle = no car plugged in, but the station still sends heartbeats. Charging = a session is running, so car-side attacks are possible." },
];

export default function TestbedGlossary() {
  return (
    <details className="group rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
        Who&rsquo;s who on this network
        <span className="transition-transform group-open:rotate-45" aria-hidden>+</span>
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {TERMS.map((t) => (
          <div key={t.term}>
            <dt>
              <span className="block text-sm font-medium text-slate-100">{t.term}</span>
              <span className="block text-xs text-slate-500">{t.full}</span>
            </dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-slate-400">{t.body}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
