"""
Optimize Etsy packs to fit 20MB limit.
Resizes PNGs to 2500px max, splits into parts if needed.
Run from desktop: OPTIMIZE-PACKS.bat
"""
import os, sys, zipfile, shutil, warnings
from pathlib import Path
from PIL import Image

# Suppress decompression bomb warnings for large art files
Image.MAX_IMAGE_PIXELS = None
warnings.filterwarnings('ignore', category=Image.DecompressionBombWarning)

ONEDRIVE = Path(r"C:\Users\efenn\OneDrive\Pictures")
OUTPUT = Path(r"C:\Users\efenn\.openclaw\workspace\etsy-shop\ready-to-upload")
MAX_ZIP_MB = 19.5
MAX_PX = 2500
LICENSE = "Commercial use for printed physical products. Resale NOT permitted. - Swag Nuggets Designs"

def optimize_png(src, dst, max_px):
    img = Image.open(src)
    w, h = img.size
    if max(w, h) > max_px:
        r = max_px / max(w, h)
        img = img.resize((int(w * r), int(h * r)), Image.LANCZOS)
    img.save(dst, 'PNG', optimize=True)
    return dst.stat().st_size

def process_pack(pack_dir):
    name = pack_dir.name
    opt_dir = ONEDRIVE / f"{name}_optimized"
    opt_dir.mkdir(exist_ok=True)

    pngs = sorted(list(pack_dir.glob("*.png")) + list(pack_dir.glob("*.PNG")))
    if not pngs:
        print(f"  SKIP: no PNGs")
        return

    # Resize all
    for f in pngs:
        print(f"  Resizing: {f.name}...", end=" ", flush=True)
        size = optimize_png(f, opt_dir / f.name, MAX_PX)
        print(f"{size // 1024}KB")

    (opt_dir / "README-LICENSE.txt").write_text(LICENSE)

    # Try single ZIP
    opt_pngs = sorted(opt_dir.glob("*.png"), key=lambda f: f.stat().st_size)
    all_files = list(opt_dir.iterdir())

    # Remove old ZIPs for this pack
    for old in OUTPUT.glob(f"{name}*.zip"):
        old.unlink()

    zp = OUTPUT / f"{name}.zip"
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in all_files:
            zf.write(f, f.name)

    mb = zp.stat().st_size / 1024 / 1024
    if mb <= MAX_ZIP_MB:
        print(f"  -> {name}.zip: {mb:.1f} MB OK")
        return

    # Need to split
    zp.unlink()
    print(f"  {mb:.1f}MB too big, splitting...")
    license_file = opt_dir / "README-LICENSE.txt"

    groups = []
    current = []
    current_size = 0
    for f in opt_pngs:
        fsize = f.stat().st_size
        if current_size + fsize > 17 * 1024 * 1024 and current:
            groups.append(current)
            current = []
            current_size = 0
        current.append(f)
        current_size += fsize
    if current:
        groups.append(current)

    if len(groups) > 5:
        print(f"  WARNING: {len(groups)} parts needed (Etsy max 5). Consider removing some designs.")

    for i, group in enumerate(groups):
        part = chr(65 + i)
        zp = OUTPUT / f"{name}_Part{part}.zip"
        with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.write(license_file, "README-LICENSE.txt")
            for f in group:
                zf.write(f, f.name)
        mb = zp.stat().st_size / 1024 / 1024
        ok = "OK" if mb <= MAX_ZIP_MB else "OVER"
        print(f"  -> {name}_Part{part}.zip: {len(group)} files, {mb:.1f} MB {ok}")

if __name__ == "__main__":
    print("=== Etsy Pack Optimizer ===\n")
    OUTPUT.mkdir(exist_ok=True)

    packs = sorted([
        d for d in ONEDRIVE.iterdir()
        if d.is_dir() and d.name.startswith("Pack") and "optimized" not in d.name
    ])

    print(f"Found {len(packs)} packs\n")
    for p in packs:
        print(f"Processing: {p.name}")
        process_pack(p)
        print()

    print("=== Final ZIPs ===")
    for z in sorted(OUTPUT.glob("Pack*.zip")):
        mb = z.stat().st_size / 1024 / 1024
        ok = "OK" if mb <= 20 else "OVER 20MB!"
        print(f"  {z.name}: {mb:.1f} MB {ok}")
