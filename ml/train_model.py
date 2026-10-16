#!/usr/bin/env python3
"""Train a small Ultralytics YOLO model for the converted RDD2022 dataset."""
from __future__ import annotations
import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default=str(ROOT / "datasets/rdd2022_yolo/data.yaml"))
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--batch", type=int, default=8)
    parser.add_argument("--device", default="auto", help="auto, cpu, 0 (GPU), or mps on supported Apple Silicon")
    parser.add_argument("--base", default="yolov8n.pt", help="Initial YOLO weights/model name")
    args = parser.parse_args()
    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise SystemExit("Ultralytics is not installed. Run: pip install -r requirements-ai.txt") from exc
    data_path = Path(args.data).resolve()
    if not data_path.exists():
        raise SystemExit(f"Dataset config not found: {data_path}. Convert RDD2022 first; see README.md.")
    model = YOLO(args.base)
    device = None if args.device == "auto" else args.device
    results = model.train(data=str(data_path), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                          device=device, project=str(ROOT / "runs"), name="urban-eyes-rdd2022", exist_ok=True)
    trainer = getattr(model, "trainer", None)
    best_value = getattr(trainer, "best", None) if trainer else None
    best = Path(str(best_value)) if best_value else None
    if not best or not best.exists():
        candidates = sorted((ROOT / "runs").rglob("best.pt"), key=lambda p: p.stat().st_mtime, reverse=True)
        best = candidates[0] if candidates else None
    if not best or not best.exists():
        raise SystemExit("Training finished but best.pt could not be located under runs/.")
    destination = ROOT / "models" / "best.pt"
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, destination)
    print(f"\nSaved model weights for URBAN-EYES inference: {destination}")
    print("Restart the server (if needed) and check /api/model-status.")

if __name__ == "__main__":
    main()
