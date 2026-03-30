#!/usr/bin/env python3
"""Batch download meme URLs from a text file."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from download_meme import MemeDownloadError, process_url


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Batch download meme clips from a file of URLs.")
    parser.add_argument("url_file", help="Text file with one URL per line")
    parser.add_argument("--category", help="Category to use for every URL")
    return parser


def iter_urls(file_path: Path):
    with file_path.open("r", encoding="utf-8") as handle:
        for line_number, raw_line in enumerate(handle, start=1):
            line = raw_line.strip()
            if not line or line.startswith("#"):
                continue
            yield line_number, line


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    url_file = Path(args.url_file)

    if not url_file.exists():
        print(f"Error: file not found: {url_file}", file=sys.stderr)
        return 1

    successes = 0
    failures = 0

    for line_number, url in iter_urls(url_file):
        print(f"[{line_number}] Downloading: {url}")
        try:
            output = process_url(url, category=args.category)
        except MemeDownloadError as exc:
            failures += 1
            print(f"  Failed: {exc}", file=sys.stderr)
            continue
        except KeyboardInterrupt:
            print("Cancelled.", file=sys.stderr)
            return 130

        successes += 1
        print(f"  Saved: {output}")

    print(f"Done. Successes: {successes}, Failures: {failures}")
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
