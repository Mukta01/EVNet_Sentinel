# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Students and researchers reproducing the research paper. They are looking to conduct research that inculcates computer networks, data warehousing and mining, software engineering methodologies, web development, and artificial intelligence.

## Product Purpose
To reproduce the research from Makhmudov et al. (2025) and make a collaborative comparative study of different machine learning models under a single collaborative hood, specifically for Intrusion Detection on Electric Vehicle Charging Systems.

## Positioning
Combining static ML with Online Learning (ARF+ADWIN) for real-time EVCS anomaly detection, while providing a stunning, interactive Next.js dashboard for visualizing live confusion matrices and alerts.

## Operating Context
Used in academic and research settings for evaluating ML models on the CICEVSE2024 dataset.

## Capabilities and Constraints
- Next.js frontend and FastAPI backend tech stack.
- The specific architecture and machine learning pipeline (Random Forest, SVM, Decision Tree, Logistic Regression, ARF+ADWIN).
- Strict dataset security rules (no committing dataset files, secure .env URL access).

## Evidence on Hand
- CICEVSE2024 dataset (restricted access via Google Drive, handled locally).
- Pre-trained models (.pkl files) for static models and online learning algorithms.
- Extensive documentation in `docs/` including architecture, SRS, and use cases.

## Product Principles
1. Maintain rigorous adherence to dataset security rules.
2. Prioritize accurate reproduction of research and robust model comparison.
3. Deliver a high-quality engineering and human-computer interaction (HCI) experience via the dashboard.
