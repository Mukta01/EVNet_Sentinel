"""
Gradient-boosted tree models (XGBoost, LightGBM) behind the same interface as
the scikit-learn models: string labels in, string labels out.

XGBoost needs integer class ids, so the wrapper encodes labels on fit and
decodes them on predict. That keeps every downstream consumer (the attack
harness, the dashboard exporters, the API) unchanged.
"""

import numpy as np
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_sample_weight


class LabelEncodedBooster:
    def __init__(self, kind, seed, **params):
        self.kind, self.seed, self.params = kind, seed, params
        self.encoder = LabelEncoder()
        self.model = None

    def _build(self):
        if self.kind == "xgboost":
            from xgboost import XGBClassifier
            return XGBClassifier(objective="multi:softprob", tree_method="hist", n_jobs=-1,
                                 random_state=self.seed, eval_metric="mlogloss",
                                 early_stopping_rounds=30, **self.params)
        from lightgbm import LGBMClassifier
        return LGBMClassifier(objective="multiclass", n_jobs=-1, random_state=self.seed,
                              verbose=-1, **self.params)

    def fit(self, X, y, X_val=None, y_val=None):
        y_enc = self.encoder.fit_transform(np.asarray(y))
        # Balanced weights, same rule as class_weight='balanced' for the other models.
        weight = compute_sample_weight("balanced", y_enc)
        self.model = self._build()
        fit_kw = {"sample_weight": weight}
        if X_val is not None:
            v_enc = self.encoder.transform(np.asarray(y_val))
            if self.kind == "xgboost":
                fit_kw["eval_set"] = [(X_val, v_enc)]
                fit_kw["verbose"] = False
            else:
                fit_kw["eval_X"], fit_kw["eval_y"] = X_val, v_enc
                from lightgbm import early_stopping
                fit_kw["callbacks"] = [early_stopping(30, verbose=False)]
        self.model.fit(X, y_enc, **fit_kw)
        return self

    @property
    def classes_(self):
        return self.encoder.classes_

    @property
    def feature_importances_(self):
        return self.model.feature_importances_

    def predict(self, X):
        return self.encoder.inverse_transform(np.asarray(self.model.predict(X)).astype(int).ravel())

    def predict_proba(self, X):
        return self.model.predict_proba(X)
