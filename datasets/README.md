# Datasets

Raw RDD2022 data and generated image/label folders are intentionally not bundled. Use `python tools/download_rdd2022_india.py` to download the dataset subset, read the dataset licence/citation terms, and use `python tools/convert_rdd2022.py --input <extracted-folder> --output datasets/rdd2022_yolo` to prepare labels for YOLO training.

RDD2022 supports the road-damage portion of URBAN-EYES; it does not train the model to detect all civic categories (streetlights, garbage, traffic signals, blocked drains, footpaths). Those categories require their own labelled examples and retraining.
