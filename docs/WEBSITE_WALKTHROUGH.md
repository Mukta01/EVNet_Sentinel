# Website walkthrough

What to show on each page of the website, what to say, and what it means. Start the site with `make web` and open http://localhost:3100. For the terminal and paper parts of the demo, see [DEMO_SCRIPT.md](DEMO_SCRIPT.md) and [PAPER_WALKTHROUGH.md](PAPER_WALKTHROUGH.md).

> **How to state the flood result.** Never say floods score "1.00" or are "perfect". The measured Random Forest F1 is **0.9999 ± 0.0000** for four floods and **0.9994 ± 0.0001** for UDP flood. For example, seed 42 misclassifies 8 of 38,922 SYN-flood test flows. Say **"near-perfect (F1 ≥ 0.999) on this testbed"**, and add the caveats in [Presenting the flood result](#presenting-the-flood-result) below.

---

## 1. Home page (`/`)

| Section | What to do | What to say | What it means |
|---|---|---|---|
| **Beat the Sentinel** | Drag an attack card onto a charging station. Try a flood, then a scan. | "Each drop sends a real, unseen flow from the dataset through the model. The verdict is what the model actually returned." | Floods are named correctly almost every time. Scans are caught but often misnamed. That's the main result in one interaction. |
| **Tune the detector** | Move the confidence slider. | "The model names an attack only when it's at least this confident; otherwise it reports just the category, 'reconnaissance'." | Raising the bar trades exact names for fewer wrong names. At 0.5, Random Forest's wrong scan names fall from 81% to 3%. |
| **Features** | Scroll past. | "What the system does: detect, explain, respond." | Overview only. |
| **Architecture story** | Scroll slowly. | "The testbed builds up: the management server (CSMS) and site Wi-Fi, then the charger, then the car plugging in. Then the attackers appear, and the map shows where Sentinel would sit in Mumbai." | Sentinel listens on a **mirror port**, a switch port that receives a copy of all traffic. It raises alerts and never blocks traffic. Every recorded attack targets a **charging station**, not the car or the CSMS. |
| **Tech stack, roadmap, team** | Point briefly. | "Python and scikit-learn for the models, FastAPI for the API, Next.js for the site. Next comes packet-level sequence models. Here's who did what." | Context only. |

## 2. Simulation (`/simulation`)

| Part | What to do | What it means |
|---|---|---|
| **Attack and "Sent from"** | Choose Kali PC, Raspberry Pi or Malicious EV, then launch. | Packets follow the route that really happened in the dataset, worked out from the MAC addresses. The Pi only sends UDP floods; the EV only scans EVSE-B over the charging cable. |
| **Tap point and ALERT pulse** | Watch the packets pass the switch. | The detector sees a copy of the traffic at the mirror port and raises an alert. The attack still reaches the station, because Sentinel is passive. |
| **Campaign mode and incident log** | Run a campaign of several attacks at once. | It replays the paper's mixed-campaign test: at least 99.9% of attack flows are flagged. The log shows both named attacks and category-only alerts. |

## 3. Dashboard (`/dashboard`)

Before the tabs, the overview shows the dataset size, number of classes, seeds and environment. Say: *"Every number here comes from `evaluation_results/`, the same data the paper's figures are drawn from."*

### Tab 1: Findings

| Section | What it shows | Explain as | What it means |
|---|---|---|---|
| **Leak summary** | Three bars: the paper reports 98.4%; one timestamp column alone scores 99.76%; with the leak removed, Random Forest scores 86.8% accuracy (macro-F1 0.558). Below them, the columns we removed. | "One timestamp column beats the published model." | The published accuracy reflects *when* each capture file was recorded, not attack detection. |
| **Class separation** | Per-class F1, grouped into floods, scans and other attacks | "Floods are near-perfect (≥ 0.999); scans range from 0.10 to 0.27." | Two different problems: floods are essentially solved on this testbed; scans are hard. |
| **Confusion explorer** | Interactive matrix. Switch models and hover cells for counts. | "Rows are the true attack, columns the prediction. The green diagonal is correct; red cells are mistakes." | Scans collapse into one "sink" class (OS fingerprinting for Random Forest), and 8–11% of scans are called Slowloris, because both hold slow, near-idle connections. |
| **Feature separability** | Two panels: *Naming a DoS attack* and *Naming a scan* | "How much of 'which attack is this?' a single feature answers on its own." | For DoS the best feature answers 98%; for scans, 5%. The limit is in the data, so a bigger model won't fix it. |
| **Model table** | Macro-F1, accuracy and runtime for 4 models, mean ± std over 3 seeds | "Read macro-F1, not accuracy: accuracy is about 0.86 for every model." | Random Forest ≈ Decision Tree (0.558); the linear models trail (0.44 and 0.41). |
| **Leak evidence** | Single-column scores: timestamp 0.9976, `src_port` 0.40, `dst_port` 0.29 | "These columns identify the recording, not the traffic." | Fingerprint columns, so they had to be removed. |
| **Fingerprint ablation** | Flows left after deduplication, for each combination of keeping or dropping the timestamps and `dst_port` | "The paper dropped `dst_port`, the feature that defines a port scan, and kept the timestamps." | Their scans were told apart by recording time, not by behaviour. |
| **Drift timeline** | A coloured band of the capture files, with ADWIN drift alarms as dots | "The alarms line up with the boundaries between files." | The drift detector is seeing the dataset being stitched together, not traffic changing. |
| **Drift alignment** | 42 of 43 alarms near a file boundary, against about 2 if placed at random | "p < 0.0005." | Statistical support for the drift-timeline point. |
| **Figure export** | Download buttons | "Any chart can be saved for the report." | Convenience. |

### Tab 2: Attack insights (the operator's view)

| Part | Explain as | What it means |
|---|---|---|
| **Takeaway cards** | Read the headlines aloud. | <ul><li>No attack slipped through as normal traffic.</li><li>Floods are named correctly ≥ 98% of the time by every model.</li><li>Scans are recognised as scans 96% of the time but named only 34%.</li><li>SVM and Logistic Regression raise too many false alarms (59% and 46%, against 2% for Random Forest). These rates rest on very few benign flows.</li></ul> |
| **Attack list → detail panel** | Click SYN Flood, then TCP Port Scan. | *How well it is caught* shows the three levels: detected, right category, exact name. *When it is wrong, it is called* shows what the attack is confused with. |
| **Best model per attack** | Point at the recommendation. | Random Forest is the main detector; Logistic Regression is a second opinion on "is this a scan?". |
| **Response playbook** | Show the three roles. | What the station owner, the CSMS operator and the analyst should each do. When the attack's name is unreliable, they act on its category instead. |
| **How these tests were run** | Scroll to the bottom. | 30 batches of 50 unseen flows, 3 model sets, a reliability threshold of 0.9, and regression gates that all passed. |

### Tab 3: Live inference

| What to do | Explain as | What it means |
|---|---|---|
| Choose an active model and replay flows | "Real held-out flows, scored by each model, with its confidence." | Random Forest is highly confident on floods and spread out on scans, which is why confidence gating works. |

## 4. Docs (`/docs`)

| Section | Explain as |
|---|---|
| **Method at a glance** | Capture → remove leakage → split → detect → test per attack → respond. This is Fig. 2 of the paper. |
| **Architecture** | Where Sentinel sits, and how the API and the website relate. For the code-level view, open the animated diagrams (`make diagrams`). |

---

## Presenting the flood result

A score of exactly 1.00 invites a fair question: *"Is that a leak too?"* Have this answer ready.

**1. State the exact number, not the rounded one.**

| Flood (Random Forest) | F1, mean ± std over 3 seeds |
|---|---|
| PSH-ACK, SynonymousIP, TCP, SYN | 0.9999 ± 0.0000 |
| UDP | 0.9994 ± 0.0001 |

It is not perfect: seed 42 misclassifies 8 of 38,922 SYN-flood flows and 2 of 4,811 UDP-flood flows.

**2. Explain why near-perfect is plausible here, rather than a leak.**
- The leaky columns are gone: the six timestamps and `src_port` are removed before training.
- A volumetric flood has a physical signature: thousands of packets per second, fixed sizes and specific TCP flags. One timing feature (`src2dst_mean_piat_ms`, the mean gap between packets) alone resolves 98% of the uncertainty about which DoS attack it is. That measure doesn't depend on any model.
- All four models agree, including the linear ones (≥ 0.98 exact naming). A leak would favour trees, as Finding 1 showed.

**3. Name the caveats yourself, before anyone else does.**
- **Same testbed, default tool settings.** The floods were generated by standard tools at full rate. A slower or disguised flood would look different, so we claim "on this testbed", not "in general".
- **Random split.** After deduplication no exact copies remain, but near-identical flows from the same capture file can sit on both sides of the split, which makes the test easier. A grouped split, where whole capture files are held out, is implemented (`make data-grouped`) but not yet reported. It is the right next check.
- **Labels come from file names.** Flood captures are dominated by attack traffic, so label noise matters less here than it does for scans.

**Suggested wording:**
> "Volumetric floods are near-perfectly separable on this testbed (F1 ≥ 0.999 over three seeds), consistent with their distinctive packet-timing signature. Generalisation to other networks and to rate-limited floods remains to be tested with grouped splits."

**Paper v2 still says "1.000 with zero variance"** in Table XII and the paragraph after it. That should be updated to the exact values above before submission.
