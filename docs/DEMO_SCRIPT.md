# Final demo script

A 25-minute walkthrough for the professor, from terminal to dashboard. Each section names its presenter by team role. Every command below was run on the demo laptop, and the timings are measured.

| Part | Presenter | Time |
|---|---|---|
| 0. Setup (before the professor arrives) | Mukta | 10 min before |
| 1. The problem and our claim | Shardul | 2 min |
| 2. How it works: animated diagrams | Mukta | 4 min |
| 3. Live terminal: the audit | Shardul | 5 min |
| 4. Live terminal: the API | Mukta | 3 min |
| 5. Figures and what they mean | Shruti | 4 min |
| 6. Website and dashboard | Neha (site), Shruti (dashboard) | 6 min |
| 7. Close | Shardul | 1 min |

---

## 0. Setup (Mukta, 10 minutes before)

Open four terminal tabs at the repository root.

```bash
make web
```
Tab 1: the website on http://localhost:3100 (about 30 s to build).

```bash
make api
```
Tab 2: the prediction API on http://localhost:8000 (ready in about 3 s).

```bash
make diagrams
```
Tab 3: the animated diagrams on http://localhost:8765.

Tab 4 stays free for the live commands.

**Browser tabs to have open, in order:**
1. http://localhost:8765/ml-pipeline.html
2. http://localhost:8765/predict-api.html
3. http://localhost:8000/docs (Swagger UI)
4. http://localhost:3100
5. http://localhost:3100/simulation
6. http://localhost:3100/dashboard
7. `docs/research paper/EVNet_Sentinel_Research_Paper_v2.pdf`

**Smoke test:**
```bash
curl -s localhost:8000/
```
This must show `"scaler_loaded": true` and four models.

> Do not run `make run`. It loads an old scaler that was fitted with the leaked timestamp columns, and every prediction fails.

### Optional: one public link with ngrok

Use this if the professor or anyone else should open the demo on their own device. The free ngrok plan gives one public domain, so a single link routes by path:

| Path | Goes to |
|---|---|
| `/` (and `/dashboard`, `/simulation`) | website, :3100 |
| `/api/` | prediction API, :8000 |
| `/diagrams/` | Archify diagrams, :8765 |

**1. Create the routing file once.** Save it as `~/ngrok-demo.yml`, outside the repo. Replace the domain with your own: it's shown on the ngrok dashboard under *Domains*.

```yaml
version: "3"
endpoints:
  - name: website
    url: https://sphere-dust-sandlot.ngrok-free.dev
    upstream: { url: 3100 }
    traffic_policy:
      on_http_request:
        - expressions: ["req.url.path.startsWith('/api/')"]
          actions:
            - type: url-rewrite
              config: { from: "^(https?://[^/]+)/api/(.*)$", to: "$1/$2" }
            - type: forward-internal
              config: { url: "https://api.internal" }
        - expressions: ["req.url.path.startsWith('/diagrams/')"]
          actions:
            - type: url-rewrite
              config: { from: "^(https?://[^/]+)/diagrams/(.*)$", to: "$1/$2" }
            - type: forward-internal
              config: { url: "https://diagrams.internal" }
  - name: api
    url: https://api.internal
    upstream: { url: 8000 }
  - name: diagrams
    url: https://diagrams.internal
    upstream: { url: 8765 }
```

**2. Start ngrok** in a fifth tab, after the three servers are up. It loads your normal ngrok config (which holds your login token) plus the routing file.

```bash
ngrok start --all --config "$HOME/Library/Application Support/ngrok/ngrok.yml" --config ~/ngrok-demo.yml
```

**3. Check it from the terminal.** This should return `SYN_Flood`:

```bash
curl -s -H "ngrok-skip-browser-warning: 1" -X POST https://<your-domain>/api/predict -H "Content-Type: application/json" -d @docs/examples/predict_syn_flood.json
```

Then open these links in a browser:

| Page | Link |
|---|---|
| Website | `https://<your-domain>/` |
| Dashboard | `https://<your-domain>/dashboard` |
| Pipeline diagram | `https://<your-domain>/diagrams/ml-pipeline.html` |
| API-call diagram | `https://<your-domain>/diagrams/predict-api.html` |

Notes:
- **Warning page:** first-time visitors see an ngrok page and click **Visit Site** once.
- **Swagger UI:** works only locally, at http://localhost:8000/docs.
- **The link is public:** anyone who has it can reach the site and the API while ngrok runs. Stop ngrok after the demo.
- **Website only?** `ngrok http 3100` is enough.

---

## 1. The problem and our claim (Shardul, 2 min)

**Say:**
- EV charging stations talk to a central management system (CSMS) over the network, and attackers can flood or scan them.
- Makhmudov et al. (2025) report 98.4% accuracy with an Adaptive Random Forest plus the ADWIN drift detector on the CICEVSE2024 dataset.
- We reproduced it and audited it. The 98.4% is mostly a **data leak**: the capture timestamps tell the model which file, and so which attack, each flow came from.
- With the leak removed, the best model reaches **0.558 macro-F1** (mean of 3 seeds). Floods are still named almost perfectly. Scans are detected but are hard to tell apart.
- We then built what an operator would need: per-attack tests, a dashboard, a prediction API and a response playbook.

---

## 2. How it works: animated diagrams (Mukta, 4 min)

The diagrams were made with **Archify**. Each box links to the exact source lines it describes (the `SRC` badge), at commit `339fba5`.

### `ml-pipeline.html`: the white box, end to end
Click **Still → Live** (top right) to animate the flow, then walk left to right:
1. **CICEVSE2024**: one CSV per attack capture, 1.92M flows. Not in git.
2. **preprocess.py** (red = where the audit happens):
   - drops the six `*_seen_ms` timestamps and `src_port`
   - removes duplicate flows
   - splits 70/15/15
   - fits the scaler on the training split only
3. **run_experiments.py**: trains 4 models (RF, DT, LR, SVM) × 3 seeds and saves 12 `.pkl` files. **ARF + ADWIN** runs separately, flow by flow, as a stream.
4. **Attack test harness**: sends 30 batches of 50 unseen flows per attack against every model. Everything lands in **evaluation_results/**, the single source of truth.
5. **Serve**:
   - The exporters turn those results into JSON, which the **website** and the **paper figures** both read, so they cannot disagree.
   - The **API** loads the seed-42 models directly.

Hover any box for its details, or click it to pin the upstream and downstream path.

### `predict-api.html`: inside one API call
Click **Live** and narrate:
1. **Startup (`make api`)**: FastAPI loads the scaler (which also defines the 60 expected features), then every model `.pkl` into an in-memory registry.
2. **`GET /`**: the health check returns the loaded models.
3. **`POST /predict`**:
   - Pydantic validates the body (bad body → 422).
   - The registry looks up `model_name` (unknown model → 400).
   - The flow becomes a one-row table: missing features are filled with 0 and columns reordered.
   - The scaler transforms the row and the classifier predicts.
   - The API returns `{prediction_class}`.
4. Point at the cards: why `make api` and not `make run`, the error paths, and the fact that **the website never calls the API**.

---

## 3. Live terminal: the audit (Shardul, 5 min)

**Step 1: the leak, replayed (Shardul's ML-pipeline role).** Rebuilds the paper's preprocessing exactly, then trains a decision tree on a single timestamp column:
```bash
make replay-reference
```
Takes about 20 seconds. **Point at:** `6/6` timestamp columns survive the published pipeline, and a decision tree on the timestamp column `bidirectional_first_seen_ms` **alone** scores **0.9976** (3-fold CV), higher than the paper's 0.9840. A timestamp says *when* a capture was recorded, not *what* the traffic is.

**Step 2: our per-attack test harness:**
```bash
make attack-test SEED=42
```
Runs in 5 seconds. Read the table aloud:
- **ID** = attack named exactly. All five volumetric floods are ID at 1.00 for every model.
- **CAT** = right category, wrong name. The scans.
- **DET** = flagged as malicious, wrong category. **MISS** = waved through as benign.
- Mixed campaigns: detected ≈ 1.000 for every model.
- The last line, `ALL GATES PASSED`, is a regression test: it fails if a future change breaks detection.

> This command rewrites `evaluation_results/attack_tests.json`. Afterwards, run `git checkout evaluation_results/attack_tests.json`.

**Step 3: the test suite:**
```bash
python3 -m pytest tests -q
```
55 tests pass in under a second.

**Step 4: where the numbers live:**
```bash
cat evaluation_results/README.md
```
Explain the status labels: **current** (multiseed, attack tests), **evidence** (leakfree, leakfree-reference), **historical** (the leaked 0.9994 we started from).

---

## 4. Live terminal: the API (Mukta, 3 min)

These run against the API started in tab 2. The JSON files hold real, unseen flows from the test split.

```bash
curl -s localhost:8000/
```
Shows the 4 loaded models and `scaler_loaded: true`.

```bash
curl -s -X POST localhost:8000/predict -H "Content-Type: application/json" -d @docs/examples/predict_syn_flood.json
```
Returns `SYN_Flood`: a flood, named exactly.

```bash
curl -s -X POST localhost:8000/predict -H "Content-Type: application/json" -d @docs/examples/predict_port_scan.json
```
Returns `Slowloris_Scan`. This is the main finding live: a port scan is caught as an attack but **misnamed**, because scans and Slowloris both hold slow, near-idle connections.

```bash
curl -s -X POST localhost:8000/predict -H "Content-Type: application/json" -d '{"model_name":"nope","features":{}}'
```
The 400 error path from the diagram.

Then open **http://localhost:8000/docs**: Swagger UI documents the API itself and lets you send a request from the browser.

---

## 5. Figures and what they mean (Shruti, 4 min)

All five are in `docs/figures/` and in paper v2. Each is drawn by `make_paper_figures.py` from the same JSON the dashboard reads.

| Figure | What it shows | What to say |
|---|---|---|
| `fig_pipeline.pdf` | The method in six steps | capture → remove leakage → split → detect → test per attack → respond |
| `fig_leak.pdf` | Three bars: the paper's 98.4%, one timestamp column alone at 99.76%, and our leak-free RF at 86.8% accuracy (macro-F1 0.558) | A single timestamp beats the published model, so the published accuracy cannot measure detection. |
| `fig_confusion_rf.pdf` | Random Forest confusion matrix, mean of 3 seeds. Rows are true classes, columns are predictions; green diagonal = correct, red = confusion; dashed lines separate the DoS, recon and benign blocks. | The flood block is a clean diagonal. Inside the recon block, the six scan types blur into each other and leak into Slowloris_Scan. |
| `fig_separability.pdf` | For each feature, how much of "which attack is this?" it answers on its own (mutual information ÷ label entropy) | For DoS the best feature answers **98%**. For scans the best answers only **5%**. Scans aren't hard because the models are weak; individual flows don't contain the information. |
| `fig_drift.pdf` | The top band shows the capture files in stream order. Green dots are ADWIN drift alarms in capture order (43 alarms, 99.97% accuracy); purple dots are the same stream shuffled (14 alarms, 55.85%). | 42 of 43 alarms fall within 50 flows of a file boundary. ADWIN detects the file switch, not real-world drift. Shuffle the stream and accuracy collapses. |

---

## 6. Website and dashboard (6 min)

### Neha: website (Frontend & API Integration), 3 min
1. **Home → Beat the Sentinel:** drag an attack card onto a charging station and watch it get detected and named. Try a flood (named exactly), then a scan (caught but often misnamed).
2. **Tune the detector:** move the confidence gate. A higher threshold means fewer exact names but fewer wrong ones.
3. **Scroll the story:** the testbed builds up piece by piece (CSMS and Wi-Fi, charger, car), then the map of Mumbai shows where Sentinel would sit. Mention that it is a **mirror-port IDS**: it watches a copy of the traffic and raises alerts, but never blocks.
4. **Simulation:**
   - Pick an attack and choose **Sent from** (Kali PC, Raspberry Pi or a malicious EV). Packets travel to the station that was really attacked in the dataset.
   - Run a **campaign** and show the incident log.
   - **Containment (simulated):** launch a SYN flood and watch **Site status & containment**.
     - The level goes Safe → Elevated → **Network not safe**, and Sentinel recommends quarantining the Kali PC.
     - Click **Approve quarantine**. The attacker is marked QUARANTINED, its packets turn grey and stop at the access point, and the site returns to Safe after 10 quiet flows.
     - Then run the *Low and slow* campaign: scans also make the site "not safe", but no quarantine is recommended, because scans are named correctly only 34% of the time.
     - Say: "Sentinel stays passive. It recommends; an operator approves a switch block on that one device; the chargers and CSMS can never be quarantined." The rules are in `frontend/data/containment-policy.json`, and `tests/test_containment.py` checks them on real held-out flows.

### Shruti: dashboard (Data Viz & Testing), 3 min
**Findings tab**, top to bottom:
- **Leak summary:** published vs single column vs corrected.
- **Class separation** and the **confusion explorer:** switch models; hover a cell for counts.
- **Feature separability:** the live version of the figure.
- **Model table:** mean ± std over 3 seeds.
- **Leak evidence** and **fingerprint ablation:** removing `src_port` closes the Decision Tree's gap.
- **Drift timeline** and **drift alignment:** alarms sit on file seams.
- **Figure export:** download any chart as an image.

**Attack insights tab:** what an operator would read.
- No attack slipped through as normal traffic.
- Floods are named exactly.
- Scans are recognised as scans but named only 34% of the time.
- SVM and Logistic Regression raise too many false alarms: 59% and 46% of normal flows, against 2% for Random Forest. That is why Random Forest is the recommendation.
- The playbook is split by audience: station owner, CSMS operator, analyst.

**Live inference tab:** replays held-out flows through every model with their confidence.

---

## 7. Close (Shardul, 1 min)

- **Reproduced:** the paper's pipeline, number for number.
- **Found:** a timestamp leak (one column scores 0.9976), and drift alarms that line up with capture-file seams.
- **Corrected:** leak-free macro-F1 is 0.558 ± 0.008. Floods are solved; scans are an open, data-limited problem.
- **Built:** per-attack tests with regression gates, an API, a dashboard and a response playbook.
- **Next:** the paper goes to an Elsevier journal, as the professor advised.

---

## Likely questions

| Question | Answer, and where to point |
|---|---|
| Why macro-F1 and not accuracy? | Floods are 99% of the data after dedup. Accuracy rewards the majority class; macro-F1 weights all 15 classes equally. See `evaluation_results/leakfree-reference/`: 0.996 accuracy, 0.70 macro-F1. |
| Is ADWIN useless then? | No. It works; here it fires on capture-file seams. The dataset has no real concept drift to detect. |
| Why not deep learning? | Per-flow features don't contain the information needed to separate scans (best feature: 5%). A bigger model can't recover information that isn't in the features. Session-level features would. |
| Does the attacker hit the car or the CSMS? | Neither. Every capture targets a charging station: Kali PC → EVSE-A/B, a Raspberry Pi for UDP floods, and a malicious EV scanning EVSE-B over the charging cable. Source: `src/reproduction/attack_routes.py`. |
| Can the website classify live traffic? | The site replays pre-computed results. The API classifies one flow per request, as shown in part 4. |

## After the demo

Stop every server in its tab with `Ctrl+C`. If a port stays busy:

```bash
pkill -f "ngrok start"; lsof -ti:3100,8000,8765 | xargs kill
```

```bash
git checkout evaluation_results/attack_tests.json
```
