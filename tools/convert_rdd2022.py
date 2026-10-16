#!/usr/bin/env python3
"""Convert labelled RDD2022 Pascal-VOC XML files to an Ultralytics YOLO dataset.

Expected input: extracted RDD2022 directory with XML annotations and source images.
The script only converts annotations it recognises: D00, D10, D20 and D40.
D43/D44 and other classes are ignored because this training setup focuses on road damage.
"""
from __future__ import annotations
import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

CLASS_MAP = {"D00": 0, "D10": 1, "D20": 2, "D40": 3}
CLASS_NAMES = {0: "D00_Longitudinal_crack", 1: "D10_Transverse_crack", 2: "D20_Alligator_crack", 3: "D40_Pothole"}
IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def local_name(root: Path, xml_file: Path, file_name: str, index: dict[str, list[Path]]) -> Path | None:
    candidates = [xml_file.parent / file_name, xml_file.parent.parent / file_name, root / file_name]
    for candidate in candidates:
        if candidate.exists() and candidate.suffix.lower() in IMAGE_SUFFIXES:
            return candidate
    matches = index.get(Path(file_name).name.lower(), [])
    if not matches:
        return None
    # Prefer a file whose parent country/source path matches the annotation's parent.
    for match in matches:
        if xml_file.parent == match.parent or xml_file.parent in match.parents or match.parent in xml_file.parents:
            return match
    return matches[0]


def convert_one(root: Path, xml_file: Path, index: dict[str, list[Path]]) -> tuple[Path, list[str]] | None:
    try:
        tree = ET.parse(xml_file)
        ann = tree.getroot()
    except (ET.ParseError, OSError):
        return None
    file_name = ann.findtext("filename") or (xml_file.stem + ".jpg")
    image_path = local_name(root, xml_file, file_name, index)
    if image_path is None:
        return None
    try:
        with Image.open(image_path) as im:
            width, height = im.size
    except Exception:
        return None
    if width <= 0 or height <= 0:
        return None
    labels: list[str] = []
    for obj in ann.findall("object"):
        name = (obj.findtext("name") or "").strip().upper()
        if name not in CLASS_MAP:
            continue
        box = obj.find("bndbox")
        if box is None:
            continue
        try:
            xmin = float(box.findtext("xmin", "0")); ymin = float(box.findtext("ymin", "0"))
            xmax = float(box.findtext("xmax", "0")); ymax = float(box.findtext("ymax", "0"))
        except ValueError:
            continue
        xmin = min(max(xmin, 0), width); xmax = min(max(xmax, 0), width)
        ymin = min(max(ymin, 0), height); ymax = min(max(ymax, 0), height)
        bw, bh = xmax - xmin, ymax - ymin
        if bw <= 0 or bh <= 0:
            continue
        xc = ((xmin + xmax) / 2) / width
        yc = ((ymin + ymax) / 2) / height
        labels.append(f"{CLASS_MAP[name]} {xc:.6f} {yc:.6f} {bw/width:.6f} {bh/height:.6f}")
    if not labels:
        return None
    return image_path, labels


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Root folder of extracted RDD2022 data")
    parser.add_argument("--output", default="datasets/rdd2022_yolo", help="Output YOLO dataset directory")
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--limit", type=int, default=0, help="Optional image limit for a quick smoke-test (0=all)")
    args = parser.parse_args()
    root = Path(args.input).resolve()
    out = Path(args.output).resolve()
    if not root.is_dir():
        raise SystemExit(f"Input folder not found: {root}")
    if not (0.05 <= args.val_ratio <= 0.4):
        raise SystemExit("--val-ratio must be between 0.05 and 0.4")

    print("Indexing source images…")
    image_index: dict[str, list[Path]] = {}
    for image in root.rglob("*"):
        if image.is_file() and image.suffix.lower() in IMAGE_SUFFIXES:
            image_index.setdefault(image.name.lower(), []).append(image)
    xml_files = sorted(root.rglob("*.xml"))
    if not xml_files:
        raise SystemExit("No .xml annotation files found. RDD2022 test images have no labels; use the labelled train subset.")
    print(f"Found {len(xml_files):,} XML annotations and {sum(map(len, image_index.values())):,} images.")

    rows = []
    seen = set()
    for xml_file in xml_files:
        converted = convert_one(root, xml_file, image_index)
        if not converted:
            continue
        img, labels = converted
        identity = (str(img.resolve()), tuple(labels))
        if identity in seen:
            continue
        seen.add(identity)
        rows.append((img, labels))
        if args.limit and len(rows) >= args.limit:
            break
    if len(rows) < 20:
        raise SystemExit(f"Only {len(rows)} annotated images could be converted. Check the RDD folder layout and that it contains train XML labels.")

    rng = random.Random(args.seed)
    rng.shuffle(rows)
    val_count = max(1, int(len(rows) * args.val_ratio))
    val_rows, train_rows = rows[:val_count], rows[val_count:]
    for split in ("train", "val"):
        (out / "images" / split).mkdir(parents=True, exist_ok=True)
        (out / "labels" / split).mkdir(parents=True, exist_ok=True)

    def write_split(items: list[tuple[Path, list[str]]], split: str) -> None:
        for idx, (img, labels) in enumerate(items):
            # Prefix with stable position and source directory to avoid collisions among countries.
            prefix = img.parent.name.replace(" ", "_")[:24]
            target_name = f"{prefix}_{idx:06d}{img.suffix.lower()}"
            shutil.copy2(img, out / "images" / split / target_name)
            (out / "labels" / split / (Path(target_name).stem + ".txt")).write_text("\n".join(labels) + "\n", encoding="utf-8")
    write_split(train_rows, "train")
    write_split(val_rows, "val")
    yaml = [
        f"path: {out.as_posix()}", "train: images/train", "val: images/val", "test:",
        "names:", "  0: D00_Longitudinal_crack", "  1: D10_Transverse_crack", "  2: D20_Alligator_crack", "  3: D40_Pothole", ""
    ]
    (out / "data.yaml").write_text("\n".join(yaml), encoding="utf-8")
    (out / "CONVERSION_SUMMARY.txt").write_text(
        f"RDD2022 XML to YOLO conversion\nSource: {root}\nConverted annotated images: {len(rows)}\nTrain images: {len(train_rows)}\nValidation images: {len(val_rows)}\nClasses: {CLASS_NAMES}\n\nSource dataset: RDD2022 / CRDDC 2022. Follow source licence and citation requirements.\n", encoding="utf-8")
    print(f"Converted {len(rows):,} images: {len(train_rows):,} train, {len(val_rows):,} validation")
    print(f"Dataset YAML: {out / 'data.yaml'}")

if __name__ == "__main__":
    main()
