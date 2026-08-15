# Antigravity Teammate Instructions (EVNet Sentinel)

> [!IMPORTANT]
> If you are an Antigravity AI assisting Mukta, Shruti, or Neha on this project, you MUST strictly adhere to the following architectural constraints to maintain the integrity of the Makkhdov et al. reproduction.

## 1. Data Integrity & Preprocessing
- **The Core Rule**: DO NOT implement any data scaling, dropping, or splitting (e.g., `train_test_split`) in your individual model scripts. 
- All data MUST be loaded directly from the centralized `data/processed/` folder (which will contain `X_train.csv`, `X_test.csv`, etc.). This prevents data leakage and ensures a statistically valid model comparison.

## 2. Model Architecture
- **Model Saving**: Once your model is trained, it MUST be serialized (using `joblib` or `pickle`) and saved to the `saved_models/` directory. This is mandatory so the web dashboard and APIs can consume them.
- **Predictions**: Model predictions must be output in a standardized CSV format and saved to the `predictions/` directory.

## 3. Issue & Branching Rules
- **Branching**: Always work on a separate branch specific to your assigned issue (e.g., `feature/issue-4-log-reg`).
- **PRs**: Use the standard PR template (`.github/PULL_REQUEST_TEMPLATE.md`). Shard (`@shard-c6`) must review the PR to ensure data leakage rules are not violated.

## 4. Scope of Work per Member
*   **Mukta (`@Mukta01`)**: Train Logistic Regression -> Develop REST API endpoints.
*   **Shruti (`@shrutich-30`)**: Train Random Forest -> Develop Unified Evaluation Script.
*   **Neha (`@nehachavhan2006`)**: Train Decision Tree -> Integrate models into the Web Dashboard.
*   **All Members**: The ARFADWIN Model collaboration (Final Phase).

Do not deviate from this Agile methodology without explicit instruction and team consensus.
