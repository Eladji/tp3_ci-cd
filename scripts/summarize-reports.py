#!/usr/bin/env python3
"""Recalculer la synthèse à partir des mesures conservées dans reports/."""

import json
from collections import Counter
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"


def read(name):
    return json.loads((REPORTS / name).read_text())


def image_summary(when):
    image = read(f"image-{when}.json")[0]
    vulnerabilities = [
        item
        for result in read(f"trivy-{when}.json").get("Results", [])
        for item in result.get("Vulnerabilities", [])
    ]
    return {
        "bytes": image["Size"],
        "layers": len(image["RootFS"]["Layers"]),
        "vulnerabilities": dict(Counter(v["Severity"] for v in vulnerabilities)),
        "fixable": dict(Counter(
            v["Severity"] for v in vulnerabilities if v.get("FixedVersion")
        )),
        "distinct_cves": len({v["VulnerabilityID"] for v in vulnerabilities}),
    }


hourly_x86 = Decimal("0.25") * Decimal("0.04048") + Decimal("0.5") * Decimal("0.004445")
hourly_arm = Decimal("0.25") * Decimal("0.03238") + Decimal("0.5") * Decimal("0.003556")
summary = {
    "date": "2026-11-04",
    "audit": {when: read(f"npm-audit-{when}.json")["metadata"]["vulnerabilities"]
              for when in ("before", "after", "production")},
    "images": {when: image_summary(when) for when in ("before", "after")},
    "costs_usd": {
        "A_x86_730h": str(hourly_x86 * 730),
        "B_arm_730h": str(hourly_arm * 730),
        "C_x86_260h": str(hourly_x86 * 260),
        "NAT_730h": str(Decimal("0.045") * 730),
    },
}
output = json.dumps(summary, indent=2) + "\n"
(REPORTS / "summary.json").write_text(output)
print(output, end="")
