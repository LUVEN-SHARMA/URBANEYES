#!/usr/bin/env python3
"""Evaluate models/best.pt on a held-out validation split."""
from __future__ import annotations
import argparse
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(ROOT / "datasets/rdd2022_yolo/data.yaml"))
    parser.add_argument("--model", default=str(ROOT / "models/best.pt"))
    parser.add_argument("--imgsz", type=int, default=640)
    args = parser.parse_args()
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("Install optional AI requirements first: pip install -r requirements-ai.txt") from exc
    model_path, data_path = Path(args.model), Path(args.data)
    if not model_path.exists():
        raise SystemExit(f"Trained model not found: {model_path}. Train first with ml/train_model.py.")
    if not data_path.exists():
        raise SystemExit(f"Dataset YAML not found: {data_path}. Convert RDD2022 first.")
    model = YOLO(str(model_path))
    result = model.val(data=str(data_path), imgsz=args.imgsz, split="val", plots=True)
    box = getattr(result, "box", None)
    if box:
        print(f"Precision:    {float(box.mp):.4f}")
        print(f"Recall:       {float(box.mr):.4f}")
        print(f"mAP@0.5:      {float(box.map50):.4f}")
        print(f"mAP@0.5:0.95: {float(box.map):.4f}")
    print("Metrics were calculated on the configured validation split; report these actual outputs, not expected accuracy.")

if __name__ == "__main__":
    main()
