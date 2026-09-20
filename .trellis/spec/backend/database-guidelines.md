# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Common Mistakes

<!-- Database-related mistakes your team has made -->

### SQLite 时间窗比较：参数与列的时区表示必须同格式（2026-09-21）

- **现象**：管理端"请求明细/数据概览"整批漏掉本地当天 00:00 后的记录（用户实测 API total=475 vs 表内 484），强刷/换环境都无解。
- **根因**：GORM 列以 mattn 驱动本地时区字符串落盘（`2026-09-21 00:34:37.558+08:00`），而查询参数是 UTC `time.Time`，mattn 绑定输出 `2026-09-21 00:00:00+00:00`。SQLite 无原生 datetime，**按字符串字典序比较**，`+00:00` 与 `+08:00` 后缀错位 → `to` 边界（UTC 零点=本地 08:00）反而"早于"本地 00:11 的记录，新记录全被排除。
- **规则**：对 SQLite 时间列做范围比较时，参数必须先 `.Local()` 转本地时区再绑定（参考 `backend/internal/app/analytics.go` normalizeAnalyticsFilter）；新增任何 `Where("created_at >= ?")` 类查询都要先确认列的实际落盘格式（看一眼 DB 原始字符串），不要假设 time.Time 直绑安全。
- **自查法**：拿 API 返回的 total 与 `SELECT COUNT(*)` 全表（去掉时间窗）对账，差值即被错误排除的记录；一次对账即可定性"少账"是查询层还是写入层。
