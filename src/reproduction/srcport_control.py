"""Isolate the src_port effect: identical rows and split, column dropped at fit time."""
import pandas as pd, numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import f1_score, accuracy_score

D = "data/processed_v2/extended-both-ports" if False else "data/processed_v2/extended-random"
Xtr = pd.read_csv(f"{D}/X_train.csv"); ytr = pd.read_csv(f"{D}/y_train.csv")["Label_Multiclass"]
Xte = pd.read_csv(f"{D}/X_test.csv");  yte = pd.read_csv(f"{D}/y_test.csv")["Label_Multiclass"]
classes = np.array(sorted(ytr.unique()))
cw = dict(zip(classes, compute_class_weight('balanced', classes=classes, y=ytr)))
print(f"rows: train={len(Xtr):,} test={len(Xte):,}   (identical across both arms)")

for label, cols in [("with src_port", list(Xtr.columns)),
                    ("without src_port", [c for c in Xtr.columns if c != "src_port"])]:
    for mname, mk in [("RandomForest(d15,100)", lambda: RandomForestClassifier(
                            n_estimators=100, max_depth=15, class_weight=cw, random_state=42, n_jobs=-1)),
                      ("DecisionTree(d20)", lambda: DecisionTreeClassifier(
                            max_depth=20, class_weight=cw, random_state=42))]:
        m = mk(); m.fit(Xtr[cols], ytr); p = m.predict(Xte[cols])
        print(f"  {mname:<24} {label:<18} macro-F1 {f1_score(yte,p,average='macro',zero_division=0):.4f}"
              f"  acc {accuracy_score(yte,p):.4f}")
