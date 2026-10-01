# EVNet Sentinel — RMMM Document

## Risk Mitigation, Monitoring, and Management Plan

**Project:** EVNet Sentinel — Intrusion Detection System for EV Charging Networks  
**Prepared By:** Mukta Varak, Shruti Chaurasiya, Shardul Chogale, Neha Chavhan  
**Affiliation:** Dept. of Computer Engineering, Vidyalankar Institute of Technology, Mumbai  
**Date:** September 29, 2026  
**Version:** 1.0

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Risk Management Strategy](#2-risk-management-strategy)
3. [Step 1 — Risk Identification (Checklist)](#3-step-1--risk-identification-checklist)
4. [Step 2 — Risk Analysis (Probability & Impact)](#4-step-2--risk-analysis-probability--impact)
5. [Step 3 — Risk Exposure Calculation (RE = P × C)](#5-step-3--risk-exposure-calculation-re--p--c)
6. [Step 4 — Risk Ranking & First-Order Prioritization](#6-step-4--risk-ranking--first-order-prioritization)
7. [Step 5 — RMMM Plan for Top-Priority Risks](#7-step-5--rmmm-plan-for-top-priority-risks)
8. [Risk Information Sheets](#8-risk-information-sheets)
9. [Threshold & Overall Risk Table](#9-threshold--overall-risk-table)
10. [References](#10-references)

---

## 1. Introduction

EVNet Sentinel is a leakage-corrected Intrusion Detection System (IDS) for Electric Vehicle Charging Station (EVCS) networks. The system reproduces and benchmarks methods from Makhmudov et al. (2025) on the CICEVSE2024 dataset using a combination of static ML classifiers (Random Forest, Decision Tree, Logistic Regression, SVM) and online adaptive learning (ARF + ADWIN). The project also features a FastAPI backend with Docker deployment and a Next.js real-time dashboard.

**Purpose of this Document:**  
This RMMM document systematically identifies, analyses, ranks, and proposes mitigation, monitoring, and management strategies for all potential risks that could threaten the successful completion of the EVNet Sentinel project. The methodology follows the four-step risk management process:

1. **Identify** risks using a structured checklist  
2. **Analyse** each risk for probability of occurrence and impact  
3. **Rank** risks by computing Risk Exposure (RE = Probability × Cost/Impact)  
4. **Manage** risks via Mitigation (avoidance), Monitoring (tracking), and Management (contingency)

---

## 2. Risk Management Strategy

### 2.1 Risk Categories

Risks are classified into three primary categories as per software engineering risk management practice:

| Category | Code | Description |
|---|---|---|
| **Technical (TE)** | TE | Risks related to technology, tools, frameworks, algorithms, data, and infrastructure |
| **Business (BU)** | BU | Risks related to project scope, schedule, budget, academic deadlines, and stakeholder expectations |
| **Staff / People (ST)** | ST | Risks related to team members, skills, availability, communication, and knowledge gaps |

### 2.2 Impact Scale

Impact is rated on a **1–4 scale** where higher values represent more severe consequences:

| Impact Rating | Level | Description | Estimated Cost (₹) |
|---|---|---|---|
| **4** | **Catastrophic** | Project failure; complete re-work required; academic deadline missed | ₹1,00,000+ |
| **3** | **Critical** | Major deliverable delayed by >1 week; significant quality degradation | ₹50,000 |
| **2** | **Marginal** | Partial feature degradation; 2–5 day delay; workaround available | ₹10,000 |
| **1** | **Negligible** | Minor inconvenience; <1 day delay; no functional impact | ₹1,000 |

### 2.3 Probability Scale

Probability of occurrence is estimated on a **0.0–1.0** continuous scale:

| Range | Level | Description |
|---|---|---|
| **0.81 – 1.00** | Very High | Almost certain to occur |
| **0.61 – 0.80** | High | Likely to occur |
| **0.41 – 0.60** | Moderate | May or may not occur |
| **0.21 – 0.40** | Low | Unlikely to occur |
| **0.01 – 0.20** | Very Low | Rare; only under exceptional circumstances |

### 2.4 Risk Exposure Formula

> **RE = P × C**  
> Where **P** = Probability of occurrence (0.0–1.0) and **C** = Cost/Impact (₹)

---

## 3. Step 1 — Risk Identification (Checklist)

The following risks were identified using a structured checklist approach, covering all three categories relevant to EVNet Sentinel:

### 3.1 Technical Risks (TE)

| ID | Risk Description |
|---|---|
| TE-01 | **Data leakage in the CICEVSE2024 dataset** — Capture-session timestamp columns act as proxies for the class label, inflating model accuracy. If not detected and corrected, all evaluation results are invalid. |
| TE-02 | **Server / Backend failure** — FastAPI backend crashes due to model loading errors, memory exhaustion from large .pkl files (RF ≈ 38 MB, ARF up to 97 MB), or Docker container runtime failures. |
| TE-03 | **Dependency version incompatibility** — River ML library API changed materially around v0.21; scikit-learn's tree-splitting and class_weight behaviour shifts across minor releases, making results unreproducible with unpinned versions. |
| TE-04 | **Dataset unavailability or corruption** — The 2.4 GB CICEVSE2024 dataset is hosted on restricted Google Drive; download failures, link expiration, or file corruption block all ML training. |
| TE-05 | **Docker build failures** — River's `_river_rust` extension requires Rust/C++ compilation; multi-stage Docker builds silently lose dynamically linked libraries, causing `ModuleNotFoundError` at runtime. |
| TE-06 | **WebSocket connection instability** — Real-time dashboard relies on WebSocket connections to the FastAPI backend; dropped connections cause stale UI data and missed drift alerts. |
| TE-07 | **Model overfitting to capture-session artifacts** — Even after timestamp removal, `src_port` ephemeral allocation creates contiguous per-capture bands that tree models memorise, producing illusory accuracy gains. |
| TE-08 | **Concept drift detection false positives** — ADWIN triggers on dataset-assembly seams (42 of 43 drift events in capture order) rather than genuine traffic evolution, misleading system operators. |
| TE-09 | **Insufficient benign class samples** — Only 81 benign flows exist in the network-traffic subset, making binary classification trivially solvable by predicting "attack" unconditionally and invalidating binary metrics. |
| TE-10 | **Large model file storage exceeding GitHub limits** — Random Forest .pkl is 38 MB and ARF pipelines up to 97 MB; GitHub's 100 MB file limit blocks direct version-control of models. |
| TE-11 | **Database / processed data loss** — Processed datasets in `data/processed/` are generated by the preprocessing pipeline and not committed to Git; a local machine failure loses hours of data processing work. |
| TE-12 | **Next.js frontend build failures** — `.next/` build cache corruption, Node.js version mismatches, or TailwindCSS configuration conflicts break the dashboard during development. |

### 3.2 Business Risks (BU)

| ID | Risk Description |
|---|---|
| BU-01 | **Requirement changes mid-project** — Scope expansion beyond the SRS v1.2 baseline (e.g., adding LSTM comparator, packet-level models) during the 52-day development window. |
| BU-02 | **Academic deadline overrun** — Failing to deliver all required documentation (SRS, RMMM, research paper, project management docs) and working software by the 25 September 2026 deadline. |
| BU-03 | **Inflated accuracy claims in publications** — If the leakage correction is not communicated clearly, external reviewers may challenge the validity of both the original and corrected results. |
| BU-04 | **Dataset licensing and access restrictions** — CICEVSE2024 is from the Canadian Institute for Cybersecurity with specific usage terms; unauthorised redistribution could cause legal/ethical issues. |
| BU-05 | **Stakeholder misalignment on evaluation metrics** — Academic evaluators expecting raw accuracy (>99%) may view the corrected macro-F₁ (0.558) as a failure rather than a methodological improvement. |

### 3.3 Staff / People Risks (ST)

| ID | Risk Description |
|---|---|
| ST-01 | **Team member unavailability** — A team member (4-person team) becomes unavailable due to illness, exams, or personal reasons during the 52-day critical development window. |
| ST-02 | **Skill gaps in online ML (River framework)** — No team member has prior experience with River's streaming ML API; learning curve delays ARF+ADWIN implementation. |
| ST-03 | **Git workflow conflicts and merge failures** — Multiple feature branches (feature/dt-model, feature/logreg-model, etc.) cause complex merge conflicts when integrating into main. |
| ST-04 | **Uneven workload distribution** — One team member handling both backend API and Docker deployment while others have lighter assignments, leading to bottleneck and burnout. |
| ST-05 | **Communication gaps between frontend and backend teams** — API contract mismatches between the FastAPI endpoints and the Next.js frontend cause integration failures during the final sprint. |

---

## 4. Step 2 — Risk Analysis (Probability & Impact)

| Risk ID | Risk Description (Short) | Category | Probability (P) | Impact (C) | Impact Level |
|---|---|---|---|---|---|
| TE-01 | Data leakage in CICEVSE2024 | TE | 0.95 | 4 — Catastrophic | ₹1,00,000 |
| TE-02 | Server / backend failure | TE | 0.50 | 3 — Critical | ₹50,000 |
| TE-03 | Dependency version incompatibility | TE | 0.70 | 3 — Critical | ₹50,000 |
| TE-04 | Dataset unavailability / corruption | TE | 0.40 | 4 — Catastrophic | ₹1,00,000 |
| TE-05 | Docker build failures (Rust/C++) | TE | 0.60 | 3 — Critical | ₹50,000 |
| TE-06 | WebSocket connection instability | TE | 0.45 | 2 — Marginal | ₹10,000 |
| TE-07 | Model overfitting to src_port artifact | TE | 0.80 | 3 — Critical | ₹50,000 |
| TE-08 | ADWIN drift detection false positives | TE | 0.85 | 2 — Marginal | ₹10,000 |
| TE-09 | Insufficient benign class samples | TE | 0.90 | 2 — Marginal | ₹10,000 |
| TE-10 | Large model files exceed GitHub limits | TE | 0.65 | 1 — Negligible | ₹1,000 |
| TE-11 | Processed data loss (local machine) | TE | 0.30 | 2 — Marginal | ₹10,000 |
| TE-12 | Next.js frontend build failures | TE | 0.35 | 2 — Marginal | ₹10,000 |
| BU-01 | Requirement changes mid-project | BU | 0.60 | 3 — Critical | ₹50,000 |
| BU-02 | Academic deadline overrun | BU | 0.55 | 4 — Catastrophic | ₹1,00,000 |
| BU-03 | Inflated accuracy claims in publications | BU | 0.40 | 3 — Critical | ₹50,000 |
| BU-04 | Dataset licensing restrictions | BU | 0.20 | 2 — Marginal | ₹10,000 |
| BU-05 | Stakeholder metric misalignment | BU | 0.50 | 2 — Marginal | ₹10,000 |
| ST-01 | Team member unavailability | ST | 0.45 | 3 — Critical | ₹50,000 |
| ST-02 | Skill gaps in River framework | ST | 0.70 | 2 — Marginal | ₹10,000 |
| ST-03 | Git merge conflicts | ST | 0.55 | 1 — Negligible | ₹1,000 |
| ST-04 | Uneven workload distribution | ST | 0.60 | 2 — Marginal | ₹10,000 |
| ST-05 | Frontend–backend API contract mismatch | ST | 0.50 | 2 — Marginal | ₹10,000 |

---

## 5. Step 3 — Risk Exposure Calculation (RE = P × C)

> **Formula: RE = P × C**  
> Where P = Probability (0.0–1.0) and C = Estimated Cost Impact (₹)

| Rank | Risk ID | Risk Description (Short) | Cat | P | C (₹) | **RE (₹)** |
|---|---|---|---|---|---|---|
| 1 | **TE-01** | **Data leakage in CICEVSE2024** | TE | 0.95 | 1,00,000 | **₹95,000** |
| 2 | **BU-02** | **Academic deadline overrun** | BU | 0.55 | 1,00,000 | **₹55,000** |
| 3 | **TE-07** | **Model overfitting to src_port** | TE | 0.80 | 50,000 | **₹40,000** |
| 4 | **TE-04** | **Dataset unavailability** | TE | 0.40 | 1,00,000 | **₹40,000** |
| 5 | **TE-03** | **Dependency version incompatibility** | TE | 0.70 | 50,000 | **₹35,000** |
| 6 | **TE-05** | **Docker build failures** | TE | 0.60 | 50,000 | **₹30,000** |
| 7 | **BU-01** | **Requirement changes mid-project** | BU | 0.60 | 50,000 | **₹30,000** |
| 8 | **TE-02** | **Server / backend failure** | TE | 0.50 | 50,000 | **₹25,000** |
| 9 | **ST-01** | **Team member unavailability** | ST | 0.45 | 50,000 | **₹22,500** |
| 10 | **BU-03** | **Inflated accuracy claims** | BU | 0.40 | 50,000 | **₹20,000** |
| 11 | **TE-08** | **ADWIN drift false positives** | TE | 0.85 | 10,000 | **₹8,500** |
| 12 | **TE-09** | **Insufficient benign samples** | TE | 0.90 | 10,000 | **₹9,000** |
| 13 | **ST-02** | **Skill gaps in River framework** | ST | 0.70 | 10,000 | **₹7,000** |
| 14 | **ST-04** | **Uneven workload distribution** | ST | 0.60 | 10,000 | **₹6,000** |
| 15 | **BU-05** | **Stakeholder metric misalignment** | BU | 0.50 | 10,000 | **₹5,000** |
| 16 | **ST-05** | **Frontend–backend API mismatch** | ST | 0.50 | 10,000 | **₹5,000** |
| 17 | **TE-06** | **WebSocket instability** | TE | 0.45 | 10,000 | **₹4,500** |
| 18 | **TE-12** | **Next.js build failures** | TE | 0.35 | 10,000 | **₹3,500** |
| 19 | **TE-11** | **Processed data loss** | TE | 0.30 | 10,000 | **₹3,000** |
| 20 | **BU-04** | **Dataset licensing restrictions** | BU | 0.20 | 10,000 | **₹2,000** |
| 21 | **TE-10** | **Large model files on GitHub** | TE | 0.65 | 1,000 | **₹650** |
| 22 | **ST-03** | **Git merge conflicts** | ST | 0.55 | 1,000 | **₹550** |

---

## 6. Step 4 — Risk Ranking & First-Order Prioritization

### 6.1 First-Order Prioritization Criteria

Risks are classified into the **first-order priority** group if they satisfy BOTH conditions:
- **Highly Probable:** P ≥ 0.50
- **Highly Impactful:** Impact rating ≥ 3 (Critical or Catastrophic)

### 6.2 First-Order Priority Risks (Above Threshold)

The **risk threshold** is set at **RE ≥ ₹25,000**. Risks above this threshold require formal RMMM plans.

| Priority | Risk ID | Risk Description | Cat | P | Impact | RE (₹) | First-Order? |
|---|---|---|---|---|---|---|---|
| **#1** | **TE-01** | Data leakage in CICEVSE2024 | TE | 0.95 | Catastrophic (4) | ₹95,000 | ✅ Yes |
| **#2** | **BU-02** | Academic deadline overrun | BU | 0.55 | Catastrophic (4) | ₹55,000 | ✅ Yes |
| **#3** | **TE-07** | Model overfitting to src_port | TE | 0.80 | Critical (3) | ₹40,000 | ✅ Yes |
| **#4** | **TE-04** | Dataset unavailability | TE | 0.40 | Catastrophic (4) | ₹40,000 | ⚠️ Borderline |
| **#5** | **TE-03** | Dependency version incompatibility | TE | 0.70 | Critical (3) | ₹35,000 | ✅ Yes |
| **#6** | **TE-05** | Docker build failures | TE | 0.60 | Critical (3) | ₹30,000 | ✅ Yes |
| **#7** | **BU-01** | Requirement changes mid-project | BU | 0.60 | Critical (3) | ₹30,000 | ✅ Yes |
| **#8** | **TE-02** | Server / backend failure | TE | 0.50 | Critical (3) | ₹25,000 | ✅ Yes |

### 6.3 Below-Threshold Risks (Monitor Only)

Risks below the ₹25,000 threshold are tracked passively and revisited if conditions change:

| Risk ID | Risk Description | RE (₹) | Action |
|---|---|---|---|
| ST-01 | Team member unavailability | ₹22,500 | Monitor; escalate if team drops to <3 |
| BU-03 | Inflated accuracy claims | ₹20,000 | Monitor; address in paper review |
| TE-09 | Insufficient benign samples | ₹9,000 | Accept; document as known limitation |
| TE-08 | ADWIN drift false positives | ₹8,500 | Accept; characterised in findings |
| ST-02 | Skill gaps in River framework | ₹7,000 | Monitor; pair programming mitigates |
| ST-04 | Uneven workload distribution | ₹6,000 | Monitor; weekly redistribution reviews |
| BU-05 | Stakeholder metric misalignment | ₹5,000 | Monitor; add accuracy alongside macro-F₁ |
| ST-05 | Frontend–backend API mismatch | ₹5,000 | Monitor; OpenAPI spec enforced |
| TE-06 | WebSocket instability | ₹4,500 | Monitor; auto-reconnect implemented |
| TE-12 | Next.js build failures | ₹3,500 | Monitor; .next/ in .gitignore |
| TE-11 | Processed data loss | ₹3,000 | Monitor; Makefile regeneration available |
| BU-04 | Dataset licensing restrictions | ₹2,000 | Accept; academic use compliant |
| TE-10 | Large model files on GitHub | ₹650 | Accept; .gitignore already blocks .pkl |
| ST-03 | Git merge conflicts | ₹550 | Accept; feature-branch workflow prevents |

---

## 7. Step 5 — RMMM Plan for Top-Priority Risks

Detailed RMMM plans are prepared for the **8 first-order priority risks** (RE ≥ ₹25,000):

---

### RMMM Plan #1 — TE-01: Data Leakage in CICEVSE2024

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-01 |
| **Risk** | Capture-session timestamp columns (`bidirectional_first/last_seen_ms`, `src2dst_first/last_seen_ms`, `dst2src_first/last_seen_ms`) act as class-label proxies in the CICEVSE2024 dataset, inflating model accuracy to 0.9976 on a single column |
| **Probability** | 0.95 (confirmed via empirical testing) |
| **Impact** | 4 — Catastrophic (all reported evaluation numbers are invalid) |
| **RE** | ₹95,000 |

**Mitigation (Avoidance):**
- Drop all six absolute epoch-millisecond timestamp columns in `src/data_prep/preprocess.py` before any model training
- Implement an automated leakage audit script (`src/reproduction/replay_reference_preprocessing.py`) that runs a single-column decision tree probe on every feature and flags any column with accuracy > 0.50
- Add the `src_port` controlled experiment (`src/reproduction/srcport_control.py`) to detect residual ephemeral-port fingerprints
- Document the four findings explicitly in the research paper and findings document

**Monitoring (Tracking):**
- Run the leakage probe script as part of the CI pipeline on every change to the preprocessing code
- Track feature importance distributions: if any single feature exceeds 15% importance in Random Forest, flag for manual review
- Monitor the gap between accuracy and macro-F₁ — a gap > 0.25 suggests class-distribution masking genuine poor performance

**Management (Contingency):**
- If a new leakage vector is discovered post-correction, re-run the full 3-seed evaluation pipeline (`src/evaluation/run_experiments.py`) and update all reported numbers
- Maintain the `2×2 ablation` script to rapidly verify any feature-level leakage
- Keep the `data/reproduction/` directory to preserve before/after evidence

---

### RMMM Plan #2 — BU-02: Academic Deadline Overrun

| Attribute | Detail |
|---|---|
| **Risk ID** | BU-02 |
| **Risk** | Failing to deliver all documentation (SRS, RMMM, research paper, project management) and working software by the academic deadline |
| **Probability** | 0.55 |
| **Impact** | 4 — Catastrophic (academic failure; re-submission required) |
| **RE** | ₹55,000 |

**Mitigation (Avoidance):**
- Phase-wise timeline with hard milestones (Phase 1: Data & preprocessing by Aug 20; Phase 2: Model training by Sep 5; Phase 3: Dashboard & API by Sep 18; Phase 4: Documentation by Sep 25)
- Use the Gantt chart in `docs/EVNet_Sentinel_Project_Management.tex` as the single source of truth for schedule tracking
- Implement "documentation-as-you-go" — each feature branch includes its own docs update before merge
- Prioritise core deliverables (corrected benchmarks, research paper) over nice-to-have features (packet-level models, LSTM comparator)

**Monitoring (Tracking):**
- Weekly stand-up meetings (every Monday) to assess progress against milestones
- GitHub project board with columns: Backlog → In Progress → Review → Done
- Track the number of open PRs and unmerged feature branches weekly

**Management (Contingency):**
- If behind schedule by > 5 days at any milestone, drop lowest-priority features (e.g., attack simulation console polish, extra seed runs)
- Pre-prepare minimal viable documentation that can be expanded later
- Assign a documentation lead (Mukta Varak) responsible for final compilation

---

### RMMM Plan #3 — TE-07: Model Overfitting to src_port Artifact

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-07 |
| **Risk** | Ephemeral source ports are allocated near-sequentially by the OS, forming contiguous bands within each capture session. Tree-based models memorise these bands, inflating accuracy by up to 0.17 (Decision Tree) |
| **Probability** | 0.80 |
| **Impact** | 3 — Critical (misleading model comparison; publication integrity at risk) |
| **RE** | ₹40,000 |

**Mitigation (Avoidance):**
- Drop `src_port` from the feature set in the `extended` configuration of `preprocess.py`
- Run the controlled measurement (`src/reproduction/srcport_control.py`) showing RF and DT convergence after removal
- Use the `extended` (no src_port) configuration for all headline numbers
- Document Finding 4 with before/after comparison in the research paper

**Monitoring (Tracking):**
- Compare Decision Tree vs. Random Forest macro-F₁: if gap > 0.05, suspect a memorisation artifact and investigate
- Track feature importance of `src_port` if it is re-introduced for any experimental variant

**Management (Contingency):**
- If additional ephemeral-port-like features are discovered (e.g., flow ID sequences), apply the same controlled ablation methodology
- Maintain the `srcport_control.py` script as a template for future fingerprint detection

---

### RMMM Plan #4 — TE-04: Dataset Unavailability or Corruption

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-04 |
| **Risk** | The 2.4 GB CICEVSE2024 dataset hosted on Google Drive becomes unavailable (link expiry, quota exceeded, CIC server down) or corrupted during download |
| **Probability** | 0.40 |
| **Impact** | 4 — Catastrophic (all ML training blocked; no alternative dataset) |
| **RE** | ₹40,000 |

**Mitigation (Avoidance):**
- Download dataset immediately at project start (Aug 05) — done ✅
- Maintain at least two local copies of the raw dataset across different team members' machines
- Store the dataset URL securely in `.env` (never hardcoded in code or docs)
- Verify file integrity with checksums after download (documented in `docs/dataset_manifest.json`)

**Monitoring (Tracking):**
- Test the download URL monthly; if it returns 404, escalate immediately
- Monitor `data/raw/` directory for unexpected file size changes

**Management (Contingency):**
- If the Google Drive link expires, contact the Canadian Institute for Cybersecurity for a replacement link
- The processed data can be regenerated from raw CSVs via `make data-process`, so only the raw files need backup
- As a last resort, the `evaluation_results/` directory contains pre-computed metrics that allow documentation to proceed even without re-training

---

### RMMM Plan #5 — TE-03: Dependency Version Incompatibility

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-03 |
| **Risk** | River's streaming ML API changed materially around v0.21; scikit-learn's tree-splitting and class_weight behaviour shifts across minor releases; unpinned dependencies produce unreproducible results |
| **Probability** | 0.70 |
| **Impact** | 3 — Critical (evaluation numbers become unreproducible; paper claims invalidated) |
| **RE** | ₹35,000 |

**Mitigation (Avoidance):**
- Pin all dependency versions exactly in `requirements.txt` (e.g., `river==0.26.1`, `scikit-learn==1.8.0`, `numpy==2.4.4`)
- Document the verified environment (Python 3.13.12, macOS 26.5, arm64) in `requirements.txt` header comments
- Use virtual environments (`.venv`) to isolate project dependencies from system packages
- Docker container locks the exact environment for deployment

**Monitoring (Tracking):**
- Run `pip freeze` after any dependency change and diff against `requirements.txt`
- CI pipeline runs `pip install -r requirements.txt` and executes a smoke test on every PR
- Track River and scikit-learn changelogs for breaking changes

**Management (Contingency):**
- If a dependency upgrade is required, create a dedicated branch, re-run the full 3-seed evaluation, and verify all numbers match before merging
- Maintain the Docker image as a "known-good" reproducible environment
- The `Makefile` provides `make setup` for one-command environment recreation

---

### RMMM Plan #6 — TE-05: Docker Build Failures (Rust/C++ Compilation)

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-05 |
| **Risk** | River's `_river_rust` extension requires Rust toolchain compilation; multi-stage Docker builds lose dynamically linked libraries, causing `ModuleNotFoundError` at runtime |
| **Probability** | 0.60 |
| **Impact** | 3 — Critical (backend cannot start; no inference possible; demo fails) |
| **RE** | ₹30,000 |

**Mitigation (Avoidance):**
- Use single-stage Docker build (`python:3.10-slim` base) to preserve all compilation artifacts
- Install Rust via `rustup` during build, compile River, then uninstall Rust toolchain to reduce image size
- Pin the Docker base image version to prevent upstream OS-level changes
- Test Docker build on every release tag

**Monitoring (Tracking):**
- Add Docker build to CI/CD pipeline — any build failure triggers immediate notification
- Track Docker image size to detect bloat from unnecessary build artifacts
- Monitor River's release notes for changes to the Rust compilation process

**Management (Contingency):**
- If single-stage build becomes impractical (image too large), investigate copying the compiled `.so` file from a builder stage
- Maintain a pre-built Docker image on a team member's registry as a fallback
- For local development, provide `make setup` as a non-Docker alternative

---

### RMMM Plan #7 — BU-01: Requirement Changes Mid-Project

| Attribute | Detail |
|---|---|
| **Risk ID** | BU-01 |
| **Risk** | Scope creep beyond SRS v1.2 baseline — e.g., adding LSTM sequence models, packet-level analysis, host-based IDS, or power consumption fusion during the 52-day window |
| **Probability** | 0.60 |
| **Impact** | 3 — Critical (diverts resources from core deliverables; delays deadline) |
| **RE** | ₹30,000 |

**Mitigation (Avoidance):**
- Freeze requirements after SRS v1.2 approval — any new feature request goes to "Phase 2 Backlog"
- Document the LSTM warning explicitly in the research paper Limitations section: training a sequence model on capture-ordered flows would exploit the same label autocorrelation
- Maintain strict adherence to the defined epics and user stories in the project management document

**Monitoring (Tracking):**
- Track new feature requests in GitHub Issues with a `scope-change` label
- Weekly scope review: count the number of unplanned tasks added vs. planned tasks completed
- If the ratio of unplanned/planned > 0.3, trigger a formal scope review meeting

**Management (Contingency):**
- If a requirement change is unavoidable, apply MoSCoW prioritisation: classify as Must-have, Should-have, Could-have, or Won't-have
- Drop the lowest-priority existing feature to accommodate the new requirement
- Document the scope change and its impact on the timeline in the project management document

---

### RMMM Plan #8 — TE-02: Server / Backend Failure

| Attribute | Detail |
|---|---|
| **Risk ID** | TE-02 |
| **Risk** | FastAPI backend crashes at runtime due to model loading failures (corrupted .pkl), memory exhaustion from loading multiple large models simultaneously, or unhandled exceptions in prediction endpoints |
| **Probability** | 0.50 |
| **Impact** | 3 — Critical (dashboard offline; live demo fails; no real-time detection) |
| **RE** | ₹25,000 |

**Mitigation (Avoidance):**
- Dynamic Model Registry with `try/except` fault tolerance — if one model fails to load, others continue serving
- Memory-map large .pkl files where possible to reduce RAM footprint
- Implement health-check endpoint (`/health`) that reports status of each loaded model
- Set Uvicorn worker count based on available memory (1 worker for development, scale for production)

**Monitoring (Tracking):**
- Health-check endpoint polled every 60 seconds by the frontend dashboard
- Log model loading status and memory usage at startup
- Monitor Docker container resource usage (CPU, RAM) via `docker stats`

**Management (Contingency):**
- If a specific model consistently fails, remove it from the `saved_models/` directory and serve predictions from remaining models
- Implement automatic container restart via Docker `--restart=unless-stopped` flag
- Pre-compute evaluation results so that the dashboard can display static data as a fallback when the backend is down

---

## 8. Risk Information Sheets

Detailed Risk Information Sheets for the top 3 risks:

---

### Risk Information Sheet — TE-01

```
╔══════════════════════════════════════════════════════════════╗
║                   RISK INFORMATION SHEET                    ║
╠══════════════════════════════════════════════════════════════╣
║ Risk ID:        TE-01                                       ║
║ Date:           September 29, 2026                          ║
║ Reported By:    Shardul Chogale (ML Pipelining Lead)        ║
║                                                             ║
║ DESCRIPTION:                                                ║
║ Six absolute epoch-millisecond timestamp columns in the     ║
║ CICEVSE2024 dataset act as capture-session identifiers.     ║
║ A DecisionTree(max_depth=25) trained on                     ║
║ bidirectional_first_seen_ms alone achieves 0.9976 accuracy  ║
║ on the 15-class target — exceeding the published 0.9840.    ║
║ The reference preprocessing retains all six timestamps      ║
║ while dropping dst_port, the legitimate reconnaissance      ║
║ feature.                                                    ║
║                                                             ║
║ CATEGORY:       Technical (TE)                              ║
║ PROBABILITY:    0.95 (Very High — empirically confirmed)    ║
║ IMPACT:         4 — Catastrophic (₹1,00,000)               ║
║ RISK EXPOSURE:  ₹95,000                                    ║
║ PRIORITY:       #1 (First-Order)                            ║
║                                                             ║
║ CONTEXT / ROOT CAUSE:                                       ║
║ Each attack class was captured in a dedicated pcap file at  ║
║ a distinct wall-clock time. The timestamps encode "when"    ║
║ data was recorded, not "what" the traffic did. 39.8% of     ║
║ Random Forest feature importance was on timestamps.         ║
║                                                             ║
║ REFINEMENT / MITIGATION:                                    ║
║ • Drop all 6 timestamp columns in preprocessing pipeline    ║
║ • Drop src_port as secondary fingerprint                    ║
║ • Retain dst_port for legitimate reconnaissance signal      ║
║ • Run leakage probe on every preprocessing change           ║
║ • Document as Finding 1 in research paper                   ║
║                                                             ║
║ CURRENT STATUS: ✅ MITIGATED                                ║
║ All timestamps dropped; corrected benchmarks published.     ║
║ Leakage audit documented in docs/leakage_audit_results.md   ║
╚══════════════════════════════════════════════════════════════╝
```

---

### Risk Information Sheet — BU-02

```
╔══════════════════════════════════════════════════════════════╗
║                   RISK INFORMATION SHEET                    ║
╠══════════════════════════════════════════════════════════════╣
║ Risk ID:        BU-02                                       ║
║ Date:           September 29, 2026                          ║
║ Reported By:    Mukta Varak (Cloud Deployment Lead)         ║
║                                                             ║
║ DESCRIPTION:                                                ║
║ The project has a fixed academic deadline of 25 September   ║
║ 2026. Deliverables include: working software (FastAPI +     ║
║ Next.js), SRS document, RMMM document, project management   ║
║ document, research paper (IEEE format), and presentation.   ║
║ A 52-day development window with a 4-person team creates    ║
║ tight schedule constraints.                                 ║
║                                                             ║
║ CATEGORY:       Business (BU)                               ║
║ PROBABILITY:    0.55 (Moderate — tight but feasible)        ║
║ IMPACT:         4 — Catastrophic (₹1,00,000)               ║
║ RISK EXPOSURE:  ₹55,000                                    ║
║ PRIORITY:       #2 (First-Order)                            ║
║                                                             ║
║ CONTEXT / ROOT CAUSE:                                       ║
║ Parallel development across ML pipeline, API backend,       ║
║ frontend dashboard, and 5+ documentation deliverables with  ║
║ only 4 team members. Leakage discovery (mid-project) forced ║
║ a complete re-evaluation of all model results.              ║
║                                                             ║
║ REFINEMENT / MITIGATION:                                    ║
║ • Phase-wise milestones with weekly progress reviews        ║
║ • Gantt chart tracking in project management document       ║
║ • Documentation-as-you-go policy for each feature branch    ║
║ • MoSCoW prioritisation for feature scope control           ║
║ • Dedicated documentation lead assignment                   ║
║                                                             ║
║ CURRENT STATUS: ⚠️ ACTIVE — BEING MONITORED                ║
║ Core software delivered. Research paper draft v1 submitted  ║
║ via PR #68. RMMM and remaining docs in progress.            ║
╚══════════════════════════════════════════════════════════════╝
```

---

### Risk Information Sheet — TE-07

```
╔══════════════════════════════════════════════════════════════╗
║                   RISK INFORMATION SHEET                    ║
╠══════════════════════════════════════════════════════════════╣
║ Risk ID:        TE-07                                       ║
║ Date:           September 29, 2026                          ║
║ Reported By:    Shardul Chogale (ML Pipelining Lead)        ║
║                                                             ║
║ DESCRIPTION:                                                ║
║ Ephemeral source ports (src_port) are allocated near-       ║
║ sequentially by the operating system, forming contiguous    ║
║ bands within each capture session. Decision Tree exploits   ║
║ this via depth-based band memorisation, gaining a 0.17      ║
║ advantage over Random Forest. After removal, both models    ║
║ converge to identical macro-F₁ ≈ 0.514.                    ║
║                                                             ║
║ CATEGORY:       Technical (TE)                              ║
║ PROBABILITY:    0.80 (High — inherent to OS port alloc.)    ║
║ IMPACT:         3 — Critical (₹50,000)                     ║
║ RISK EXPOSURE:  ₹40,000                                    ║
║ PRIORITY:       #3 (First-Order)                            ║
║                                                             ║
║ CONTEXT / ROOT CAUSE:                                       ║
║ OS-level sequential ephemeral port allocation creates       ║
║ capture-session-specific port bands. A deep tree can split  ║
║ these bands precisely, but a shallower ensemble cannot.     ║
║ The DT's apparent superiority was entirely memorisation.    ║
║                                                             ║
║ REFINEMENT / MITIGATION:                                    ║
║ • Drop src_port from the extended feature configuration     ║
║ • Run srcport_control.py to verify model convergence        ║
║ • Use convergence as a diagnostic for future fingerprints   ║
║ • Document as Finding 4 in the research paper               ║
║                                                             ║
║ CURRENT STATUS: ✅ MITIGATED                                ║
║ src_port dropped; DT and RF convergence confirmed across    ║
║ three random seeds.                                         ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 9. Threshold & Overall Risk Table

### 9.1 Risk Threshold Diagram

```
Risk Exposure (₹)
    │
    │  ₹95,000 ┤ ████████████████████████████████████████  TE-01 ★ CATASTROPHIC
    │           │
    │  ₹55,000 ┤ ███████████████████████                   BU-02 ★ CATASTROPHIC
    │           │
    │  ₹40,000 ┤ ████████████████████                      TE-07, TE-04
    │  ₹35,000 ┤ █████████████████                         TE-03
    │  ₹30,000 ┤ ███████████████                           TE-05, BU-01
    │  ₹25,000 ┤ █████████████                             TE-02
    │           │
    ╞══════════╪═══════════════════════════════════════════════════════════════
    │           │  ▲ THRESHOLD LINE (₹25,000) — RMMM plans required above
    │           │
    │  ₹22,500 ┤ ████████████                              ST-01
    │  ₹20,000 ┤ ██████████                                BU-03
    │   ₹9,000 ┤ █████                                     TE-09
    │   ₹8,500 ┤ ████                                      TE-08
    │   ₹7,000 ┤ ████                                      ST-02
    │   ₹6,000 ┤ ███                                       ST-04
    │   ₹5,000 ┤ ███                                       BU-05, ST-05
    │   ₹4,500 ┤ ██                                        TE-06
    │   ₹3,500 ┤ ██                                        TE-12
    │   ₹3,000 ┤ ██                                        TE-11
    │   ₹2,000 ┤ █                                         BU-04
    │     ₹650 ┤                                           TE-10
    │     ₹550 ┤                                           ST-03
    └──────────┴──────────────────────────────────────────────────
```

### 9.2 Summary Statistics

| Metric | Value |
|---|---|
| Total risks identified | 22 |
| Technical risks (TE) | 12 |
| Business risks (BU) | 5 |
| Staff risks (ST) | 5 |
| First-order priority risks (above threshold) | 8 |
| Risks with RMMM plans | 8 |
| Total combined risk exposure | ₹5,52,200 |
| Maximum single risk exposure | ₹95,000 (TE-01) |
| Minimum single risk exposure | ₹550 (ST-03) |
| Risks currently mitigated | 3 (TE-01, TE-07, TE-10) |
| Risks actively monitored | 5 (BU-02, TE-03, TE-05, BU-01, TE-02) |
| Risks accepted | 4 (TE-09, TE-08, BU-04, ST-03) |

### 9.3 Risk Distribution by Category

| Category | Count | Combined RE (₹) | % of Total RE |
|---|---|---|---|
| Technical (TE) | 12 | ₹3,76,150 | 68.1% |
| Business (BU) | 5 | ₹1,12,000 | 20.3% |
| Staff (ST) | 5 | ₹64,050 | 11.6% |
| **Total** | **22** | **₹5,52,200** | **100%** |

---

## 10. References

1. Pressman, R.S. & Maxim, B.R. (2020). *Software Engineering: A Practitioner's Approach*, 9th Edition. McGraw-Hill. — Chapter 31: Risk Management.
2. Sommerville, I. (2016). *Software Engineering*, 10th Edition. Pearson. — Chapter 22: Project Management, Risk Management.
3. Makhmudov, F. et al. (2025). "Online Machine Learning for Intrusion Detection in Electric Vehicle Charging Systems," *Mathematics*, 13(5), 712.
4. EVNet Sentinel Repository: [https://github.com/Mukta01/EVNet_Sentinel](https://github.com/Mukta01/EVNet_Sentinel)
5. EVNet Sentinel Project Management Document v2.0 (internal).
6. EVNet Sentinel SRS v1.2 (internal).

---

*End of RMMM Document — EVNet Sentinel v1.0*  
*Prepared: September 29, 2026 | Dept. of Computer Engineering, Vidyalankar Institute of Technology*
