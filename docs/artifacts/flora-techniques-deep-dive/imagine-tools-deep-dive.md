# Flora Imagine 三工具深拆（Director / Pose / Realtime）

- 日期：2026-09-30　方法：tmwd-browser 控用户 Chrome（登录态）→ 页面路由直达 + 静态 chunk 下载到本地反解
- **结论等级：机制级确认**（非截图观察）——三条实时链路的端点、协议、参数、计费全部从 bundle 逐字读出
- 补充：本文取代 `README.md` 第四部分中对这三个工具的「仅截图」标注

## 0. 总览：三条实时链路

| 工具 | 路由 | 底层端点 | 传输 | 计费粒度 | feature flag |
|---|---|---|---|---|---|
| **Pose** | `/imagine/pose` | `fal-ai/flux-2/klein` | fal realtime WS | **按帧** | `enable-imagine` |
| **Realtime** | `/imagine/realtime` | `decart/lucy-2-5/realtime` | **原生 WebRTC**（自建信令） | **按活跃秒** | `enable-imagine` |
| **Director** | `/imagine/director` | `minimax/h3-max/director` | fal realtime（`open`，带 media） | **按活跃秒** | `enable-imagine` |

**统一基础设施**：
```
useImagineToolOpened(tool)      埋点 imagine_tool_opened
useImagineUsageMeter({tool, active, accruing, frameCount, sessionId, workspaceId, resolution})
useImagineSnapshot(tool, getFrame)   存帧为资产（pose:"Pose render" / camera:"Realtime capture" / movie:"Director frame"）
useImagineRecording(tool, getRecorder) 录流（pose:"Pose clip" / camera:"Realtime clip" / movie:"Director clip"）
```
- 工具注册表 `TOOL_REGISTRY`（chunk `1qoler3c4z5br.js`）中三者 `availability:"imagine"`，由 `useFeatureFlagEnabled("enable-imagine")` 统一开关；未开启时 `router.replace(appRoutes.projects)`
- 路由族：`/imagine`、`/imagine/camera`、`/imagine/director`、`/imagine/lab`、`/imagine/live`、`/imagine/movie`、`/imagine/pose`、`/imagine/realtime`

---

# 一、Pose（`fal-ai/flux-2/klein`）

## 1.1 连接与帧协议（逐字）

```js
// chunk 35mzqs-lfuw81.js
const { createFalClient } = await import(/* fal client */);
const fal = createFalClient({
  proxyUrl: "/api/fal/proxy",           // ★ 走自家代理，不暴露 fal key
  fetch: async (url, init) => {         // 错误语义映射
    const res = await fetch(url, init);
    if (!res.ok) {
      const msg = res.status === 403 ? "Live rendering isn't enabled for this account or environment yet."
                : res.status === 429 ? "Reconnecting to the live renderer…"
                : `Live renderer unavailable (${res.status}).`;
      setState(s => ({...s, status: "error", message: msg}));
    }
    return res;
  }
}).realtime.connect("fal-ai/flux-2/klein", {
  connectionKey: `pose-tool-realtime-${billingSessionId}`,
  throttleInterval: 0,        // 不节流
  maxBuffering: 1,            // ★ 只保留最新帧（丢旧帧，实时优先）
  onResult: e => {            // 收帧：e.images[0] = {content:ArrayBuffer, content_type}
    const img = e.images?.[0];
    if (!img?.content) return;
    pending.shift();                                     // 出队
    if (reconnectTimer.current) { clearTimeout(...); reconnectTimer.current = null; }
    cancelTimer();
    const blob = new Blob([img.content], {type: img.content_type ?? "image/jpeg"});
    const url = URL.createObjectURL(blob);
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);   // ★ 及时释放，防内存泄漏
    prevUrl.current = url;
    setState(s => ({status:"live", frameUrl:url, message:null, frameCount: s.frameCount + 1}));
    if (queued.current) flushQueued();
  },
  onError: e => { /* status:"error", message: "Live renderer error: ..." */ }
});
```

## 1.2 发送载荷（逐字）

```js
fal.send({
  image_url:  conditioningDataUrl,     // canvas 合成的 OpenPose 骨架图（data URL）
  prompt:     typeof p === "function" ? p() : p,   // ★ 支持惰性求值
  num_inference_steps: steps,          // 硬编码 2
  image_size: imageSize ?? "square",   // "square" | "portrait_4_3" | "landscape_4_3"
  seed,
  output_feedback_strength: feedback,  // 硬编码 1
  schedule_mu: scheduleMu              // 2.5 - 2.2 × freedom
});
```
- **`num_inference_steps: 2`** —— 实时流的秘密：2 步推理换取交互帧率
- **`output_feedback_strength: 1`** —— 帧间自反馈（用上一帧影响下一帧），产生连续动画感而非每帧独立生成
- **`schedule_mu` 驱动 Freedom 滑杆**：`μ = 2.5 − 2.2 × freedom`（freedom 0→μ2.5 最贴合 conditioning；freedom 1→μ0.3 最放飞）。tooltip 原文：`Low stays literal to the conditioning image; high re-imagines aggressively (drives schedule_mu)`

## 1.3 帧节奏控制（反压 + 重连）

```js
const MIN_FRAME_GAP = 2500;   // 2.5s
const RECONNECT_MS  = 15000;  // 15s
// 发送节流：保证 (上次发送 + 150ms) 与 (队列首帧 + 2500ms) 都满足
const gap = Math.max(lastSent + 150 - now, queue.length < 1 ? 0 : queue[0] + 2500 - now);
if (gap > 0) { scheduleTimer = setTimeout(flushQueued, gap); return; }
// 超时重连：15s 无响应 → 清队列 + status:"connecting" + "Reconnecting to the live renderer…"
```

## 1.4 Conditioning 图生成（`captureConditioning`）

```js
function buildConditioningOptions(state, size, quality) {
  return { mode:"hybrid", size, quality, boneWidth:8, jointRadius:6,
           drawFace:true, monochrome:true, clayGhost:0.25, blurPx:0 };
}
// 预览用：size 320, quality 0.85（防抖 180ms）
// 发送用：size 704, quality 0.5
```
**"OpenPose skeleton over a faint clay ghost"** 的构成：OpenPose 骨架（boneWidth 8 / jointRadius 6 / 画脸 / 单色）+ `clayGhost 0.25` 的淡粘土体积提示。

## 1.5 姿势 → 文字（`Auto pose words` 的真实实现）

三个纯函数，从关键点算出自然语言，注入 prompt。**这就是「自动姿势词」的全部机制**：

```js
// ed(pose, worldKeypoints) → 姿态描述
function describePose(pose, kp) {
  const bodyHeight = pose.root.height / 0.95;
  const lHipFwd = projY(kp.l_hip) * Math.sign(...), rHipFwd = ...;
  const lKneeUp = elbowAngle(kp.l_knee) >= 45, rKneeUp = ...;   // 实际是 knee 角
  const posture =
      bodyHeight > 1.2                                   ? "in mid-air, jumping"
    : lHipFwd>50 && rHipFwd>50 && lKneeUp && rKneeUp && bodyHeight<0.8
        ? (bodyHeight < 0.45 ? "crouching low with knees deeply bent"
                             : "sitting down with knees bent and feet on the ground")
    : Math.abs(lHipFwd - rHipFwd) > 40                   ? "mid-stride with one leg forward"
                                                         : "standing upright";
  // 躯干倾角（spine 向量与竖直夹角，<20° 忽略）
  const lean = spineTilt(kp) < 20 ? null : (z > 0 ? "leaning forward" : "leaning back");
  const [armA, armB] = describeArms(...);   // 逐臂：raised overhead / bent at the elbow /
                                            // reaching forward / extended out to the side / hanging down
  return [posture, lean, `with ${arms}`].filter(Boolean).join(", ");
}

// es(projectedKeypoints(704), 704) → 构图描述（阈值 0.36 / 0.45 / 0.64 / 0.7 / 0.85）
"seen from a distance, small in the frame"   // 高度占比 < 0.45
"in close-up, filling the frame"             // 高度占比 > 0.85
"positioned toward the left/right of the frame"  // 水平中心 < 0.36 / > 0.64
"low/high in the frame"                      // 垂直中心 > 0.7 / < 0.36

// ec(facing) → 朝向描述
back          → "seen from behind, facing away from the camera, the back of the head toward the camera"
profile       → "seen in profile from the side"
three-quarter → "at a three-quarter angle, turned partly away from the camera"
front         → null

// 朝向角度表
const FACING_ANGLE = { front: 0, "three-quarter": 2*Math.PI/3, profile: Math.PI/2, back: Math.PI };
```

**最终 prompt 模板（`tv`，逐字）**：
```js
function buildPrompt(state, poseWords, framingWords, facingWords) {
  const p = state.prompt.trim().replace(/\.+$/, "");   // 去尾部句点
  if (!p) return "";
  if (!state.templateOn) return state.prompt.trim();
  const pose   = poseWords    ? ` The person is ${poseWords}.`    : "";
  const facing = facingWords  ? ` The figure is ${facingWords}.`  : "";
  const frame  = framingWords ? ` The figure is ${framingWords}.` : "";
  return `Turn this pose skeleton into ${p}.${pose}${facing}${frame}`
       + ` The stick figure defines the exact body pose — match it precisely.`
       + ` Fully textured, detailed scene.`;
}
```
- 两个开关 **独立控制两件事**：`Pose-aware template` 控制整段模板（`templateOn`）；`Auto pose words` 控制姿势/构图/朝向词是否计算（`poseWordsOn`）。二者同时为真才注入词句。
- 三者都从 3D 编辑器实例取：`getPose()` / `getWorldKeypoints()` / `getProjectedKeypoints(704)` / `getFacing()`

## 1.6 Pose 的 3D 编辑器

- 底层 **three.js**（`z.Scene` / `PerspectiveCamera(32,1,.1,100)` / `Vector3` / `Quaternion` / `Ray` / `Plane`）+ 自研轨道控制器（`class extends t.Controls`，含 minDistance/maxDistance/minPolarAngle/damping/zoomToCursor 等完整参数）
- 骨架关节索引常量：`ef=7, ex=8, eb=11, ey=12, ew=15, ev=16, ej=23, e_=24, ek=27, eS=28`
- 投影：`getProjectedKeypoints(704)` → 归一化坐标 → 构图描述；`ez(e) = new Vector3(+e.x, -e.y, -e.z)`（Y 翻转）
- 可见性过滤：`visibility >= 0.5` 才计入

---

# 二、Director（`minimax/h3-max/director`）

## 2.1 连接（逐字）

```js
// chunk 3y610i8z2910c.js
const fal = createFalClient({
  proxyUrl: `/api/fal/proxy?${new URLSearchParams({billing: billingSessionId, resolution}).toString()}`,
  fetch: falFetch
});
fal.realtime.open("minimax/h3-max/director", {   // ★ 注意是 open，不是 connect
  receive: ["video", "audio"],                    // ★ 收 MediaStream（音视频轨道）
  abortSignal: controller.signal,
  onMedia: mediaStream => setState(s => ({...s, status:"live", remoteStream: mediaStream, message:null})),
  onData: raw => { const msg = JSON.parse(raw); /* 见 2.3 状态机 */ },
  onState: s => { "failed" → "The stream dropped — start the scene again to reconnect."
                  "closed" → status:"ended" },
  onError: e => setState(s => ({...s, status:"error", message: e.message ?? "Director is unavailable right now."}))
});
```
- **`proxyUrl` 带 `billing` 与 `resolution` 查询参数** → 计费与分辨率在代理层注入
- **`onMedia` 而非 `onResult`**：Director 返回的是**媒体流**（`<video srcObject={remoteStream}>`），不是逐帧图像
- 视频元素 `autoPlay playsInline`，`remoteStream` 为空时 `hidden`

## 2.2 消息协议（逐字）

```js
// 开场配置（连接后发一次）
fal.send({
  type: "configure",
  prompt: scenePrompt.trim(),
  prompt_version: 1,
  protocol_version: 1,          // ★ 协议版本号
  resolution,                   // "480p" | "768p" | "1080p"
  aspect_ratio,                 // "16:9" | "9:16" | "1:1"
  memory: 12,                   // ★ 上下文记忆长度
  ...(firstFrameUrl ? { image_url:     firstFrameUrl } : {}),
  ...(endFrameUrl   ? { end_image_url: endFrameUrl   } : {}),
  ...(audio         ? { audio_url:     audio.url     } : {})
});

// 后续每一次「导演指令」（版本号自增）
fal.send({
  type: "prompt",
  prompt_version: ++version,
  ...(text          ? { prompt: text } : {}),
  ...(keyframeUrl   ? { end_image_url: keyframeUrl } : {}),   // ★ 可带关键帧
  ...(audio         ? { audio_url: audio.url, audio_behavior: audio.behavior } : {})
});
```
- 音频 `behavior`：`"replace"`（从文件名+URL 构造时固定）
- 分辨率分段：`480p / 768p / 1080p 2×`；比例：`16:9 / 9:16 / 1:1`
- 首尾帧锚定：`First frame`（`image_url`）/ `End frame`（`end_image_url`）

## 2.3 服务端回执状态机（`onData` 逐字）

| 服务端消息 | 客户端动作 |
|---|---|
| `configured` | version 1 → `applied` |
| `prompt_applied` | 对应 version → `applied` |
| `prompt_pending` | → `pending` |
| `prompt_rejected` | → `rejected`（带 `reason`） |
| `audio_pending` / `audio_applied` / `audio_rejected` | 音频轨道状态（`audioReason`） |
| `audio_exhausted` | → `exhausted` |
| `stream_exhausted` | → `status:"ended"`, message `"The stream reached its session limit."` |
| `error` | `code === "content_policy"` → `"That direction was blocked by the content policy."` 否则 `message` |

→ **每条导演指令是一条独立版本记录**，前端维护 `directions[]` 数组，每条含 `{version, text, status, reason, keyframeUrl, audio, audioStatus, audioReason}`。这是「指令时间线」的产品形态。

## 2.4 状态与 UI

- 状态机：`idle → connecting → live → ended | error`；显示映射 `live→"Live"` / `connecting→"Connecting"` / `ended→"Ended"` / `error→"Paused"`
- 停止按钮 tooltip：**"End the live session — streaming bills per active second"**
- 空态：Clapperboard 图标 + `Set the scene` + prompt 输入（带 suggestions）+ 三个上传槽（first frame / end frame / audio）
- 运行态：左 `<video data-test="imagine-movie-output">` + 底部 `Direct` 按钮（`data-test="imagine-movie-send"`）

---

# 三、Realtime（`decart/lucy-2-5/realtime`，原生 WebRTC）

## 3.1 与另外两个的**根本不同**：自建 WebRTC 信令

```js
// chunk 02hbz0c-fn_hc.js
const token = await fetchFalToken(abortSignal);            // 自取 fal JWT
const ws = new WebSocket(`wss://fal.run/decart/lucy-2-5/realtime?fal_jwt_token=${encodeURIComponent(token)}`);
ws.binaryType = "arraybuffer";
const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
const dc = pc.createDataChannel("prompt");                 // ★ prompt 走 DataChannel
for (const t of localStream.getTracks()) pc.addTrack(t, localStream);   // ★ 摄像头轨道直推
pc.ontrack = e => { const s = e.streams[0]; if (s) setState({status:"live", remoteStream:s}); };
pc.onicecandidate = e => { if (e.candidate) ws.send(encode({type:"candidate", candidate:{...}})); };
pc.onconnectionstatechange = () => {
  if (pc.connectionState === "failed" || pc.connectionState === "closed")
    fail("Live video dropped — switch models and back to reconnect.");
  if (pc.connectionState === "disconnected") setState(reconnecting);
  if (pc.connectionState === "connected") setState(live);
};

// 握手：WS onmessage 收到 iceServers → setConfiguration → 2s 后发 offer
ws.onmessage = ev => {
  const msg = decode(new Uint8Array(ev.data));
  if (msg.error) return fail(`Live video error: ${msg.error}`);
  switch (msg.type) {
    case "iceServers":
      if (msg.iceServers?.length) pc.setConfiguration({iceServers:[...msg.iceServers, {urls:"stun:..."}]});
      startOffer();
      break;
    case "answer":    msg.sdp && pc.setRemoteDescription({type:"answer", sdp: msg.sdp}); break;
    case "candidate": msg.candidate && pc.addIceCandidate(msg.candidate).catch(noop); break;
  }
};
ws.onopen = () => { offerTimer = setTimeout(startOffer, 2000); };   // 2s 兜底

// offer（prompt 随 offer 一起发）
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
ws.send(encode({ type:"offer", sdp: offer.sdp,
                 prompt: promptRef.current, enable_prompt_expansion: false }));
```

## 3.2 prompt 更新：**双通道冗余**

```js
const sendPrompt = text => {
  const msg = { type: "prompt", prompt: text, enable_prompt_expansion: false };
  const dc = dataChannelRef.current;
  if (dc?.readyState === "open") dc.send(JSON.stringify(msg));      // 通道 1：DataChannel（JSON）
  const ws = wsRef.current;
  if (ws?.readyState === WebSocket.OPEN) ws.send(encode(msg));      // 通道 2：WS（二进制）
};
// 输入防抖 300ms
```
→ 两条路同时发，保证 prompt 一定送达（DataChannel 未就绪时 WS 兜底）。

## 3.3 摄像头与镜像

```js
navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720} }, audio: false })
  .catch(err => setError(err.name === "NotAllowedError"
      ? "Camera access was denied — allow it in the browser and reload."
      : "No camera available."));
// 镜像：勾选 Mirror view 时，截图前 canvas 做水平翻转
ctx.translate(canvas.width, 0); ctx.scale(-1, 1); ctx.drawImage(video, 0, 0);
```
- **`audio: false`** —— 只取视频，不占麦克风
- `Mirror view` 影响**截图**（`captureSnapshot`）与显示，不影响上行轨道
- 停止按钮 tooltip：`"End the live session — streaming bills per active second"`

---

# 四、计费机制（三工具共用，机制级确认）

## 4.1 `useImagineUsageMeter` 逐字逻辑

```js
const recordUsage = useMutation(api.imagineUsage.mutations.recordImagineUsage);
// 计时：active 为真时累计 activeSeconds（暂停则累加到 j.current）
// 心跳：setInterval(flush, IMAGINE_HEARTBEAT_INTERVAL_MS) + window "pagehide" 监听
const flush = (initial) => {
  const activeSeconds = j.current / 1000;   // 本周期活跃秒
  const frames = Math.max(0, frameCountRef.current - lastFrameCount);
  if (!initial && (tool === "pose" ? frames === 0 : activeSeconds <= 0)) return;  // ★ 无变化不上报
  return recordUsage({ sessionId, tool, activeSeconds, frames, ...(resolution ? {resolution} : {}) })
    .then(r => { /* 保留 usageCredits 更大的那次（单调） */ })
};
```

## 4.2 服务端返回契约

```ts
recordImagineUsage({ sessionId, tool, activeSeconds, frames, resolution })
  → { usageCredits, activeSeconds, frames, billedUsageCredits, outOfCredits }
```

## 4.3 计费粒度（**关键差异**）

```js
const billedQuantity = tool === "pose" ? usage.frames : usage.activeSeconds;   // ★
```
- **Pose 按帧计费**（`frames`）
- **Realtime / Director 按活跃秒计费**（`activeSeconds`）

## 4.4 换算与埋点

```js
// credits → dollars：1000 credits = $1
usage_dollars : usageCredits      / 1000
billed_dollars: billedUsageCredits / 1000

// 埋点（Convex analytics）
imagine_session_started : { tool, session_id, resolution }  + { workspaceId }
imagine_session_ended   : { tool, session_id, resolution,
                            wall_seconds, active_seconds, frames,
                            usage_credits, usage_dollars,
                            billed_credits, billed_dollars,
                            out_of_credits, totals_complete }
imagine_tool_opened     : { tool }
```
- `totals_complete` = 所有在途上报是否成功（`!hadError`）
- `out_of_credits` 独立字段 → 额度耗尽有专门路径
- session 结束时 `Promise.allSettled([...inFlight])` 等待全部落账

---

# 五、对 open-ai-canvas 的可迁移点（待裁定）

1. **实时链路的两种形态**：fal realtime `connect`（逐帧 `images[0].content`，靠 `output_feedback_strength` + 低 steps 做帧间连续）vs `open`（直接收 MediaStream）。我们若要「实时/流式生成」，前者是逐帧贴图，后者是 WebRTC 视频轨——两条路的工程量与体验差异巨大
2. **`num_inference_steps: 2` + `output_feedback_strength: 1`** 是实时化的核心配方：极低步数换帧率，帧间反馈换连续性。可直接作为我们流式生成的起点参数
3. **`schedule_mu` 单滑杆控制「忠实 vs 放飞」**：`μ = 2.5 − 2.2×freedom` 这种「一个用户语义滑杆映射到一个内部采样参数」的做法，正是我们参数面板 2.0 想要的抽象层级
4. **姿势 → 自然语言的纯函数族**（`describePose` / `describeFraming` / `describeFacing`，阈值 0.36/0.45/0.64/0.7/0.85）：把结构化输入翻译成 prompt 词句，可复用于我们的「预设场景」与「自动提示词」
5. **双通道冗余发消息**（DataChannel + WS 同时发）在实时链路里是实用的可靠性模式
6. **计费抽象**：`active_seconds` 与 `frames` 两种粒度、心跳上报 + pagehide 兜底 + 单调取大 + `out_of_credits` 独立路径 + `totals_complete` 完整性标记——我们若做流式/实时能力，这套计量模型可直接照搬
7. **代理层注入计费参数**（`proxyUrl?billing=X&resolution=Y`）：计费上下文不进业务代码，由代理统一注入，是干净的边界设计
8. **指令版本化时间线**（Director 的 `directions[]` + `prompt_version` + `pending/applied/rejected` 状态）：把「连续对话式指令」做成可追溯的版本记录，比单纯的 chat 历史更适合创作工具

---

# 附：证据与复现

- chunk 清单（本地反解，`/tmp/flora-chunks/`）：
  ```
  3zqb624po1kk-.js  10.8MB  主 bundle（含 fal 客户端、模型端点表）
  1qoler3c4z5br.js   98KB   TOOL_REGISTRY + 路由表 + useAvailableTools
  35mzqs-lfuw81.js   62KB   ★ Pose 实现（连接/发送/姿势词函数/3D 编辑器）
  3y610i8z2910c.js   29KB   ★ Director 实现（configure/prompt/onData 状态机）
  02hbz0c-fn_hc.js   46KB   ★ Realtime 实现（WebRTC 信令/双通道 prompt）
  1bv8kp198hzhl.js   45KB   计费（useImagineUsageMeter/Snapshot/Recording）+ 提示词池
  2dqkvjdy8bpmq.js   56KB   @fal-ai/client 1.5.0（createRealtimeClient）
  ```
- 抓取方法：`app.flora.ai/_next/static/chunks/<name>.js?dpl=<deploymentId>`（公开 CDN，无需登录态）；deployment ID 从页面 `script[src]` 读取
- **证据等级**：端点名、消息字段、参数值、计费公式、状态机 = **bundle 逐字读取（一手）**；「是否真的这样跑」= 未实跑验证（免费账号 `enable-imagine` 可能未开，页面显示 `Camera blocked`）
- 未解：`/api/fal/proxy` 服务端实现、`IMAGINE_HEARTBEAT_INTERVAL_MS` 具体值、credit 单价表、`minimax/h3-max` 与 `decart/lucy-2-5` 的官方模型文档
