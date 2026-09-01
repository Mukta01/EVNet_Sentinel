<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=250&section=header&text=EVNet%20Sentinel&fontSize=80&animation=fadeIn&fontAlignY=35&desc=Intrusion%20Detection%20for%20Electric%20Vehicle%20Charging%20Networks&descAlignY=60&descAlign=50" alt="EVNet Sentinel Banner" />
  
  <p align="center">
    <b>A robust, real-time Intrusion Detection System (IDS) for Electric Vehicle Charging Station (EVCS) networks.</b>
  </p>

  <p align="center">
    <a href="https://github.com/Mukta01/EVNet_Sentinel/stargazers"><img src="https://img.shields.io/github/stars/Mukta01/EVNet_Sentinel?style=for-the-badge&color=yellow" alt="Stars" /></a>
    <a href="https://github.com/Mukta01/EVNet_Sentinel/network/members"><img src="https://img.shields.io/github/forks/Mukta01/EVNet_Sentinel?style=for-the-badge&color=orange" alt="Forks" /></a>
    <a href="https://github.com/Mukta01/EVNet_Sentinel/issues"><img src="https://img.shields.io/github/issues/Mukta01/EVNet_Sentinel?style=for-the-badge&color=red" alt="Issues" /></a>
    <img src="https://img.shields.io/badge/Python-FastAPI-blue?style=for-the-badge&logo=python" alt="Python" />
    <img src="https://img.shields.io/badge/Next.js-React-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  </p>
</div>

---

## ⚡ Overview

EVNet Sentinel reproduces and benchmarks the methods from Makhmudov et al. (2025) using the CICEVSE2024 dataset. It utilizes a combination of static Machine Learning classifiers and Online Learning (ARF + ADWIN) to detect anomalous network traffic in near real-time. 

Beyond the research, this project introduces a stunning, interactive Next.js dashboard as a modern engineering and HCI contribution!

## 🚀 Features

- 🧠 **Hybrid ML Pipeline**: Compare Static models (RF, SVM, LR, DT) evaluated on **14-class multiclass** targets against Adaptive Online models.
- 🐳 **Robust Deployment**: Single-stage Docker container featuring dynamic multi-model registry loading and fault tolerance.
- ⚡ **Real-Time Detection**: WebSocket integration for instant anomaly alerts.
- 📊 **Interactive Dashboard**: Next.js-powered visualisations and live confusion matrices.
- 🛡️ **Cybersecurity-First**: Designed specifically for EVCS infrastructure vulnerabilities.

## 🏗️ Architecture

```mermaid
flowchart LR
    A[CICEVSE2024 Dataset] -->|Simulated Stream| B(FastAPI Backend)
    B -->|Pre-processing| C{ML Engine}
    C -->|Static Models| D[RF, SVM, DT, LR]
    C -->|Online Learning| E[ARF + ADWIN]
    D -->|Serialized .pkl| M[(Dynamic Model Registry)]
    E -->|Serialized .pkl| M
    M --> F[Results API]
    F <-->|WebSockets & REST| G[Next.js Dashboard]
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style G fill:#bbf,stroke:#333,stroke-width:2px
```

## 📁 Directory Structure

- `data/raw/`: Stores the original, unmodified dataset files.
- `data/processed/`: Contains the centralized, cleaned datasets (e.g., `X_train.csv`, `X_test.csv`). All models load data from here to prevent data leakage.
- `src/data_prep/`: Centralized scripts for data cleaning and preprocessing.
- `src/models/`: Dedicated subdirectories for each individual model (`svm`, `log_reg`, `random_forest`, `decision_tree`, `arfadwin`).
- `src/evaluation/`: Unified scripts to evaluate model performance and metrics.
- `src/api/`: Backend REST API endpoints for model serving.
- `web/`: Dedicated web dashboard UI codebase.
- `predictions/`: Shared folder where each model saves its prediction outputs as CSV files for standardized evaluation.
- `saved_models/`: Shared folder for serialized model weights (`.pkl` / `.joblib`) to be consumed by the web UI and API.
- `docs/`: Project documentation and specifications.

## 📚 Documentation

Detailed documentation has been separated into the `docs/` directory for better maintainability:

- 🏛️ [**Architecture Details**](./docs/ARCHITECTURE.md)
- ⚙️ [**Setup & Installation**](./docs/SETUP.md)
- 📚 [**Reference Papers Index**](./docs/papers.md)
- 📊 [**Dataset Feature Engineering**](./docs/dataset_feature_engineering.md)
- ⚖️ [**Dataset Resampling Trade-offs**](./docs/Resampling_Tradeoffs.md)
- 🎯 [**Use Case Diagrams**](./docs/evnet_sentinel_use_cases.md)
- 📄 [**Project SRS**](./docs/Project_SRS/WDL_SRS_EVNetSentinel.pdf)

## 📈 Model Performance & Notebooks

We rigorously evaluate our models on the 14-class attack dataset. View our interactive training notebooks and detailed evaluation reports below:

- 🌳 **Random Forest**: [Training Notebook](./src/models/random_forest/Random_Forest_Training.ipynb) | [Evaluation Report](./evaluation_results/rf_evaluation_summary.md)
- 📉 **Support Vector Machine (SVM)**: [Training Notebook](./src/models/svm/svm_training.ipynb) | [Evaluation Report](./evaluation_results/SVM_evaluation_summary.md)
- 🔄 **Adaptive Random Forest (ARF-ADWIN)**: [Implementation Script](./src/models/arfadwin/train_arfadwin.py) *(Online Learning Model)*

## 🔐 Dataset Access & Security Rules

The CICEVSE2024 dataset used for this project is heavy and access-restricted. Please follow these rules:
1. **Never commit the dataset**: All dataset archives and CSV files (`*.tar.xz`, `*.zip`, `*.csv`) are strictly ignored in `.gitignore`. Do NOT bypass this rule.
2. **Secure the URL**: The Google Drive URL for the dataset must never be hardcoded in the codebase or public documentation. 
3. **Local Setup & Data Retrieval**: 
   - Copy `.env.example` to `.env` in the root directory.
   - Add the Google Drive URL (provided by the team admin) to your `.env` file under `CICEVSE2024_DATASET_URL`.
   - Run the automated setup and data pipeline:
     ```bash
     make setup
     make data
     ```
   - *Note: `make data` will download the 2.4GB dataset, extract it to `data/raw/`, and process it into `data/processed/`. Ensure you have sufficient disk space.*

## 🙏 Acknowledgements & Citations

This project builds upon the foundational research and methodology open-sourced by the TATU-hacker team. We would like to acknowledge and cite their repository:
- [TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems](https://github.com/TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems)

Their work on online machine learning for EVCS intrusion detection heavily inspired our approach, particularly our implementation of the ARF-ADWIN model and the use of the CICEVSE2024 dataset.

## 👥 Meet The Team

| Roll No. | Name | Official Role Title | GitHub |
|----------|------|---------------------|--------|
| **24102A0013** | Mukta Varak | Cloud Deployment & Backend API | [@Mukta01](https://github.com/Mukta01) |
| **24102A0018** | Shruti Chaurasiya | Data Visualization & Testing QA | [@shrutich-30](https://github.com/shrutich-30) |
| **24102A0021** | Shardul Chogale | ML Pipelining & Model Evaluation | [@shard-c6](https://github.com/shard-c6) |
| **24102A0022** | Neha Chavhan | Frontend UI & Real-Time Integration | [@nehachavhan2006](https://github.com/nehachavhan2006) |

---
<div align="center">
  <i>Created for Software Engineering academic requirements.</i>
</div>
