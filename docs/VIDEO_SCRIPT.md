# EVNet Sentinel: project video script

For the landing page's project video (`frontend/components/VideoSection.tsx`, set `VIDEO_ID` once it is uploaded). About 2:45 at a calm pace. Every number comes from a committed results file; the source is noted so the video never drifts from the project.

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:12 | Landing hero, "Securing the Grid" forming from particles | Every public EV charger is a networked computer. It reports to a management system, the CSMS, usually over the site's shared wifi. That link is what attackers go after. |
| 0:12–0:30 | Dashboard, Findings → 01 The leak | A published system claimed 98% accuracy on this problem. We reproduced it and found a leak: one timestamp column alone scores 99.8%. The model was recognising the recording, not the attack. *(findings.json)* |
| 0:30–0:55 | Findings → 04 Models (model table); then the leak card's "accuracy 86.8% vs macro-F1 0.558" | Why we report F1, not accuracy. After removing duplicates, floods make up over 80% of the flows, and 99% on the published feature set. A model that gets the floods right and misses every scan still scores high accuracy: on that published set, accuracy is 99.6% while macro-F1 is only 0.70. Macro-F1 scores each of the 15 traffic classes separately and averages them, so a missed scan type counts as much as a flood. With the leak removed, macro-F1 is about 0.55: the honest number. *(findings.json fingerprintAblation; evaluation_results/leakfree-reference, multiseed)* |
| 0:55–1:15 | Findings → 02 Floods vs scans (the bars) | That average hides two very different results. Floods are named 99.8% of the time. The six scan types sit near 0.2 F1 each, because at the flow level they look almost identical. *(findings.json, insights.json)* |
| 1:15–1:30 | Attack insights → model × attack table, XGBoost column marked primary | 96% of scans are still recognised as scans, even though only 34% get the exact scan name. XGBoost is our primary detector: the fewest false alarms on normal traffic, 1.8%. *(insights.json)* |
| 1:30–1:45 | Scroll story: car plugs in, attacker joins the wifi, Sentinel watches the mirrored traffic | Sentinel watches a mirrored copy of the site's traffic. But detection alone doesn't stop anyone. So we close the loop: detect, contain, harden, verify. |
| 1:45–2:00 | Simulation: SYN flood → Network not safe → *Approve quarantine* → packets stop at the access point | Floods are named reliably, so Sentinel recommends quarantining that one device at the switch. An operator approves it, the attack stops, and the chargers stay online. |
| 2:00–2:15 | Simulation: port scan → *Approve restriction*; then a flood from the same laptop → *escalation* | Scans are often misnamed, so the response is softer: the device keeps internet access but can't reach the chargers. And it's now watched. When that same laptop starts flooding, it's quarantined on its very first flood flow. |
| 2:15–2:28 | Simulation, station set to **Charging**: malicious EV scan → *Stop session and block vehicle* | A compromised car attacks through the charging cable, so the charger ends the session and blocks the car. That can only happen while charging; when the station is idle, there's no car to attack from. |
| 2:28–2:38 | Response panel: station owner / CSMS operator / network analyst steps | Then each role hardens the site so the same attack fails next time: SYN cookies and rate limits, stations that answer only the CSMS, chargers that accept only charging messages from the car. |
| 2:38–2:48 | Findings → 06 Response: 20/20 · 11 → 1 · 0 | We replayed every recorded attack through this loop: 20 out of 20 contained, and no actions on normal traffic. Sentinel recommends; a person approves every action. *(response-replay.json)* |

## Honesty notes for the edit

- Say "replayed" or "simulated" over every containment shot. Sentinel is a passive IDS; no switch was reconfigured.
- The floods figure is 99.8%: the 95% lower bound over 4,500 test flows for the weakest flood (the site shows ≥ 99.83%). Don't say 100%.
- Keep the 34% exact-name figure next to the 96% recognised figure, so viewers know scans are hard.
- "0 actions on normal traffic" comes from the dataset's 12 distinct benign flows, so don't call it a false-positive rate.

## How to make it

A screen recording of the website in the order above, with the voice-over recorded on top. No extra assets are needed.
