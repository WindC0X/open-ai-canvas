#!/usr/bin/env python3
"""O-03 CapabilityConfig 覆盖度采集（只读，口径与 research/capability-coverage-2026-09-27.md 一致）。

用法:
    python3 collect-capability-coverage.py <open_ai_canvas.db 路径>

输出: 每个图像模型一行 —— 渠道/模型/价格/档位/比例数/三预设下限（Amazon 1:1 ≥1600、详情 3:4 ≥1440x1920、抖音 9:16 ≥1080x1920）达标 + 质量承载形态。
"""
import json
import sqlite3
import sys


def fmt(preset):
    if not preset:
        return "无"
    return "{}x{}@{}".format(preset.get("width"), preset.get("height"), preset.get("tier"))


def best(presets, ratio):
    cands = [p for p in presets if p.get("ratio") == ratio]
    return max(cands, key=lambda p: p.get("width", 0) * p.get("height", 0)) if cands else None


def ok(preset, width_floor, height_floor):
    return "✓" if preset and preset.get("width", 0) >= width_floor and preset.get("height", 0) >= height_floor else "✗"


def main(db_path: str) -> None:
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cur = con.cursor()
    rows = cur.execute(
        "select channel_id, model_key, unit_price_microcredits, capability_config_json "
        "from channel_models where capability like '%image%' and deleted_at is null "
        "order by channel_id, model_key"
    ).fetchall()
    for channel_id, model_key, price, cfg in rows:
        config = json.loads(cfg) if cfg else {}
        image = config.get("image", {})
        presets = ((image.get("size") or {}).get("presets")) or []
        ratios = sorted({p.get("ratio", "?") for p in presets})
        tiers = sorted({p.get("tier", "?") for p in presets})
        quality = (image.get("quality") or {}).get("values")
        one_one = best(presets, "1:1")
        three_four = best(presets, "3:4")
        nine_sixteen = best(presets, "9:16")
        print("{} | {} | {} | tiers={} | ratios={}: {}".format(channel_id, model_key, price, tiers, len(ratios), "/".join(ratios)))
        print("   1:1={} [amazon≥1600 {}]; 3:4={} [detail≥1440x1920 {}]; 9:16={} [douyin≥1080x1920 {}]; quality={}".format(
            fmt(one_one), ok(one_one, 1600, 1600), fmt(three_four), ok(three_four, 1440, 1920), fmt(nine_sixteen), ok(nine_sixteen, 1080, 1920), quality))
    con.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
