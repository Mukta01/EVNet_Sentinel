#!/bin/bash
# Full-scale ARF+ADWIN runs for issue #53. Started manually; safe to re-run.
cd /Users/shard/projects/EVNet_Sentinel
D=data/processed_v2/extended-unscaled
P=predictions/arf-full
M=saved_models/arf-full
mkdir -p "$P" "$M"

echo "=== [$(date)] FULL ARF: capture order (file) -- primary run for #53 ==="
python3 -u -m src.models.arfadwin.train_arfadwin \
  --data-dir "$D" --target multiclass --full --stream-order file \
  --output-dir "$P" --model-save-dir "$M" --model-name arf_full_file
echo "=== [$(date)] capture-order run finished ==="

echo "=== [$(date)] FULL ARF: shuffled -- the paper's own default ==="
python3 -u -m src.models.arfadwin.train_arfadwin \
  --data-dir "$D" --target multiclass --full --stream-order shuffled \
  --output-dir "$P" --model-save-dir "$M" --model-name arf_full_shuffled
echo "=== [$(date)] shuffled run finished ==="
echo "ARF FULL RUNS COMPLETE"
