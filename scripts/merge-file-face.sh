#!/usr/bin/env bash
# 合并 commit 门禁文件面提取 + 空输入显性防线
# 纪律依据：docs/artifacts/multi-line-discipline.md G1（合并 commit 文件面用
# `git diff <merge>^1 <merge>`，禁用 `git show --name-only <merge>`）。
#
# 用法：
#   scripts/merge-file-face.sh <merge-commit>                      # 全部改动文件
#   scripts/merge-file-face.sh <merge-commit> --exclude-deleted    # 排除已删除项（lint 用）
#   scripts/merge-file-face.sh <merge-commit> web ts tsx           # 限定 web/ 下指定扩展名
#
# ★ 契约（带 SCOPE 时）：输出的路径**已剥离 SCOPE 前缀**，消费方须先 `cd <SCOPE>`：
#     FILES=$(scripts/merge-file-face.sh <merge> --exclude-deleted web ts tsx) || exit 1
#     cd web && bunx eslint $FILES          # 正确：src/... 在 web/ 下存在
#   ✗ 反例（从仓库根直接消费）：bunx eslint $(scripts/... web ts tsx)
#     → 全部路径找不到；且这不是空输入，空输入防线拦不住（lint 会报 no files matching）。
#   带 SCOPE 时脚本会在 stderr 打印该契约提示。
#
# 输出：文件清单到 stdout；文件数到 stderr（显性可见）；空输入 → exit 1。
#
# ★ 为什么不用 `echo "$FILES" | wc -l`：空输入时 echo 仍产生一个换行，
#   wc -l 返回 1 —— 恰好把这条防线要防的「空输入」显示成「1 个文件」。
#   本脚本用数组 + `${#arr[@]}`，空输入显性为 0。
#
# ★ 默认不做 --diff-filter：与 G1 原文口径一致（`git diff --name-only <m>^1 <m>`）。
#   需对文件跑 lint/格式化时加 --exclude-deleted（已删除的文件无法检查）。
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "用法: $0 <merge-commit> [--exclude-deleted] [限定目录] [扩展名...]" >&2
    exit 2
fi

MERGE="$1"; shift
DIFF_FILTER=""
if [ "${1:-}" = "--exclude-deleted" ]; then
    DIFF_FILTER="--diff-filter=ACMR"
    shift
fi
SCOPE="${1:-}"; [ $# -gt 0 ] && shift
EXTS=("$@")

if ! git rev-parse --verify --quiet "${MERGE}^{commit}" >/dev/null; then
    echo "❌ 无法解析 commit: ${MERGE}" >&2
    exit 1
fi

# G1 口径：对第一双亲取 diff（合并 commit 的完整改动面）。
# 注意 merge 的第二双亲可能是被合入分支的 tip；^1 是合并时的目标分支侧。
mapfile -t FILES < <(git diff --name-only ${DIFF_FILTER:+"$DIFF_FILTER"} "${MERGE}^1" "${MERGE}")

if [ -n "$SCOPE" ]; then
    echo "提示: 输出路径已剥离 '${SCOPE}/' 前缀，请在 ${SCOPE}/ 下消费（cd ${SCOPE} && <tool> \$FILES）" >&2
    filtered=()
    for f in "${FILES[@]}"; do
        [[ "$f" == "${SCOPE}/"* ]] || continue
        if [ ${#EXTS[@]} -gt 0 ]; then
            ok=0
            for ext in "${EXTS[@]}"; do
                [[ "$f" == *".${ext}" ]] && ok=1
            done
            [ $ok -eq 1 ] || continue
        fi
        filtered+=("${f#${SCOPE}/}")
    done
    FILES=("${filtered[@]}")
fi

# ★ 空输入显性防线：空输入产生的 exit 0 与真检过的 exit 0 是不同东西。
echo "文件数: ${#FILES[@]}" >&2
if [ ${#FILES[@]} -eq 0 ]; then
    echo "❌ 文件面为空，中止" >&2
    exit 1
fi

printf '%s\n' "${FILES[@]}"
