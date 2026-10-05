# Running EVNet Sentinel

How to start every server in this project, for development or a demo.
The same runbook, with stop procedures, is maintained as LaTeX in
[`EVNet_Sentinel_Runbook.tex`](./EVNet_Sentinel_Runbook.tex) ([PDF](./EVNet_Sentinel_Runbook.pdf)).
Keep the two in step when a command or port changes. For the demo-day walkthrough, see
[`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

## What there is to run

| Server | Command | Address | Needs |
|---|---|---|---|
| **Website**: landing page, dashboard, simulation, docs | `make web` | http://localhost:3100 | Node.js only |
| Website with live reload (while editing) | `make web-dev` | http://localhost:3000 | Node.js only |
| **Prediction API** (FastAPI) | `make api` | http://localhost:8000 | Python, plus the trained models |
| Animated diagrams (pipeline, API call) | `make diagrams` | http://localhost:8765 | Python only |

The two are independent. **The website does not call the API**: it reads results
that are already exported to `frontend/data/*.json`, so it runs on a fresh clone
with no dataset and no Python. The API is a separate service that classifies one
flow per request. Nothing else (database, queue, etc.) needs to be running.

## One-time setup

Install the tools listed below, then the project dependencies.

| Tool | Version used |
|---|---|
| Node.js | 20.9 or newer (developed on 26.4) |
| Python | 3.10 or newer (developed on 3.13) |
| GNU Make | any version |

```bash
# From the repository root
make setup                    # Python packages (requirements.txt)
cd frontend && npm install    # website packages
```

## Start the website

For a demo, use the production build. It is faster, and it always shows the
latest code:

```bash
make web
```

This runs `npm run build` and then `next start -p 3100`. The build takes about
30 seconds. When it prints `Ready`, open:

| Page | URL | What to show |
|---|---|---|
| Home | http://localhost:3100 | *Beat the Sentinel* (drag an attack onto a station), *Tune the detector*, then scroll the Mumbai story |
| Simulation | http://localhost:3100/simulation | Pick an attack, choose **Sent from**, launch; or run a campaign and watch the incident log |
| Dashboard | http://localhost:3100/dashboard | *Attack insights* tab; confusion matrix and drift timeline on *Findings* |
| Docs | http://localhost:3100/docs | "Method at a glance" pipeline and the architecture |

While you are editing the frontend, `make web-dev` gives live reload on port 3000
instead.

## Start the prediction API

```bash
make api
```

This serves the **corrected (leak-free) models** produced by
`src/evaluation/run_experiments.py`: Random Forest, Decision Tree, Logistic
Regression and SVM from `saved_models/multiseed/seed-42/`, with that run's
scaler. To use a different training seed, run `make api API_SEED=1337` (or
`2024`).

Check that it is up:

```bash
curl http://localhost:8000/
```

The response lists `models_loaded` and should show `"scaler_loaded": true`.

Classify a flow. `docs/examples/` has two real held-out flows from the dataset:

```bash
curl -X POST http://localhost:8000/predict -H "Content-Type: application/json" -d @docs/examples/predict_syn_flood.json
```

This returns `{"prediction_class":"SYN_Flood","status":"success"}`. The port-scan
sample comes back as `Slowloris_Scan`. That is not a bug: it is the scan
confusion described in the findings.

A request names its model and sends the 60 flow features:

```json
{ "model_name": "rf_model_multiclass", "features": { "dst_port": 443, "...": 0 } }
```

- **`model_name` is required in practice.** Its default (`arfadwin_model`) does
  not exist. Valid names are the ones `GET /` lists.
- **Missing features are filled with 0, and unknown ones are ignored**, so send
  all 60 features for a meaningful answer.
- Interactive API docs (Swagger UI) are at http://localhost:8000/docs.

### The API needs locally trained models

The model files are not in git. On a fresh clone, generate them once. This takes
about 9 minutes and needs the raw CICEVSE2024 captures:

```bash
python3 src/evaluation/run_experiments.py --raw-dir <path-to-raw-captures> --feature-set extended --seeds 42 1337 2024
```

This writes `saved_models/multiseed/` and `data/multiseed/`, which `make api` reads.

### Do not use `make run` for a demo

`make run` starts the same API, but it loads whatever is in the root of
`saved_models/`. That folder holds older artifacts, including a
`StandardScaler.pkl` fitted **with the six leaked timestamp columns**. Requests
with the corrected 60 features then fail with *"Feature names seen at fit time,
yet now missing: bidirectional_first_seen_ms…"*. `make api` avoids this.

### Docker is not demo-ready yet

The `Dockerfile` (described in [SETUP.md](./SETUP.md)) has the same problem as
`make run`. It copies the root `saved_models/` folder and points at its old
scaler, and it does not include the corrected scaler from `data/multiseed/`. Use
`make api` until the image is updated.

## Running both together

Use two terminals:

```bash
make web    # terminal 1: website on :3100
make api    # terminal 2: API on :8000
```

Stop either one with `Ctrl+C`.

## Refreshing what the website shows (optional)

The website's numbers come from committed JSON files in `frontend/data/`. You only
need these commands after retraining models or changing the evaluation. Each one
needs the local models and data described above. Run `make web` again afterwards.

| Command | Regenerates |
|---|---|
| `make insights` | Per-attack tests and the dashboard's *Attack insights* (`insights.json`) |
| `make figures` | Confusion, separability, drift (`paper.json`), the hero's tuning data (`hero.json`), and the paper figures in `docs/figures/` |
| `python3 src/evaluation/export_dashboard_data.py` | Findings and replay (`findings.json`, `simulation.json`) |
| `python3 src/evaluation/export_simulation_data.py` | The simulation console's flow pool (`network-sim.json`) |
| `python3 src/reproduction/attack_routes.py` | Who attacked which station (`attack-routes.json`); needs the raw captures |

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Port 3100 is in use` (or 3000 / 8000) | A previous server is still running. Stop it with `lsof -ti:3100 \| xargs kill`, using whichever port is busy. |
| The website shows old content after you edited code | Dev and production builds share one build folder, so `next dev` can serve stale pages. Stop the server and run `make web`. |
| API: `No models are loaded on the server` | The model files are missing. Run `run_experiments.py` (see above). |
| API: `Model '…' not found` | Pass a `model_name` from the `models_loaded` list returned by `GET /`. |
| API: `Feature names seen at fit time, yet now missing: …_seen_ms` | You started it with `make run`. Use `make api`. |
| `npm` errors about the Node version | Install Node.js 20.9 or newer. |
| The landing story doesn't animate | The visitor's system has *Reduce motion* turned on. The page then shows the same story as plain text, by design. |
