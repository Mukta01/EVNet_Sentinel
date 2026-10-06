# Research paper walkthrough

A section-by-section guide to presenting
**"EVNet Sentinel: A Leakage-Corrected Reproduction and Comparative Study of Intrusion Detection on Electric Vehicle Charging Networks"**
([`EVNet_Sentinel_Research_Paper_v2.pdf`](research%20paper/EVNet_Sentinel_Research_Paper_v2.pdf)).

Each section below gives:
- **In one line:** what the section says.
- **Explain:** the points to make.
- **Show:** the table, figure or equation to put on screen.
- **If asked:** likely follow-up questions, with answers.

A full walkthrough takes about 20 minutes. For a 5-minute version, present only the *In one line* parts plus Section V.

---

## The story in 30 seconds

> A published paper reports 98.4% accuracy for an online intrusion detector on EV charging networks. We reproduced it and found that the accuracy comes mostly from how the dataset was recorded, not from detecting attacks: one timestamp column alone scores 99.76%. With the leaks removed, floods are still detected perfectly, but the six types of network scan cannot be told apart from flow statistics. We prove that limit lies in the data, choose the best model per attack, and ship a working system around it.

---

## Title, authors, abstract

**In one line:** this is a *reproduction and audit* paper, not a new-model paper.

**Explain:**
- The title has three key words: **leakage-corrected** (we found and removed leaks), **reproduction** (of Makhmudov et al., 2025) and **comparative study** (four classifiers plus the published online model).
- The authors are the four students, then Prof. Mahesh Khandke as guide.
- The abstract follows the story above, plus the deliverable: a prediction API, response guidance and an interactive website.

**If asked "What is new here?":** the audit itself, with five verifiable findings. Also the first per-attack, multi-seed, macro-F1 evaluation on this dataset, and a proof that the scan-naming ceiling is a property of the data.

---

## I. Introduction

**In one line:** charging stations are networked computers; the best published detector looks near-perfect; we ask whether that number measures detection.

**Explain:**
- **Two protocols:**
  - **ISO 15118** runs between the car and the charger (the *EVSE*).
  - **OCPP** runs between the charger and its central management system (the *CSMS*). It carries authorisation, meter values and remote control, so attacking it stops charging and billing.
- **Concept drift:** traffic patterns change over time, so a model trained once goes stale. Makhmudov et al. addressed this with an **Adaptive Random Forest (ARF)**, which keeps learning as data arrives, plus **ADWIN**, a detector that signals when the data distribution changes. They report 99.13% binary and 98.40% multiclass accuracy.
- **Our six contributions:** the leakage audit, corrected benchmarks, an explanation of why scans fail, a per-attack evaluation, who-attacks-whom provenance, and a working system.

**Show:** the contribution list. It doubles as the outline of the talk.

---

## II. Literature Review

**In one line:** five works shaped the project; none audits the preprocessing behind the reported accuracies.

| Work | What it does | Gap we address |
|---|---|---|
| Bean et al. 2026 (survey) | Reviews 24 ML intrusion-detection studies on CICEVSE2024 | Takes reported accuracies at face value |
| Joglekar et al. 2026 | Network + host hybrid IDS; XGBoost reaches 99.99% | Keeps timestamps, so it is exposed to the same leak; offline only |
| Malimage et al. 2023 | Industry and regulatory threat analysis | Proposes no detector |
| **Makhmudov et al. 2025** | **The baseline we reproduce:** ARF + ADWIN, 98.40% | Timestamps kept, `dst_port` dropped, capture-order evaluation, drift on file seams |
| Tanyildiz et al. 2025 | GAN + deep learning to predict *when* the next attack comes | Different dataset; heavy compute |

**Show:** Tables I and II (the comparative studies). In the last row, our headline is **0.558 macro-F1**, not an accuracy above 99%. Explain that this lower number is the honest one.

**Explain the five research gaps:**
1. Nobody audits the preprocessing.
2. Results come from a single seed.
3. Accuracy is used as the headline.
4. There is no per-attack or operator view.
5. The drift claim is never tested.

---

## III. Problem Formulation

**In one line:** a passive detector classifies each network flow into one of 15 classes, and is judged by macro-F1 averaged over 3 seeds.

**Explain:**
- **Threat model:** the attacker is a device on the site network, or a compromised car on the charging cable. The detector is **passive**: it listens on a *mirror port* (a switch port that receives a copy of all traffic). It raises alerts but never blocks traffic.
- **Task:** each flow (one connection's summary) is a vector of **60 features** and gets one of **15 labels**: 14 attacks plus benign. Each label also maps to a response category: DoS, Recon or Benign (Eq. 1).
- **Metric:**
  - **F1** combines precision and recall per class (Eq. 2).
  - **Macro-F1** averages F1 over all 15 classes equally. Accuracy is dominated by the four huge flood classes, so it hides failure on the small ones.
- **Seeds:** every number is a mean ± standard deviation over 3 seeds (Eq. 3). Each seed changes both the data split and the model initialisation.

**If asked "Why not accuracy?":** on identical predictions, our Random Forest scores **0.868 accuracy but 0.558 macro-F1**. Accuracy cannot tell the four models apart; macro-F1 can.

---

## IV. Dataset and Testbed

**In one line:** CICEVSE2024 has 59 capture files and 2.74M flows. We worked out who attacked what, and cleaned the data down to 1.2M unique flows with 60 features.

**Explain:**
- **A. Dataset (Table III):**
  - Made by the Canadian Institute for Cybersecurity: two charging stations (EVSE-A and EVSE-B), each recorded idle and while charging.
  - Flows were extracted with NFStream into 86 features.
  - **Labels come from the capture file name.**
  - The 15 classes are 5 floods, 6 nmap scan modes, 3 low-rate DoS types and benign.
- **B. Who attacks what (Table IV):**
  - The dataset never says which device attacked which, so we read it from the MAC addresses in every flow.
  - A Kali PC attacks both stations; a Raspberry Pi runs the UDP floods; in six captures a **compromised car** scans EVSE-B over the charging cable.
  - **Every attack targets a charging station.** None targets the CSMS or the car directly.
- **C. Corrected preprocessing (Table V):**
  - Drop identifiers (IP, MAC).
  - Drop the **six timestamps** and **`src_port`**, but keep `dst_port`.
  - Deduplicate: 2.74M → **1.2M** flows.
  - Standardise each feature using training-set statistics only.
  - Split 70/15/15, stratified by class.

**If asked "Why deduplicate?":** identical flows in both the training and test sets would let a model score points by memorising them.

---

## V. Leakage Analysis: the core of the paper

**In one line:** five independently verifiable findings show that the published numbers measure how the dataset was assembled, not how well attacks are detected.

### Finding 1: one timestamp recovers the label (Table VI, Eq. 4)
- Each attack was recorded in its own file at its own time. So a timestamp identifies *which recording* a flow is from, and therefore its label, without describing the traffic.
- A decision tree given **only** `bidirectional_first_seen_ms` scores **0.9976**, *above* the published full model's 0.9840.
- **Analogy:** grading an exam by its submission time. If every topic was taken at a different hour, the clock tells you the topic.
- **Live demo:** `make replay-reference` reproduces this in about 20 seconds.

### Finding 2: the useful feature is the one they dropped (Table VII)
- A port scan *is* a sweep over destination ports, so `dst_port` is the legitimate signal. The published pipeline drops `dst_port` and keeps the timestamps.
- Its 273,932 recon flows are therefore told apart by *when* they were captured, not by *what* they did.

### Finding 3: stream order inflates streaming accuracy (Table VIII, Eqs. 5–7)
- **Prequential evaluation** (Eq. 5): predict each flow first, then train on it.
- In capture order, each file holds one class. The label changes only **54 times in 1.92M flows**, so the rule "predict the previous label" is right with ρ = **0.99997** (Eq. 6).
- ARF + ADWIN scores **0.9997**, which does not even beat that trivial rule.
- On a shuffled stream ARF scores **0.5585**, 44 points lower. That is the meaningful number.

### Finding 4: the drift detector finds file seams (Fig. 1, Eqs. 8–10)
- **ADWIN** (Eq. 8) raises an alarm when the recent error rate shifts significantly.
- **42 of 43** alarms fall within 100 flows of a boundary between capture files (median distance: 22 flows).
- If the 43 alarms were placed at random, only 2.2 ± 1.5 would land that close. Over 2,000 random draws, **p < 0.0005** (Eq. 10).
- So the "drift" is the dataset being stitched together, not charging traffic changing over time. This undercuts the paper's main selling point.
- **Show:** Fig. 1. The coloured band is the capture files; the green dots (alarms) line up with the file boundaries.

### Finding 5: `src_port` is a leftover fingerprint (Table IX)
- The operating system hands out source ports almost sequentially, so each capture occupies its own band of port numbers.
- Removing `src_port` costs the Decision Tree **0.17** macro-F1 but Random Forest only 0.08. The deeper tree was memorising port bands.
- Without it the two models converge.

**If asked "Is this an attack on the authors?":** no. These are common pitfalls with capture-per-attack datasets. We build on their open-source code, and the paper says so in the acknowledgment.

---

## VI. System Architecture

**In one line:** a passive detector on the mirror port; trained models behind an API; guidance for three roles; a website built from exported results.

**Explain (Fig. 2):**
- **Placement:** on the switch's mirror port, so it sees station, CSMS and car traffic without being in the traffic path and without changing any firmware.
- **Models and API:**
  - Four scikit-learn models plus ARF + ADWIN (from the River library) are trained offline.
  - A FastAPI service loads every model and its scaler at startup and classifies one flow per request.
- **Response guidance:** each detection maps to actions for the **station owner**, the **CSMS operator** and the **network analyst**. If the model can't name an attack reliably, the guidance acts on its category (DoS or Recon) instead.
- **Front end:** a Next.js website built **only from exported results**, so every number on screen can be reproduced. It has the interactive landing page, the simulation console and the dashboard.

**Show:** the animated `ml-pipeline.html` and `predict-api.html` diagrams (`make diagrams`).

---

## VII. Experimental Methodology

**In one line:** how we train, test per attack, measure separability, gate on confidence, and pick a primary model.

**Explain:**
- **A. Models:**
  - Random Forest: 100 trees, depth 15. Decision Tree: depth 20.
  - Logistic Regression and a linear SVM, both trained by stochastic gradient descent.
  - **Balanced class weights** (Eq. 11): rare classes count as much as common ones.
  - ARF uses the paper's own settings.
- **B. Protocol:** 3 seeds (42, 1337, 2024). With only 81 benign and 28 ICMP-fragmentation flows, a single seed would be mostly luck.
- **C. Per-attack test harness (Eqs. 12–13):**
  - For each attack and model: 30 batches of 50 unseen flows, each scored at three levels:
    - **D (detected):** flagged as any attack.
    - **C (category):** right category, DoS or Recon.
    - **E (exact):** attack named correctly.
  - The **verdict ladder** uses a threshold of 0.9: *identified* → *category* → *detected* → *missed*.
  - **Regression gates** make the harness fail if a later change breaks detection.
- **D. Per-feature separability (Eq. 14):** within DoS or within Recon, the share of "which attack is this?" that one feature answers on its own (mutual information divided by label entropy). It uses no model, so it describes the data itself.
- **E. Confidence-gated naming (Eq. 15):** name the attack only if the model's top probability is at least *t*; otherwise report just the category.
- **F. Choosing the primary detector (Eq. 16):** among the models that name attacks within 0.02 of the best, pick the one with the **fewest false alarms**.

---

## VIII. Results and Discussion

**In one line:** floods are solved, scans hit a ceiling that lives in the data, nothing slips through, and Random Forest is the recommended detector.

### A. Corrected benchmarks (Tables X, XI)
- Macro-F1: **RF 0.558 ± 0.008** ≈ DT 0.557 > LR 0.436 > SVM 0.411.
- All four reach about 0.86 accuracy, which is why accuracy can't rank them.
- Removing the timestamps costs RF **0.365** macro-F1, but the linear models barely move. A tree can cut a timestamp axis into one interval per file; a straight-line (linear) boundary can't. So the tree-versus-linear gap in the original paper mostly measured *how well each model could exploit the leak*.

### B. Per-class results (Table XII)
- Floods score **F1 = 1.000** in every seed. Scans average **0.183**.
- It isn't about sample size: UDP flood (32k flows) scores 0.999, while TCP port scan (35k flows) scores 0.265.
- The six classes are all modes of the same tool, nmap. Aggressive mode (`nmap -A`) *includes* two of the other modes.

### C. Why scans can't be separated (Figs. 3, 4)
- **Confusion matrix (Fig. 3):**
  - Scans collapse into one "sink" class: RF labels 32–48% of the other scans as OS fingerprinting.
  - 8–11% of every scan leaks into Slowloris, because both hold slow, near-idle connections.
- **Separability (Fig. 4):** inside DoS, one timing feature answers **98%** of the question; inside Recon, the best feature answers **5%**.
- **The key sentence:** *no flow statistic distinguishes the six nmap modes, so no classifier trained on these features can, whatever its size.*

### D. Per-attack detection and model choice (Tables XIII, XIV)
- **Nothing slips through:** across 90 mixed campaigns, every model flags at least **99.9%** of attack flows.
- Floods are named exactly by every model. Scans are recognised as scans **96%** of the time but named correctly only **34%**.
- False alarms on benign traffic: **RF 2%**, DT 12%, LR 46%, SVM 59%.
- So **Random Forest is the primary detector**, with Logistic Regression as a second opinion on "is this a scan?".

### E. Confidence before naming (Table XV)
- Without a confidence bar, RF names **81%** of scans wrongly.
- At *t* = 0.5, wrong names fall to **3%** and 94% of scans are reported correctly as "reconnaissance", while DoS keeps 93% exact naming.
- **Message:** a correct category alert is better than a confident wrong name.

**Show:** the dashboard's *Findings* and *Attack insights* tabs. They are live versions of these tables.

---

## IX. Reproducibility

**In one line:** every number regenerates from the public repository with pinned dependencies.

**Explain:**
- Each finding has its own script: `replay_reference_preprocessing.py`, `ablate_fingerprints.py`, `drift_boundary_alignment.py` and `srcport_control.py`.
- The figures and the website read the same exported data, so they cannot disagree.
- See [`evaluation_results/README.md`](../evaluation_results/README.md) for which results folder holds which numbers.

---

## X. Limitations

**In one line:** be upfront about these five. Professors respect it.

1. **Label noise:** labels come from file names, so background traffic recorded during an attack carries the attack label.
2. **Only 81 benign flows:** false-alarm rates are indicative only, and attack-vs-benign (binary) classification is meaningless here.
3. **Random split:** near-duplicate flows from one capture can land on both sides of the split. Grouped splits are implemented but not reported.
4. **One testbed and default tool settings:** a slowed-down or disguised scan would change exactly the timing features the detector relies on.
5. **Untested responses; unused data:** the response guidance wasn't measured, and the dataset's host and power data, which might separate the scans, aren't used.

---

## XI. Conclusion and Future Work

**In one line:** the high CICEVSE2024 accuracies are mostly artefacts; honest numbers show floods solved and scans data-limited, and the system turns that into reliable alerts.

**Future work:**
- (a) Model the packet sequence inside each flow. Flow summaries throw that away, and it may separate the scan modes.
- (b) Fuse in the host and power data.
- (c) Test sequence models on grouped splits against the "repeat the previous label" baseline, which any model on an ordered stream must beat to show it is learning.

**Publication plan:** our guide advised submitting to an Elsevier journal rather than a conference.

---

## Equation cheat sheet

| Eq. | What it is | Plain words |
|---|---|---|
| 1 | c(y) | Maps each attack to DoS / Recon / Benign |
| 2 | F1, macro-F1 | Per-class balance of precision and recall; average over classes |
| 3 | mean, std over seeds | Report variability, not one lucky run |
| 4 | single-feature probe | Accuracy from one column alone |
| 5 | prequential accuracy | Predict first, then learn, flow by flow |
| 6, 7 | ρ, autocorrelation | Chance the next label equals the previous one |
| 8 | ADWIN cut | When two halves of the window differ enough → drift alarm |
| 9, 10 | alignment H, p-value | How many alarms sit on file seams, compared with random placement |
| 11 | class weights | Rare classes weighted up |
| 12, 13 | D, C, E, FA | Detected / category / exact / false-alarm rates |
| 14 | separability S | How much one feature alone tells you |
| 15 | confidence gate | Name the attack only if sure enough; else report the category |
| 16 | primary model rule | Best at naming, then fewest false alarms |

## Who presents what

| Section | Presenter |
|---|---|
| I–II, V (findings) | Shardul (ML Pipelining & Evaluation) |
| III–IV, IX | Mukta (Cloud Deployment DevOps) |
| VI (system, API, website) | Neha (Frontend & API Integration) |
| VII–VIII (figures, results), X | Shruti (Data Viz & Testing) |
| XI | Shardul |
