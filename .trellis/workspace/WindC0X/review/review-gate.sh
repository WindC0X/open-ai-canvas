#!/usr/bin/env bash
# 评审线门禁脚本（R4 起使用）
#
# 纪律来源：docs/artifacts/multi-line-discipline.md（控制线维护）
#   G1 合并 commit 文件面用 git diff <merge>^1 <merge>（非 git show）+ 空输入显性防线
#   G5 门禁结果与 hash 绑定
#   V6 动态验证只在 ext4 上跑
#
# 用法：
#   ./review-gate.sh <base> <tip>              # 两点范围（非合并 commit）
#   ./review-gate.sh --merge <merge-commit>    # 合并 commit（自动用 ^1 口径）
#
# 输出：拓扑链 + 文件清单 + 文件数（空输入显性中止）+ 纪律检查

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:---range}"

if [ "$MODE" = "--merge" ]; then
    MERGE="${2:?用法: $0 --merge <merge-commit>}"
    echo "═══ G1 合并 commit 文件面（口径：git diff ${MERGE}^1 ${MERGE}）═══"
    FILES_ALL=$(git diff --name-only "${MERGE}^1" "${MERGE}")
    BASE_LABEL="${MERGE}^1"
    TIP_LABEL="$MERGE"
    TIP_HASH=$(git rev-parse "$MERGE")
else
    BASE="${1:?用法: $0 <base> <tip>  或  $0 --merge <merge-commit>}"
    TIP="${2:?用法: $0 <base> <tip>}"
    echo "═══ 两点范围文件面（口径：git diff ${BASE}..${TIP}）═══"
    FILES_ALL=$(git diff --name-only "${BASE}" "${TIP}")
    BASE_LABEL="$BASE"
    TIP_LABEL="$TIP"
    TIP_HASH=$(git rev-parse "$TIP")
fi

# ── G5：门禁绑定 hash ──
echo "门禁绑定 tip: $TIP_HASH"
echo "范围: $BASE_LABEL .. $TIP_LABEL"
echo

# ── 文件清单（全量）──
echo "── 全量变更文件（$(echo "$FILES_ALL" | grep -c . ) 个）──"
echo "$FILES_ALL"
echo

# ── 代码面（剔除 docs/.trellis/*.md，测试文件保留——测试质量是评审重点）──
FILES_CODE=$(echo "$FILES_ALL" | grep -vE '^(docs/|\.trellis/)' | grep -E '\.(ts|tsx|go|css|json|yaml|yml|sh|md)$' || true)
CODE_COUNT=$(echo "$FILES_CODE" | grep -c . || echo 0)
echo "── 代码面（剔 docs/.trellis）：$CODE_COUNT 个 ──"
echo "$FILES_CODE"
echo

# ── ★ G1 空输入显性防线（核心）──
if [ -z "$FILES_CODE" ] || [ "$CODE_COUNT" -eq 0 ]; then
    echo "❌ 文件面为空，中止——空输入产生的 exit 0 与真检过的 exit 0 是不同东西（G1）"
    exit 1
fi

# ── 前端文件面（bun test 用）──
WEB_FILES=$(echo "$FILES_ALL" | grep -E '^web/.*\.(ts|tsx)$' | sed 's|^web/||' || true)
WEB_COUNT=$(echo "$WEB_FILES" | grep -c . || echo 0)
echo "── web 侧 ts/tsx：$WEB_COUNT 个 ──"
[ "$WEB_COUNT" -eq 0 ] && echo "⚠️  web 文件面为空（若本批不含前端改动属正常）"
echo "$WEB_FILES"
echo

# ── 测试文件（评审重点，ocr 默认会漏）──
TEST_FILES=$(echo "$FILES_ALL" | grep -E '^(web/test/.*\.(ts|tsx)|backend/.*_test\.go)$' || true)
TEST_COUNT=$(echo "$TEST_FILES" | grep -c . || echo 0)
echo "── 测试文件：$TEST_COUNT 个（测试质量是评审重点）──"
echo "$TEST_FILES"
echo

# ── V6：动态验证环境检查 ──
echo "── V6 环境检查 ──"
if [ -d "/home/windc0x/oac-ext4/oac-wt-baseline" ]; then
    echo "✅ 隔离树存在: /home/windc0x/oac-ext4/oac-wt-baseline @ $(git -C /home/windc0x/oac-ext4/oac-wt-baseline rev-parse --short HEAD 2>/dev/null)"
else
    echo "⚠️  隔离树不存在（R4 前需重建）"
fi
case "$REPO_ROOT" in
    /mnt/*) echo "⚠️  当前在 /mnt（9p）：禁止在此跑 bun test / go test（V6）" ;;
    *) echo "✅ 当前在 ext4" ;;
esac

echo
echo "═══ 门禁自检完成（文件数 $CODE_COUNT / 测试 $TEST_COUNT / tip $TIP_HASH）═══"
