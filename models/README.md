# Model weights

The backend loads `best.pt` from this folder by default. The trained weights are not included in this project archive because they must be produced by training on an appropriately licensed labelled dataset.

1. Follow the dataset and conversion instructions in the top-level `README.md`.
2. Train with `python ml/train_model.py --data datasets/rdd2022_yolo/data.yaml`.
3. Confirm `models/best.pt` exists, restart the server, and inspect `/api/model-status`.

If no weights are present, image/video uploads and issue reporting still work, but inference returns an honest manual-review response rather than a fake detection.
