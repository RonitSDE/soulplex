"""Regenerate the frontend copies of backend/app/date_types.py."""
import json, sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "backend"))
from app.date_types import DATE_TYPES, B_LINES, public_catalog  # noqa: E402

fe = root / "frontend" / "src"
(fe / "dateTypes.ts").write_text(
    "/* Generated from backend/app/date_types.py by scripts/gen_date_types.py: do not edit by hand. */\n"
    "export type DateStage = { title: string; icon: string; mood: string };\n"
    'export type DateType = { name: string; icon: string; venue: string; mode: "sit" | "stand" | "walk"; tag: string; blurb: string; human: string; island: string; color: string; spots: string[]; stages: DateStage[] };\n'
    "export const DATE_TYPES: Record<string, DateType> = "
    + json.dumps(public_catalog(), indent=1, ensure_ascii=False)
    + " as any;\n"
)
(fe / "mock" / "dateTypesFull.ts").write_text(
    "/* Generated from backend/app/date_types.py (includes demo templates and pick themes). */\n"
    "export const FULL_TYPES: Record<string, any> = "
    + json.dumps(DATE_TYPES, indent=1, ensure_ascii=False)
    + ";\nexport const B_LINES: string[] = "
    + json.dumps(B_LINES, ensure_ascii=False)
    + ";\n"
)
print("ok")
