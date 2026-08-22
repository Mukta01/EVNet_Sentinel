import os
import glob
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
MODELS_DIR = PROJECT_ROOT / "saved_models"
PREDICTIONS_DIR = PROJECT_ROOT / "predictions"
SRC_MODELS_DIR = PROJECT_ROOT / "src" / "models"

def test_no_binary_models():
    """Rule: Epic 2 drops Binary classification. No _binary.pkl should exist."""
    binary_models = list(MODELS_DIR.glob("*_binary.pkl"))
    assert len(binary_models) == 0, f"Found binary models which violate Epic 2 rules: {binary_models}"

def test_out_of_core_compliance():
    """Rule: Epic 2 requires Out-of-Core learning (SGDClassifier, chunksize, partial_fit)."""
    # Find all python training scripts in src/models/
    training_scripts = []
    for root, _, files in os.walk(SRC_MODELS_DIR):
        for file in files:
            if file.endswith(".py") and "train" in file:
                training_scripts.append(Path(root) / file)
                
    for script in training_scripts:
        # Epic 2 out-of-core rules only apply to the scikit-learn baseline models
        if "arfadwin" in str(script):
            continue
    
        with open(script, "r") as f:
            content = f.read()
            
            # Allow skipping this check if the file explicitly says it doesn't support OOC
            if "# NO_OOC_REQUIRED" in content:
                continue
                
            assert "SGDClassifier" in content, f"{script.name} violates Epic 2: Must use SGDClassifier for out-of-core learning."
            assert "chunksize=" in content, f"{script.name} violates Epic 2: Must use pd.read_csv with chunksize."
            assert "partial_fit" in content, f"{script.name} violates Epic 2: Must use partial_fit for chunked training."

def test_predictions_naming_convention():
    """Rule: Predictions must be saved with _preds_multiclass.csv suffix."""
    # Check if there are any predictions that don't follow the suffix (ignoring any non-prediction files)
    preds = list(PREDICTIONS_DIR.glob("*.csv"))
    for pred in preds:
        if "arf_adwin" in pred.name or "mock" in pred.name:
            continue
        assert pred.name.endswith("_preds_multiclass.csv"), f"{pred.name} violates Epic 2 naming conventions for predictions."
