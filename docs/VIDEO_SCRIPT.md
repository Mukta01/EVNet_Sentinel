# EVNet Sentinel in two minutes: video script

For the landing page's project video (`frontend/components/VideoSection.tsx`, set `VIDEO_ID` once it is uploaded). About 2:00 at a calm pace. Every number below comes from a committed results file; the source is noted so the video never drifts from the project.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Landing hero, "Securing the Grid" forming from particles | Every public EV charger is a networked computer. It reports to a management system, the CSMS, usually over the site's shared wifi. That link is what attackers go after. |
| 0:12–0:30 | Dashboard, Findings tab: leak summary | A published system claimed 98% accuracy on this problem. We reproduced it and found a leak: one timestamp column alone scores 99.8%. With the leak removed, the honest macro-F1 is about 0.56. *(findings.json, paper v3)* |
| 0:30–0:45 | Attack insights tab | What still works: every flood is named exactly, and 96% of scans are recognised as scans, though only 34% get the exact scan name. XGBoost is our primary detector, with 1.8% false alarms on normal traffic. *(insights.json)* |
| 0:45–1:00 | Scroll story: car plugs in, attacker joins the wifi, Sentinel watches the mirrored traffic | Sentinel watches a mirrored copy of the site's traffic. But detection alone doesn't stop anyone. So we close the loop: detect, contain, harden, verify. |
| 1:00–1:15 | Simulation: SYN flood → Network not safe → *Approve quarantine* → packets stop at the access point | A flood is named almost perfectly, so Sentinel recommends quarantining that one device at the switch. An operator approves it, the attack traffic stops, and the chargers stay online. |
| 1:15–1:30 | Simulation: port scan → *Approve restriction*; then a flood from the same laptop → *escalation* | Scans are recognised but often misnamed, so the response is softer: the device keeps internet access but can no longer reach the chargers. And it's now watched. When that same laptop starts flooding, it's quarantined on its very first flood flow. |
| 1:30–1:42 | Simulation: scan from the malicious EV → *Stop session and block vehicle* | If the scan comes from a compromised car through the charging cable, the charger ends the session and blocks the vehicle. A switch block would do nothing, because that traffic never crosses the switch. |
| 1:42–1:52 | Response panel: owner / CSMS / analyst hardening steps | Then each person hardens the site so the same attack fails next time: SYN cookies and rate limits, stations that answer only the CSMS, chargers that accept only charging messages from the car. |
| 1:52–2:00 | Findings tab: "After detection" — 20/20, 11 → 1, 0 | We replayed every recorded attack through this loop: 20 out of 20 contained, and no actions on normal traffic. Sentinel recommends; a person approves every action. *(response-replay.json)* |

## Honesty notes for the edit

- Say "replayed" or "simulated" for every containment shot. Sentinel is a passive IDS; no switch was reconfigured.
- The "0 actions on normal traffic" figure comes from the dataset's 12 distinct benign flows, so don't call it a false-positive rate.
- Keep the 34% exact-name figure next to the 96% recognised figure, so viewers know scans are hard.
