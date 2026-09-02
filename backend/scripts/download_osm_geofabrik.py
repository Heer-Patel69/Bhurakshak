from __future__ import annotations

import argparse
import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path

import requests


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_URL = "https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf"
DEFAULT_OUTPUT = REPOSITORY_ROOT / "data" / "gis" / "raw" / "north-eastern-zone-latest.osm.pbf"


def download(url: str, output: Path, *, force: bool = False) -> dict:
    """Download atomically, verify the companion MD5 when available, and never overwrite silently."""
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists() and not force:
        raise FileExistsError(f"Raw OSM file already exists: {output}. Use --force for an explicit replacement.")
    temporary = output.with_suffix(output.suffix + ".part")
    if temporary.exists():
        temporary.unlink()
    sha256 = hashlib.sha256()
    md5 = hashlib.md5(usedforsecurity=False)
    with requests.get(url, stream=True, timeout=(20, 120)) as response:
        response.raise_for_status()
        headers = dict(response.headers)
        with temporary.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)
                    sha256.update(chunk)
                    md5.update(chunk)
    expected_md5 = None
    try:
        md5_response = requests.get(url + ".md5", timeout=(20, 30))
        md5_response.raise_for_status()
        expected_md5 = md5_response.text.strip().split()[0].lower()
    except requests.RequestException:
        expected_md5 = None
    actual_md5 = md5.hexdigest().lower()
    if expected_md5 and actual_md5 != expected_md5:
        temporary.unlink(missing_ok=True)
        raise ValueError("Downloaded Geofabrik PBF failed its published MD5 check.")
    temporary.replace(output)
    metadata = {
        "source": "OpenStreetMap contributors via Geofabrik",
        "license": "ODbL 1.0",
        "source_url": url,
        "downloaded_at": datetime.now(UTC).isoformat(),
        "last_modified": headers.get("Last-Modified"),
        "etag": headers.get("ETag"),
        "content_length_bytes": output.stat().st_size,
        "sha256": sha256.hexdigest(),
        "md5": actual_md5,
        "published_md5": expected_md5,
        "md5_verified": bool(expected_md5),
    }
    metadata_path = output.parent / "source_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Explicitly download the Geofabrik North-Eastern Zone OSM extract.")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--force", action="store_true", help="Explicitly replace an existing raw PBF.")
    args = parser.parse_args()
    metadata = download(args.url, args.output, force=args.force)
    print(
        json.dumps(
            {
                "output": str(args.output),
                "bytes": metadata["content_length_bytes"],
                "md5_verified": metadata["md5_verified"],
                "downloaded_at": metadata["downloaded_at"],
            }
        )
    )


if __name__ == "__main__":
    main()

