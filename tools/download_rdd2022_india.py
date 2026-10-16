#!/usr/bin/env python3
"""Download the India subset of RDD2022 from the link listed by its maintainer."""
from __future__ import annotations
import argparse
import shutil
import urllib.request
import zipfile
from pathlib import Path

URL = "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_India.zip"

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="data_downloads/RDD2022_India.zip")
    parser.add_argument("--extract-to", default="data_downloads/RDD2022_India")
    parser.add_argument("--skip-download", action="store_true", help="Only extract an existing ZIP")
    args = parser.parse_args()
    archive = Path(args.output).resolve()
    extract_to = Path(args.extract_to).resolve()
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not args.skip_download:
        if archive.exists():
            print(f"Archive already exists: {archive}")
        else:
            print("Downloading RDD2022 India subset (large file; may take a while)…")
            request = urllib.request.Request(URL, headers={"User-Agent": "URBAN-EYES academic prototype"})
            with urllib.request.urlopen(request, timeout=60) as response, archive.open("wb") as out:
                shutil.copyfileobj(response, out)
            print(f"Saved archive: {archive}")
    if not archive.exists():
        raise SystemExit(f"ZIP not found: {archive}")
    extract_to.mkdir(parents=True, exist_ok=True)
    print(f"Extracting to {extract_to}…")
    with zipfile.ZipFile(archive) as zf:
        # Resolve target paths before extraction to avoid Zip Slip path traversal.
        for member in zf.infolist():
            target = (extract_to / member.filename).resolve()
            if extract_to not in target.parents and target != extract_to:
                raise SystemExit("Archive contains an unsafe path; aborting extraction.")
        zf.extractall(extract_to)
    print("Done. Use the extracted folder with tools/convert_rdd2022.py --input <folder>.")

if __name__ == "__main__":
    main()
