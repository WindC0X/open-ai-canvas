#!/usr/bin/env bash
#
# 下载并校验 F-01 抠图所需的本地模型权重。
#
# 权重不进 git（单文件约 94MB），构建镜像、裸机自部署和本地开发都跑这个脚本。
# 运行期浏览器只从本站 /models/ 取权重，不直连 HuggingFace —— 这是「模型分发
# 国内可达」硬约束的落点（控制线 Q-3 裁定）。
#
# 注：onnxruntime-web 的 WASM 运行时不需要本脚本 —— 它由 Vite 在构建期打包成
# /assets/ 哈希资源，worker 用 `?url` 导入后显式写进 wasmPaths（见
# web/src/workers/background-removal.worker.ts 的说明）。
#
# 用法：
#   bash scripts/fetch-cutout-models.sh              # 默认官方源
#   CANVAS_MODEL_BASE_URL=<镜像> bash scripts/...    # 国内镜像/代理
#   FORCE=1 bash scripts/...                        # 已存在时强制重新下载
#
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="${REPO_ROOT}/web/public/models/birefnet-lite-512"
MANIFEST="${MODEL_DIR}/models-manifest.json"

# 源可配：默认 HuggingFace 官方仓库；国内部署可指向自建镜像或代理。
CANVAS_MODEL_BASE_URL="${CANVAS_MODEL_BASE_URL:-https://huggingface.co/studioludens/birefnet-lite-512/resolve/main}"
FORCE="${FORCE:-0}"

step() {
    printf '\n==> %s\n' "$1"
}

fail() {
    printf '\n模型下载失败：%s\n' "$1" >&2
    exit 1
}

# 与 models-manifest.json 的 files 数组保持一致；只取 fp16 单档
# （控制线 Q-2：一份权重同时服务 WebGPU 档与 WASM 回落档）。
FILES=(
    "config.json"
    "preprocessor_config.json"
    "onnx/model_fp16.onnx"
)


command -v curl >/dev/null 2>&1 || fail "需要 curl，请先安装"

download_one() {
    local relative="$1"
    local target="${MODEL_DIR}/${relative}"
    local url="${CANVAS_MODEL_BASE_URL}/${relative}"

    if [[ -s "${target}" && "${FORCE}" != "1" ]]; then
        printf '    已存在，跳过：%s\n' "${relative}"
        return 0
    fi

    mkdir -p "$(dirname "${target}")"
    printf '    下载：%s\n' "${relative}"
    # -f 让 HTTP 错误码变成失败；-L 跟随 HuggingFace 的 resolve 重定向。
    curl -fL --retry 3 --retry-delay 2 -o "${target}.part" "${url}" \
        || fail "${relative} 下载失败（源：${url}）。可设置 CANVAS_MODEL_BASE_URL 指向可用镜像后重试。"
    mv "${target}.part" "${target}"
}

verify_manifest() {
    [[ -f "${MANIFEST}" ]] || fail "缺少清单文件 ${MANIFEST}"

    command -v sha256sum >/dev/null 2>&1 || fail "需要 sha256sum，请先安装 coreutils"

    # 用 sha256sum 逐文件校验，不依赖 python3（构建镜像里不一定有）。
    # 清单是单层 models[] + files[] 结构，用 grep 抽 path/sha256 对即可。
    local failures=0
    while IFS='|' read -r expected path; do
        [[ -n "${path}" ]] || continue
        local target="${MODEL_DIR}/${path}"
        if [[ ! -f "${target}" ]]; then
            printf '    ✗ 缺失文件 %s\n' "${path}" >&2
            failures=$((failures + 1))
            continue
        fi
        local actual
        actual="$(sha256sum "${target}" | awk '{print $1}')"
        if [[ "${actual}" != "${expected}" ]]; then
            printf '    ✗ %s sha256 不匹配：期望 %s，实际 %s\n' "${path}" "${expected}" "${actual}" >&2
            failures=$((failures + 1))
        else
            printf '    ✓ %s  %s\n' "${path}" "${actual}"
        fi
    done < <(parse_manifest)

    ((failures == 0)) || fail "sha256 校验未通过"
}

# 从清单 JSON 抽出 "sha256|path" 行。用 sed 而不是 awk 的 3 参 match()，
# 后者是 gawk 扩展，Debian slim 镜像里的 mawk 不支持。
# 依赖清单里 sha256 紧跟在同一条目的 path 之后（见 models-manifest.json 格式）。
parse_manifest() {
    tr -d '\n' < "${MANIFEST}" \
        | grep -o '"path"[^}]*"sha256"[^}]*' \
        | sed -E 's/.*"path"[[:space:]]*:[[:space:]]*"([^"]+)".*"sha256"[[:space:]]*:[[:space:]]*"([^"]+)".*/\2|\1/'
}

step "下载 BiRefNet-lite-512 权重（源：${CANVAS_MODEL_BASE_URL}）"
mkdir -p "${MODEL_DIR}"
for file in "${FILES[@]}"; do
    download_one "${file}"
done

step "校验 sha256"
verify_manifest

step "完成"
printf '    权重目录：%s\n' "${MODEL_DIR}"
printf '    运行期路径：/models/birefnet-lite-512/\n'
