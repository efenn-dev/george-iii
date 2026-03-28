import subprocess
import sys
from pathlib import Path


def load_urls(file_path: Path):
    for line in file_path.read_text(encoding="utf-8").splitlines():
        url = line.strip()
        if not url or url.startswith("#"):
            continue
        yield url


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python bulk-audit.py urls.txt")
        return 1

    urls_file = Path(sys.argv[1])
    if not urls_file.exists():
        print(f"File not found: {urls_file}")
        return 1

    audit_script = Path(__file__).with_name("audit.py")
    urls = list(load_urls(urls_file))
    if not urls:
        print("No URLs found in input file.")
        return 1

    success = 0
    failed = 0

    for url in urls:
        print(f"\n=== Auditing: {url} ===")
        result = subprocess.run([sys.executable, str(audit_script), url], check=False)
        if result.returncode == 0:
            success += 1
        else:
            failed += 1
            print(f"Audit failed for: {url}")

    print("\n=== Bulk Audit Summary ===")
    print(f"Total URLs: {len(urls)}")
    print(f"Successful: {success}")
    print(f"Failed: {failed}")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
