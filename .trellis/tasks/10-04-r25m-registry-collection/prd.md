# R25m 收编枝：最小切片片 1-2 全链打通（门 6 项 + seed→schema→API→前端消费+降级标注）

## Goal

验收门=架构方案 §6.3 检查表 6 项（① schema 定稿含 entryPoints/registryVersion 回改实码 ② AssetKind 按落枚举纪律 ③ 防撞守卫 L1 ④ Go seed schema 对齐含 version 字段 ⑤ 快照脚本+sha256 ⑥ docs 同步点）。范围=最小切片片 1-2：tools.json style 45 + legacyCanvasStylePresets 18。打通 seed→统一 schema→API 下发→前端消费+离线降级标注全链。交付：最小切片全链演示（改一条 seed 重启→前端可见+降级态标注正确）+ 逐片验证记录。只交分支不合入，门后合。

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
