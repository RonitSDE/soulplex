"""Create a versioned handoff ZIP and verify its source manifest."""

import hashlib
import sys
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
}
EXCLUDED_NAMES = {".env", "SOURCE_MANIFEST.sha256", ".DS_Store"}


def included(path):
    rel = path.relative_to(ROOT)
    return (
        path.is_file()
        and not any(part in EXCLUDED_DIRS for part in rel.parts)
        and path.name not in EXCLUDED_NAMES
        and not path.name.endswith(
            (".db", ".db-shm", ".db-wal", ".tsbuildinfo", ".pyc")
        )
    )


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python scripts/package.py /path/to/Soulplex_vX_Y.zip")
    output = Path(sys.argv[1]).resolve()
    if output.is_relative_to(ROOT):
        raise SystemExit("Write the ZIP outside the project folder.")
    files = sorted(
        (p for p in ROOT.rglob("*") if included(p)),
        key=lambda p: p.relative_to(ROOT).as_posix(),
    )
    manifest = "".join(
        f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(ROOT).as_posix()}\n"
        for p in files
    )
    (ROOT / "SOURCE_MANIFEST.sha256").write_text(manifest)
    with zipfile.ZipFile(
        output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9
    ) as archive:
        for p in files + [ROOT / "SOURCE_MANIFEST.sha256"]:
            archive.write(p, f"{ROOT.name}/{p.relative_to(ROOT).as_posix()}")
    with zipfile.ZipFile(output) as archive:
        for line in manifest.splitlines():
            expected, rel = line.split("  ", 1)
            actual = hashlib.sha256(archive.read(f"{ROOT.name}/{rel}")).hexdigest()
            if expected != actual:
                raise RuntimeError(f"Manifest mismatch: {rel}")
    print(f"PASS: {output.name}, {len(files)} checksums verified")


if __name__ == "__main__":
    main()
