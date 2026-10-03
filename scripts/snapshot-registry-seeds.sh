#!/usr/bin/env bash
#
# 注册表收编快照 —— 架构方案 §5.2 防线 1 的实码化。
#
# 收编（R25m）改动 seed 真值源前，先把当前真值源导出为带 sha256 的快照。
# 回滚 = 用快照覆盖 seed + 重启后端。快照目录进 .local/（gitignore），不进 git。
#
# 覆盖对象（架构方案 §3.1 的两条 seed 通路）：
#   backend/internal/tools/seed/tools.json        87 项（style 45 / motion 33 / nine_grid 9）
#   backend/internal/skills/seed/presets.json      8 项
#
# 用法：
#   bash scripts/snapshot-registry-seeds.sh                    # 快照到 .local/registry-snapshots/<UTC 时间戳>/
#   bash scripts/snapshot-registry-seeds.sh --label pre-r25m   # 带标签（便于人读）
#   bash scripts/snapshot-registry-seeds.sh --list             # 列出既有快照
#   bash scripts/snapshot-registry-seeds.sh --verify <dir>     # 校验某快照与当前 seed 是否一致
#
# 退出码：0 成功；1 快照对象缺失；2 校验失败。

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEED_DIR="$REPO_ROOT/backend/internal/tools/seed"
SKILLS_SEED_DIR="$REPO_ROOT/backend/internal/skills/seed"
SNAPSHOT_ROOT="$REPO_ROOT/.local/registry-snapshots"

# 快照对象：源路径与快照内文件名
SEED_FILES=(
    "$SEED_DIR/tools.json"
    "$SKILLS_SEED_DIR/presets.json"
)

usage() {
    sed -n '2,24p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

# 生成 sha256（macOS 用 shasum，Linux 用 sha256sum）
hash_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    else
        shasum -a 256 "$1" | awk '{print $1}'
    fi
}

cmd_list() {
    if [ ! -d "$SNAPSHOT_ROOT" ]; then
        echo "尚无快照：$SNAPSHOT_ROOT 不存在"
        return 0
    fi
    echo "既有快照（$SNAPSHOT_ROOT）："
    # 只列含 manifest 的目录
    find "$SNAPSHOT_ROOT" -mindepth 1 -maxdepth 1 -type d | sort | while read -r dir; do
        if [ -f "$dir/manifest.txt" ]; then
            printf '  %s\n' "$(basename "$dir")"
        fi
    done
}

cmd_verify() {
    local dir="$1"
    if [ ! -f "$dir/manifest.txt" ]; then
        echo "校验失败：$dir 下无 manifest.txt" >&2
        return 2
    fi
    local failed=0
    while read -r expected name; do
        local current src
        # 快照内文件名 → 当前 seed 源路径（二者 basename 相同）
        src=""
        for candidate in "${SEED_FILES[@]}"; do
            if [ "$(basename "$candidate")" = "$name" ]; then
                src="$candidate"
                break
            fi
        done
        if [ -z "$src" ]; then
            echo "  ? $name 不在已知快照对象清单中，跳过"
            continue
        fi
        if [ ! -f "$src" ]; then
            echo "  ✗ $name 当前 seed 缺失（$src）"
            failed=1
            continue
        fi
        # 校验的是【当前 seed】对【快照记录的 hash】—— 不是快照副本自身
        current="$(hash_file "$src")"
        if [ "$current" = "$expected" ]; then
            echo "  ✓ $name 与快照一致（$expected）"
        else
            echo "  ✗ $name 与快照不一致"
            echo "      快照: $expected"
            echo "      当前: $current"
            failed=1
        fi
    done < <(grep '^[0-9a-f]\{64\} ' "$dir/manifest.txt")
    if [ "$failed" -ne 0 ]; then
        echo "校验失败：快照与当前 seed 不一致（若收编已进行，这是预期结果）" >&2
        return 2
    fi
    echo "校验通过：当前 seed 与快照逐字节一致"
}

cmd_snapshot() {
    local label="${1:-}"
    # 校验所有快照对象存在
    local missing=0
    for src in "${SEED_FILES[@]}"; do
        if [ ! -f "$src" ]; then
            echo "快照对象缺失：$src" >&2
            missing=1
        fi
    done
    if [ "$missing" -ne 0 ]; then
        return 1
    fi

    local stamp
    stamp="$(date -u +%Y%m%dT%H%M%SZ)"
    local dir_name="$stamp"
    if [ -n "$label" ]; then
        dir_name="$stamp-$label"
    fi
    local dir="$SNAPSHOT_ROOT/$dir_name"
    mkdir -p "$dir"

    local manifest="$dir/manifest.txt"
    : > "$manifest"

    echo "写入快照：$dir"
    for src in "${SEED_FILES[@]}"; do
        local base hash
        base="$(basename "$src")"
        cp "$src" "$dir/$base"
        hash="$(hash_file "$dir/$base")"
        printf '%s %s\n' "$hash" "$base" >> "$manifest"
        printf '  %s\n    sha256 %s\n' "$base" "$hash"
    done

    # 记录来源路径与 git 状态，便于回溯「快照对应哪个 commit」
    {
        echo ""
        echo "# 来源"
        for src in "${SEED_FILES[@]}"; do
            echo "#   ${src#"$REPO_ROOT"/}"
        done
        echo "# 生成时间 (UTC): $stamp"
        if git -C "$REPO_ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
            echo "# git HEAD: $(git -C "$REPO_ROOT" rev-parse --short HEAD)"
            echo "# git 分支: $(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
            if ! git -C "$REPO_ROOT" diff --quiet -- "${SEED_FILES[@]}" 2>/dev/null; then
                echo "# ⚠ seed 文件有未提交改动（快照捕获的是工作区状态，非 HEAD）"
            fi
        fi
    } >> "$manifest"

    echo ""
    echo "完成。回滚方式："
    for src in "${SEED_FILES[@]}"; do
        echo "  cp '$dir/$(basename "$src")' '$src'"
    done
    echo "  然后重启后端（seed 在启动时幂等写入数据库）。"
}

main() {
    case "${1:-}" in
        --list|-l)
            cmd_list
            ;;
        --verify|-v)
            if [ -z "${2:-}" ]; then
                echo "--verify 需要快照目录参数" >&2
                exit 2
            fi
            cmd_verify "$2"
            ;;
        --help|-h)
            usage
            ;;
        --label)
            if [ -z "${2:-}" ]; then
                echo "--label 需要标签参数" >&2
                exit 1
            fi
            cmd_snapshot "$2"
            ;;
        "")
            cmd_snapshot
            ;;
        *)
            echo "未知参数：$1" >&2
            usage
            exit 1
            ;;
    esac
}

main "$@"
