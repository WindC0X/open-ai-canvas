# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)

---

## 令牌纪律（2026-09-18 PATCH-MAP 立规）

**新增 UI 一律走三层令牌（Primitive → Semantic → Component），不再直改 globals.css 组件规则**——fork 对 globals.css 的直改存量已登记至仓库根 `PATCH-MAP.md`（Top20 + 回填清单），上游 ADR-0008 正用 Celadon 分批替换 AntD，直改债每拖一周多滚一周。同批登记：fork 版本后缀自下个发布起用 `v<上游版>-flora.<n>`（如 v1.5.0-flora.1），已发布历史不追改。
