# T10 · FLORA 计费与 credits 体系全貌

> 语料：`/tmp/flora-chunks/*.js`（137 个 Next.js/Turbopack chunk）。除特别标注「推断」外，以下代码与字段均为 bundle 逐字抄录（一手证据）。模块 ID（如 `955548`）为 Turbopack 内部 module id，可用于回查。

---

## 一、产品级摘要

### 1.1 双轨制：legacy credits 与 pricing v3 usage credits

FLORA 前端同时存在两套计价单位，bundle 中以 branded type 区分（`asLegacyCredits` / `asUsageCredits`，模块 936015）：

| 单位 | 换算 | 用途 |
|---|---|---|
| **legacy credits** | 1 credit = $0.0009（即 1000 credits ≈ $1.11，由 `legacyCreditsFromUserDollars = Math.round(e / 9e-4)` 反推）；旧公式 1 credit = 1/1333 美元见 2.2 | 旧定价体系（v3 出现前） |
| **usage credits（v3）** | **1 credit = $0.001，即 1000 credits = $1**（`CENTS_TO_CREDITS = 10`，1 美分=10 credits） | pricing v3 主体系：套餐内含额度、prepaid 充值、overage 均以此计 |

v3 换算函数（逐字，模块 955548，chunk 25b_jv9e6qdx1.js）：

```js
"calculatePricingV3UsageCreditsFromUserDollars",0,function(e){
  let t=function(e){ if(void 0!==e){ if(e<0)throw Error("Pricing v3 user dollar price cannot be negative"); return 100*e*10 } }(e);
  return void 0===t?void 0:Math.round(t)
},
"calculatePricingV3UserDollarsFromUsageCredits",0,function(e){
  if(!Number.isFinite(e)||e<0)throw Error("Pricing v3 usage credits cannot be negative or non-finite");
  return e/1e3
}
```

前端展示均以美元为主：UI 上「usage」一律显示 `$x.xx`（credits/1000）。FLORA 对用户的话术已从「credits」过渡为「usage / prepaid usage」，credits 图标（`FloraFlower`）仍出现在工作区切换器中。

### 1.2 订阅套餐层级（pricing v3）

计划枚举与**前端硬编码价格表**（模块 955548，chunk 25b_jv9e6qdx1.js，逐字）：

| Plan key | 月付 (cents) | 季付 (cents) | 年付 (cents) | 折算月价 |
|---|---|---|---|---|
| free_v3 | 0 | 0 | 0 | $0 |
| starter_v3 | 1800 ($18) | 4860 ($48.6) | 17280 ($172.8) | 季 $16.2/mo、年 $14.4/mo |
| pro_v3 | 5000 ($50) | 13500 ($135) | 48000 ($480) | 季 $45/mo、年 $40/mo |
| max_v3 | 20000 ($200) | 54000 ($540) | 192000 ($1920) | 季 $180/mo、年 $160/mo |
| pro_v3_student | 同 pro_v3 | 同上 | 同上 | 学生通道，canonical 归并为 pro_v3 |
| max_v3_professor | 同 max_v3 | 同上 | 同上 | 教师通道，canonical 归并为 max_v3 |

- 季付 tag「10% off」、年付 tag「20% off」（模块 283968，chunk 00d0pt9gjg7yi.js）。
- 完整计划枚举：`Free/Starter/Pro/Max/Enterprise/CreativePartners/StudioPartner/EnterpriseTrial/EnterprisePilot/ProStudent/MaxProfessor/Custom` + 5 个 internal 计划（`internal_flora_v3` 等）。
- 计费周期枚举 `PeriodOption = {OneTime, Monthly, Yearly}`、`RecurringBillingCycleOption = {Month, Quarter, Year}`（模块 825054）。
- 企业/合作计划价格不在前端：`isManagedPricingV3Plan` 覆盖 enterprise/creative_partners/studio_partner 等；`CREATIVE_PARTNERS_USAGE_CENTS = {min:15000, regular:30000, max:77700}` 是唯一泄露的 B 端数字。
- **套餐内含 usage**：来自 entitlements 而非硬编码。Free 计划 `INCLUDED_USAGE_CENTS: 250`（$2.5/月）、`MAX_SEATS:1`、`MAX_ACTIVE_PROJECTS:3`、`USE_VIDEO_GENERATION:false`（模块 903720，chunk 00d0pt9gjg7yi.js）。付费计划的内含额度以营销文案出现：`"Extra $12 usage/seat/mo"`(Starter)、`"Extra $50 included usage/seat/mo"`(Pro)、`"Extra $100 included usage/seat/mo"`(Max)（模块 74801）。`getPricingV3PlanCatalog` 用 `INCLUDED_USAGE_CENTS × CENTS_TO_CREDITS × seats` 计算总额度。

### 1.3 计费粒度：三种模型并存

| 粒度 | 适用场景 | 机制 |
|---|---|---|
| **按次（per generation）** | 画布节点、Batch、Technique、Create agent | 生成前客户端可算价（`calculatePricingV3ReservationCost`）+ 服务端网关报价；一次性结算 |
| **按帧（Pose）** | Imagine Pose Lab | 心跳只上报增量帧数 `frames`，服务端按帧计费 |
| **按活跃秒（active seconds）** | Imagine Realtime（camera）、Director（movie） | 心跳上报 `activeSeconds`（暂停/遮挡不计），服务端按秒计费 |

Imagine 三工具的快照命名（逐字）：`{pose:"Pose render", camera:"Realtime capture", movie:"Director frame"}`（模块 534796，chunk 1bv8kp198hzhl.js）。

**Imagine 心跳链路**（模块 534796 `useImagineUsageMeter`，chunk 02hbz0c-fn_hc.js / 1bv8kp198hzhl.js / 3mggxwccmdq62.js 三份同源拷贝）：

```js
let g=setInterval(f, r.IMAGINE_HEARTBEAT_INTERVAL_MS);  // r = 模块 712588
```

`IMAGINE_HEARTBEAT_INTERVAL_MS = 15e3`（**15 秒**，模块 712588，chunk 02hbz0c-fn_hc.js，逐字：`e.s(["IMAGINE_HEARTBEAT_INTERVAL_MS",0,15e3,"MOVIE_RESOLUTIONS",0,["480p","768p","1080p"]])`）。同模块还有 `Date.UTC(2026,8,14)` 哨兵日期。

心跳实现要点（逐字摘要）：
- 只在 `active && (accruing ?? true)` 时累计活跃时长；`document.visibilitychange` 隐藏时暂停计费（Pose Lab 明确 UI：「Live rendering stopped while you were away — press Play to resume.」）。
- 每拍调用 Convex mutation `api.imagineUsage.mutations.recordImagineUsage({sessionId, tool, activeSeconds, frames, resolution?})`；Pose 以 `frames` 为度量、其余以 `activeSeconds`。
- 客户端对心跳响应做单调合并：取 `usageCredits` 更大者（同值取进度更大者）。
- 会话结束上报分析事件 `imagine_session_ended`，字段含 `wall_seconds/active_seconds/frames/usage_credits/usage_dollars/billed_credits/billed_dollars/out_of_credits/totals_complete`。
- session id 客户端生成（`crypto.randomUUID()`），服务端表为 `imagineUsageSessions`（Convex id，见 2.8）。

**额度耗尽的实时路径**：心跳响应带 `outOfCredits:true` → 前端停流并弹「Out of credits — the stream stopped. Top up to keep rendering.」+ 触发 `reportContextualUsageRecoveryFailure({workspaceId, source:"imagine", sourceAttemptId, requiredUsage})`。Director 会话启动时若 402，读响应体 `requiredUsageCredits` 并报错：「Not enough credits — a session bills at least $X. Top up to start one.」（`/api/fal/wma`，chunk 3y610i8z2910c.js）。

### 1.4 成本预估（生成前）

三套机制：

1. **目录价静态估算**：`getGenerationCostCreditCost({endpoint, modelParameters, inputImageCount})` 用端点参数上的 `costMultiplier / costOffset / costOffsetDollars / costOffsetPerSecond / costPerInputImageDollars / costPerInputImageCredits / freeInputImages` 计算（详见 2.5）。
2. **网关动态报价**：gateway 定价端点在生成前 POST `/api/model-service/quote`（带 endpointId/modelId/input/projectId），返回 `{dollars, isEstimate?}`，前端换算成 credits（`useGatewayQuotedTotal`，300ms debounce，4 并发，2s 缓存）。
3. **Batch 表格汇总**：每行 cost 聚合成 `usageCredits + isEstimate`，配「Estimated usage」文案；超过阈值弹确认框。

**高价运行确认门槛**（模块 770724，chunk 14khmbpcundo7.js，逐字）：

```js
if(!Number.isFinite(e)||e<1e4) return {kind:"none"};        // < 10,000 credits ($10)：不确认
// 1e4..1e5 ($10–$100)：soft —— "Confirm run — $X?"
// >=1e5 ($100+)：hard —— "Confirm expensive run — $X?" + AlertTriangle
```

对话框按钮 `Run for $X`；确认事件 `run_cost_confirmation` 上报 `charged_usage_cost/projected_user_dollars`。

**充值页估算**：Top-up 弹窗用近 90 天用量（`getTopModels`，7776e6 ms=90d）计算 `usagePerGeneration = credits/runs`，显示「$X gets you about N <model> generations」，取 top-2 模型；兜底模型硬编码：`t2v-seedance-2.0-enhancor`（Seedance 2.0）、`t2i-gemini-3.1-flash-image`（Nano Banana 2）（模块 965796，chunk 0qc9wg5ly4_ux.js）。

### 1.5 额度组成与水位

用户/工作区余额视图（`getPricingV3ClientAvailableUsage`，模块 736693，chunk 2d1m61zu3l589.js）：

```
可用额度 = availableUsage + prepaidUsage
         + (overageEnabled && 无账务问题时 : max(0, overageLimit − periodOverageUsage))
最终可用 = min(上述, 用户个人上限, workspaceAvailableUsageV3)
```

用量 waterfall（`getPricingV3PeopleUsageTooltipLines`，模块 62817）：`included limit − used → remaining`，超出部分标注「Extra usage: from wallet（prepaid）, overage」。四个 usage pool 标签：`Included / Prepaid / Overage / Promo`（模块 749097，chunk 0co13buln55xq.js）。

**低水位提醒**：`FREE_PLAN_CREDIT_THRESHOLD = 250`（$0.25）、`PAID_PLAN_CREDIT_THRESHOLD = 500`（$0.5）；余额下穿阈值自动打开充值弹窗（模块 516962，chunk 00d0pt9gjg7yi.js）。

**额度耗尽的细分原因**（`PricingV3InsufficientUsageReason` → 文案，模块 736693）：

| 原因 | 用户文案 |
|---|---|
| AutoTopUpPending | 「Auto top-up is processing」 |
| BillingIssue | 「Payment needs attention」 |
| OverageDisabled | 「Insufficient usage available」 |
| OverageLimitExceeded | 「Overage limit reached」 |
| MemberUsageLimitExceeded | 「Usage limit reached」（提示升级） |
| WorkspaceUsageLimitExceeded | 「Workspace usage limit reached」 |
| UsageExhausted | 「Usage allocation exhausted」 |

成员级预检还会用 `getPricingV3ClientPreflightCost(endpoint, params, discountPercent) = cost × (1−discount%)`。

### 1.6 充值 / Auto top-up / Overage

- **充值门槛**：非企业最低 $5、企业最低 $100；上限 `MAX_PRICING_V3_TOP_UP_USER_DOLLARS = 5000`；预设 `[10,25,50,100]`（企业 `[100,250,500,1000]`）（模块 38495，chunk 0h-k40t8ezsga.js）。Free 计划需 wallet-unlock 实验 treatment 才可充值（`canPurchasePricingV3TopUp`）。
- **Auto top-up**：默认参数 `amount $50 / threshold $10 / period limit $200`；「below $X adds $Y, up to $Z per billing period」；无卡时先走 Stripe Setup Session 存卡（模块 920833/965796/38495）。
- **Overage（后付）**：需绑卡 + entitlement；free 计划硬顶 `VIDEO_UNLOCK_OVERAGE_HARD_CAP_DOLLARS = 5`（只读）；企业 overage 发票周期与 `OVERAGE_SPENDING_CAP_CENTS` entitlement 联动；回收流程事件：`billing_overage_invoice_invoiced/issued/collected`、`autopay_charge_completed/failed`（chunk 245x6abtmz2ih.js）。
- **GRo-38 上下文充值实验**：`gro-38-contextual-top-up-approval`（control/test）。命中 `OverageDisabled/UsageExhausted` 时弹「Top up usage / Request top-up」toast 或 dialog；无权限者向管理员发起 `billingExpansionRequests.actions.createUsageTopUpRequest` 审批流（chunk 0ji-dzh0p7x00.js / 1bthkvq3fhxwj.js / 2vbd3ltw6fooi.js）。
- **支付通道**：Stripe Checkout（`api.stripe.actions.createPricingV3TopUpCheckoutSession` → `redirectToCheckout(sessionId)`；存卡走 `createSetupSession`）；充值成功回跳 `purchaseRedirectUrl = "/purchases/success"`，订阅成功 `/subscriptions/success`。

### 1.7 usage / billing / plans 页面结构

静态路由（chunk 3jhgeds-e4yyh.js）：`/settings/billing`、`/settings/usage`、`/settings/plans`、`/checkout`、`/pricing`、`/credit`、`/admin/credit-statements`、`/admin/due-invoices`、`/admin/bulk-add-credits`、`/admin/workspaces/{id}/credits`、`/admin/pricing-v3-migrations`。文档锚点：`docs.flora.ai/plans-and-billing/pricing`、`/parameter-pricing`、`/launch-bonus`。

- **/settings/usage**（默认导出，chunk 0co13buln55xq.js）：时间窗 1d/7d/30d/90d/all；`usage.actions.getUsage` 分页拉取 reservations（25/页）；PeriodBreakdownCard 按 Text/Image/Audio/Video/Technique 分类（服务端 summary 字段 `textCredits…techniqueRuns + topModels`）；UsageModelBreakdownList 展开到模型级；Create agent 会话按 turn 聚合（`spentTurnCount/failedTurnCount/tokenTotals/reservedUsage "+$X pending"`）；行级展示 `Estimated $a · Charged $b`（`quotedAmountUsage ≠ amountUsage` 时）；价格规则折扣用 `formatCostBreakdownForDisplay` 渲染 `Base $x; param=y x1.5 +$0.02 scaled; discount 20% -$0.03; final $0.12`；CSV 导出（≤1 天同步导出，>1 天 `usage.exports.mutations.enqueueUsageExport` 邮件投递），CSV 列含 `Cost, Modifiers, Usage pool`。
- **/settings/billing**：`PricingV3UsageWaterfall`（Included/Prepaid/Overage 三段）+ Payment method（卡品牌+last4）+ Overage 开关与上限 + Auto top-up 控制 + seats 管理 + `useBillingSettingsAccess`；企业走 `enterprise_invoice` 模式。
- **组织分析**：`POST /api/organization-analytics/summary` 与 `/models`（逐字，chunk 1n2meeaqbzn9r.js），per-workspace `breakdown` + per-model usage，CSV 异步导出。
- **模型价格表**：**没有完整的前端静态价目表**。单价来自端点目录（`userDollars`/`baseCost`/cost 参数）与运行时网关报价；/settings/usage 页仅链接外部文档 `parameterPricing`。「推断：价格目录服务端下发，前端按端点懒取。」

---

## 二、机制级附录（逐字抄录）

### 2.1 核心换算模块 955548（chunk 25b_jv9e6qdx1.js）

```js
"CENTS_TO_CREDITS",0,10,
"CREATIVE_PARTNERS_USAGE_CENTS",0,{min:15e3,regular:3e4,max:77700},
"INTERNAL_V3_PLANS",0,["internal_flora_v3","internal_free_v3","internal_starter_v3","internal_pro_v3","internal_max_v3"],
"INTERNAL_V3_PLAN_CREDIT_CENTS",0,1e5,
"getCanonicalBillingPlan",0,function(e){return"pro_v3_student"===e?"pro_v3":"max_v3_professor"===e?"max_v3":e},
"getPricingV3PlanMonthlyDisplayPriceCents",0,function(e,t){var i=u(e,t);switch(t){case o.RecurringBillingCycleOption.Month:return i;case o.RecurringBillingCycleOption.Quarter:return i/3;case o.RecurringBillingCycleOption.Year:return i/12;default:return t}},
"legacyCreditsFromUserDollars",0,function(e){return Math.round(e/9e-4)},
"isPricingV3SelfServePlan",0,function(e){return"starter_v3"===e||"pro_v3"===e||"max_v3"===e||"pro_v3_student"===e||"max_v3_professor"===e},
```

价格表 `l`（同模块）：

```js
l={free_v3:{Monthly:0,Quarter:0,Yearly:0},
   starter_v3:{Monthly:1800,Quarter:4860,Yearly:17280},
   pro_v3:{Monthly:5e3,Quarter:13500,Yearly:48e3},
   max_v3:{Monthly:2e4,Quarter:54e3,Yearly:192e3},
   pro_v3_student:{Monthly:5e3,Quarter:13500,Yearly:48e3},
   max_v3_professor:{Monthly:2e4,Quarter:54e3,Yearly:192e3}}
```

legacy→v3 桥接（模块 242026，同 chunk）：

```js
function i(e){return 1.2*e*100*t.CENTS_TO_CREDITS}          // calculateV3Usage(legacyDollars)
function n(e){return (0,o.asUsageCredits)(Math.round(i(e/1333)))}  // calculatePricingV3UsageCostFromLegacyCredits
// → 1 legacy credit = $1/1333；v3 = legacy$ × 1.2 × 1000
"resolveTechniqueChargedUsageCost",0,function(e){return e.chargedUsageCost??r(e.chargedCost)}
```

（推断：`1.2` 是 legacy→v3 的溢价系数，即老用户迁移后同价美元多收 20% credits，或等价于老 credits 打折。）

### 2.2 计价引擎 294626（chunk 25b_jv9e6qdx1.js）

```js
"calculateCost",0,function(e,t,o){let{baseCost:i}=e.options,{costMultiplier:n,costOffset:a,costOffsetScaled:s}=G(e,t,o);
  return (0,r.asLegacyCredits)(Math.round((i+s)*n+a))},
"calculatePricingV3ReservationCost",0,function(e,t,o){
  let i=function(e,t,o){ /* U(e,t)=safeParams; G(e,i,o)=收集带 cost 的选项 */
    return{ baseCost:(0,n.calculatePricingV3UsageCreditsFromUserDollars)(r.userDollars)??(0,a.calculateV3UsageFromLegacyCredits)(r.baseCost),
            modifiers:u.filter(e=>void 0!==e.multiplier||void 0!==e.offset&&0!==e.offset)} }(e,t,o);
  return{usageCredit: /* round((baseCost+scaledOffsets)*multiplier + nonScaledOffsets) */, costBreakdown:i}}
```

参数级成本字段（`G` 函数逐字）：每个 select 选项可带 `costMultiplier`、`costOffset`（legacy credits）、`costOffsetDollars`、`costOffsetPerSecond`（×`duration`，缺省 5 秒）、`costOffsetsScale`（决定 offset 是否吃 multiplier）。**时长计费同样存在于按次模型**：`costOffsetPerSecond × (parseInt(duration)||5)`。

输入图附加费（逐字）：

```js
let{costPerInputImageDollars:d,costPerInputImageCredits:g,freeInputImages:h}=e.options;
// 计费图数 = max(不同 url 参数个数, gateway?inputImageCount:0) − (freeInputImages ?? 1)
m.push({name:"input_images",value:n,costOffset:t,costOffsetDollars:e})
```

取整：同 source（`legacyCredits` vs `nurseryDollars`）同 scaling 组内，最大余数法分摊整数 credits offset。

### 2.3 网关报价（chunk 1pp_mcr9fd5g4.js，模块 642814）

```js
flight:fetch("/api/model-service/quote",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({...e,input:t,projectId:n})})
  .then(e=>e.ok&&204!==e.status?e.json():void 0)   // 204 = 无报价
```

- 单报价 key：`${projectId}:${endpointId}:${modelId}:${JSON.stringify(input)}`；请求 key：`${period}:${keys JSON}`（模块 31129，chunk 14khmbpcundo7.js）。
- 汇总（模块 31129 逐字）：`n+=e?calculatePricingV3UsageCreditsFromUserDollars(e.dollars)??0)*i.count:i.catalogCredits; o||=e?.isEstimate===!0||void 0===e&&void 0!==i.request` → 无报价回退目录价并整体标记 estimate。
- `buildGatewayQuoteRequest`：仅对 `isGatewayPricedEndpoint(options)` 或有迁移目标的端点报价；入参剔除 seed、空串；`gatewayQuoteRequestKey = ${endpointId}:${modelId}:${JSON.stringify(input)}`。
- LoRA 训练费用同理：`quote?calculatePricingV3UsageCreditsFromUserDollars(quote.dollars):catalogCredits`（chunk 2n2uwrludwnb0.js）。

### 2.4 额度计算 736693（chunk 2d1m61zu3l589.js，完整逐字）

```js
function i(e){let r=(e.availableUsage??0)+(e.prepaidUsage??0);
  if(!0!==e.overageEnabled||(0,t.hasPricingV3BillingIssue)(e))return r;
  let i=e.periodOverageUsage??e.overageUsage??0;return r+Math.max(0,(e.overageLimit??0)-i)}
function n(e){let r=e.effectiveUserAvailableUsageV3??e.userAvailableUsageV3;
  if("free_collaborator"===e.userAvailableUsageV3Source)return r??0;
  if(!(!0===e.overageEnabled&&!(0,t.hasPricingV3BillingIssue)(e))&&void 0===e.availableUsage&&void 0===e.prepaidUsage)return null;
  let n=i(e);return Math.min(n,r??n,e.workspaceAvailableUsageV3??n)}
"getPricingV3ClientPreflightCost",0,function(e,t,r){return Math.round(a(e,t)*(1-Math.min(100,Math.max(0,r))/100))}
```

`overageEnabled && hasPricingV3BillingIssue` 时剩余 overage 空间不计入可用额度。

### 2.5 单次生成成本入口 658225（chunk 2n2uwrludwnb0.js）

```js
function a({endpoint:e,modelParameters:n,inputImageCount:l}){
  if(!e||(0,r.isGatewayPricedEndpoint)(e.options)&&!e.options.userDollars&&!e.options.baseCost)return null;
  let i=(0,t.calculatePricingV3ReservationCost)(e,n??{},{inputImageCount:l}).usageCredit;
  return i<=0&&(0,r.isGatewayPricedEndpoint)(e.options)?null:i}
"formatGenerationCostDollarAmount",0,function(e){return e<=0?"Free":`$${e.toFixed(3)}`}
```

### 2.6 Run-cost 确认 770724（chunk 14khmbpcundo7.js）

```js
function({chargedUsageCost:e}){
  if(!Number.isFinite(e)||e<1e4)return{kind:"none"};
  let t=(0,n.calculatePricingV3UserDollarsFromUsageCredits)(e),r=`$${t.toFixed(2)}`;
  return e>=1e5?{kind:"hard",chargedUsageCost:e,projectedUserDollars:t,
      title:`Confirm expensive run — ${r}?`,description:`This run is projected to cost ${r}. Are you sure you want to continue?`,confirmLabel:`Run for ${r}`}
    :{kind:"soft",chargedUsageCost:e,projectedUserDollars:t,
      title:`Confirm run — ${r}?`,description:`This run is projected to cost ${r}.`,confirmLabel:`Run for ${r}`}}
```

队列式控制器：`enqueue/advance/mountController/unmountController`；批量行数 >1 改走 `openGenerationQueuePricing({source:"batch_generation"})`。Batch 运行参数（逐字，chunk 1hayrh3hp9xtt.js）：`G({tableId, rowIds, requestId:crypto.randomUUID(), runAction, requestedUsageCreditsEstimate, usageCreditsEstimateIsApproximate})`。

### 2.7 Imagine 心跳与结算（模块 534796；chunk 02hbz0c-fn_hc.js ≡ 1bv8kp198hzhl.js ≡ 3mggxwccmdq62.js）

```js
S=(0,a.useMutation)(s.api.imagineUsage.mutations.recordImagineUsage)
// 心跳体：
u=j.current({sessionId:i,tool:p,activeSeconds:s,frames:o,...c?{resolution:c}:{}})
// 会话结束分析事件：
(0,l.captureAnalyticsEvent)(n.EVENTS.imagine_session_ended,{tool:p,session_id:i,resolution:c,
  wall_seconds:Math.round((Date.now()-u)/1e3),active_seconds:t?.activeSeconds??0,frames:t?.frames??0,
  usage_credits:t?.usageCredits??0,usage_dollars:(t?.usageCredits??0)/1e3,
  billed_credits:t?.billedUsageCredits??0,billed_dollars:(t?.billedUsageCredits??0)/1e3,
  out_of_credits:t?.outOfCredits===!0,totals_complete:!a},o)
```

recordImagineUsage 返回结构（由消费端字段反推，一手）：`{usageCredits, activeSeconds, frames, billedUsageCredits, outOfCredits}`；Director 402 响应体含 `requiredUsageCredits`（`/api/fal/wma`，chunk 3y610i8z2910c.js，逐字）。

Pose Lab UI 文案（逐字，chunk 35mzqs-lfuw81.js）：
- 用量角标：`data-test:"pose-lab-usage"` → `formatUsageDollars(usageCredits,{maximumFractionDigits:3})`；
- 离线停流：`"Live rendering stopped while you were away — press Play to resume."`（`pose-lab-autostop-notice`）；
- 耗尽：`"Out of credits — the stream stopped. Top up to keep rendering."`（`pose-lab-credits-notice`）。

### 2.8 Convex 数据模型（validator 逐字，chunk 2ru825uhloavh.js，模块 98368）

`customers`（计费主表）关键字段：

```js
plan, currentPeriodStart, currentPeriodEnd, availableCredits, purchasedCredits, monthlyCredits,
paidFirstInvoice, status, stripeSubscriptionStatus, billingCycle, autopay, savedCreditCard, cardLast4, cardBrand,
periodBaseCredits, overageEnabled, overageLimit,
autoTopUpEnabled, autoTopUpThreshold, autoTopUpAmount, autoTopUpPeriodLimit,
billingIssueStatus:{status:"ok"|"unhealthy", updatedAt, issues:[{source:"subscription"|"overage",
  stripeInvoiceId?, localOverageInvoiceId?(id:"overageInvoices"), status:"collecting"|"requires_payment"|"retry_scheduled",
  nextPaymentAttemptAt?, failure?{code,declineCode,adviceCode,message,statusCode,type}}]},
pendingPlanSource, pendingCredits, pendingPeriod, pendingChangeDate, pendingStripeScheduleId,
pendingChangePreview:{type:"seat_add"|"plan_upgrade", prorationDate, targetPlan?, targetPeriod?, targetEditorSeats, currentPeriodEnd},
cancelAtPeriodEnd, cancelAt, gro43WalletUnlockVariant:"control"|"treatment",
dailyFreeCreditRefreshVariant:"control"|"treatment", dailyFreeCreditRefreshNextGrantAt, nextResetAt, freeUsageEndsAt
```

余额/用量子对象（workspace 级）：

```js
availableCredits?, monthlyCredits?, availableUsage?, includedUsageLimit?, currentUsageLimit?,
prepaidUsage?, prepaidUsageLimit?, overageUsage?, periodOverageUsage?, nextOverageCollectionAt?,
usageThresholdNotifications:{periodStart, notified:number[]},
autoTopUpPendingAt?, autoTopUpInvoiceId?, autoTopUpLastFailedAt?, periodAutoTopUpUsage?
```

credit 消耗记录（imagineSessionId 关联表 `imagineUsageSessions`）：

```js
{workspaceId, organizationId?, userId, generationId?(id:"generationHistory"), techniqueRunId?(id:"techniqueRuns"),
 renderJobId?(id:"videoEditorRenderJobs"), imagineSessionId?(id:"imagineUsageSessions"), nodeId,
 amount:vLegacyCredits(), amountUsage?:vUsageCredits(), fixedAddOnUsageCredits?, talentUsageCharges?,
 amountFromFreePool, billingSystem?:"legacy"|"v3",
 amountIncluded?, amountPrepaid?, amountOverage?, baseAmount?, quotedAmountUsage?,
 actualProviderCostUsd?, appliedRule?:{source:"plan_default"|"workspace_override"|"experiment", modelId, ruleSlug?, discountPercent},
 modelPriceRuleSurface?, modelPriceRuleModelName?, modelPriceRuleEndpointId?,
 costBreakdown?:{baseCost, modifiers:[{name,value,multiplier?,offset?,costOffsetsScale?}],
   tokenUsage?:{inputTokens,cacheReadTokens,cacheWriteTokens,outputTokens}, dominantBrain?},
 customerId?, customerPlan?, customerBillingCycle?, status, expiresAt, usageCountersUpdated?}
```

月度赠送：`{customerId, periodKey, creditsAwarded, awardedAt, reason, plan, seatsNumber?, voidedAt?, voidReason?}`。
overage 发票：`{..., overageUsage, amountCents, currency, status:"needs_creation"|"creating"|"open"|"payment_failed"|"paid"|"void", reason:"daily_threshold"|"period_end_threshold"|"plan_threshold"|"hard_cap_threshold"|"customer_cap_threshold"|"manual", idempotencyKey, paymentRetry?:{attempts,maxAttempts,nextPaymentAttemptAt?,exhaustedAt?,lastDecisionKind?}}`。

### 2.9 REST 端点清单（chunk 245x6abtmz2ih.js，模块 344750，逐字）

```js
api:{ billing:{ "update-user-credits":"/api/billing/update-user-credits",
                "reserve-credits":"/api/billing/reserve-credits",
                "spend-credits":"/api/billing/spend-credits",
                "release-credits":"/api/billing/release-credits" }, ... }
appRoutes:{ credit:"/credit", pricing:e=>`/pricing?redirect=${e}`,
            checkout:e=>`/checkout?${qs}`,                       // {plan, period}
            purchaseRedirectUrl:"/purchases/success", subscriptionRedirectUrl:"/subscriptions/success",
            settings:{ billing:"/settings/billing", usage:"/settings/usage", plans:"/settings/plans",
                       billingForWorkspace:e=>`/settings?...workspace=${e}` }   // i("billing",e)
            admin:{ creditStatements:"/admin/credit-statements", dueInvoices:"/admin/due-invoices", ...} }
docsRoutes: usageBasedPricing:"https://docs.flora.ai/plans-and-billing/pricing",
            parameterPricing:"https://docs.flora.ai/plans-and-billing/parameter-pricing",
            nanoBananaLaunchBonus:"https://docs.flora.ai/plans-and-billing/launch-bonus#unmetered-nano-banana-for-pro-and-max"
```

路由清单另含 `/admin/bulk-add-credits`、`/admin/workspaces/{id}/credits`、`/admin/pricing-v3-migrations[/log]`、`/admin/credit-statements`（chunk 3jhgeds-e4yyh.js）。报价端点 `/api/model-service/quote`；组织分析 `/api/organization-analytics/summary|models`；Imagine/Director `/api/fal/wma`、`/api/fal/proxy`。

### 2.10 Convex API 面覆盖（前端引用逐字）

```
api.currentUser.queries.{credits, creditsForWorkspace, creditsForWorkspaces, me, currentWorkspace, currentAccess, workspaces}
api.currentUser.mutations.{updatePricingV3AutoTopUpSettings, updatePricingV3OverageSettings}
api.currentUser.enterpriseSeatAdditions.{previewEnterpriseSeatAddition, confirmEnterpriseSeatAddition}
api.imagineUsage.mutations.recordImagineUsage
api.usage.actions.{getUsage, getTopModels};  api.usage.exports.mutations.enqueueUsageExport
api.usage.filterQueries.listWorkspaceUsers;  api.credit.filterQueries.{searchWorkspaceProjects, searchWorkspaceFolders}
api.stripe.actions.{createPricingV3TopUpCheckoutSession, createSetupSession}
api.stripe.nodeActions.{previewPricingV3PlanChange, upgradePricingV3Plan}
api.billingExpansionRequests.actions.{createUsageTopUpRequest, rejectUsageTopUpRequest} (+ approve hook)
api.organizationAnalytics.exports.mutations.enqueueOrganizationAnalyticsExport
```

### 2.11 充值/限额常量（逐字）

```js
// 模块 38495 (chunk 0h-k40t8ezsga.js)
"MAX_PRICING_V3_TOP_UP_USER_DOLLARS",0,5e3
"PRICING_V3_ENTERPRISE_TOP_UP_PRESET_USER_DOLLARS",0,[100,250,500,1e3]
"PRICING_V3_TOP_UP_PRESET_USER_DOLLARS",0,[10,25,50,100]
getPricingV3TopUpAmountError: min=isEnterprise?100:5, max=5000

// 模块 920833 (chunk 207ldnnvugp-_.js)
"DEFAULT_PRICING_V3_AUTO_TOP_UP_AMOUNT_USER_DOLLARS",0,50
"DEFAULT_PRICING_V3_AUTO_TOP_UP_PERIOD_LIMIT_USER_DOLLARS",0,200
"DEFAULT_PRICING_V3_AUTO_TOP_UP_THRESHOLD_USER_DOLLARS",0,10
// 校验：threshold≥1 整数；amount≥threshold；periodLimit≥amount 且 ≤5000

// 模块 388324 (chunk 0qc9wg5ly4_ux.js)
"VIDEO_UNLOCK_OVERAGE_HARD_CAP_DOLLARS",0,5
canManagePricingV3Overage({plan,canEditBilling,hasCreditCard,overageEnabled,overageAllowedEntitlement})
isFreePlanOverageLimitReadOnly(e){return e===b.PricingV3Plan.Free}  // "This cap is fixed at $5.00 on the free plan."
```

### 2.12 金额格式化（逐字）

```js
// 模块 504397 (chunk 00d0pt9gjg7yi.js)：cents→美元
"formatPriceDollars",0,function(e){let t=e/100;return new Intl.NumberFormat("en-US",
  {style:"currency",currency:"USD",minimumFractionDigits:2*(t%1!=0),maximumFractionDigits:2*(t%1!=0)}).format(t)}

// 模块 674428 (chunk 18_rcz_m_sgob.js)：credits→美元；1 credit=$0.001
let r=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:3});
function i(e){return r.format((e??0)/t.CENTS_TO_CREDITS/100)}
"formatUsageCreditsAsDollars",0,i
"formatCostBreakdownForDisplay",0,function(e,t={}){ if(!e)return"";
  let r=[`Base ${i(e.baseCost)}`];
  for(let t of e.modifiers){let e=[`${t.name}=${String(t.value)}`];
    if(void 0!==t.multiplier&&e.push(`x${t.multiplier}`),
      void 0!==t.offset&&0!==t.offset){let r=t.offset<0?"-":"+";
      e.push(`${r}${i(Math.abs(t.offset))}`),t.costOffsetsScale&&e.push("scaled")}
    e.length>1&&r.push(e.join(" "))}                      // "param=val x1.5 +$0.02 scaled"
  let{amountUsage:n,baseAmount:s,discountPercent:o}=t;
  if(void 0!==o&&void 0!==s&&void 0!==n){let e=s-n;0!==e&&(
    r.push(`discount ${a.format(o)}% ${e<0?"+":"-"}${i(Math.abs(e))}`),r.push(`final ${i(n)}`))}
  return r.join("; ")}

// <$0.01 显示（模块 62817）：e>0&&e<CENTS_TO_CREDITS → "<$0.01"
// 千分位 credits（模块 294626）：formatCredits → "0" / "999" / "1.5k"
```

### 2.13 关键实验与开关

```js
// 模块 428683 (chunk 3e97v9t6pv1g4.js)
definePostHogExperiment({key:"gro-38-contextual-top-up-approval",variants:["control","test"],trackingVariantPropName:"gro_38_variant"})
isGro38EligibleWorkspace(e): canPurchasePricingV3TopUp({plan,status}) && !enterprise && !overageEnabled && !isUsageBasedEnterprise && !hasPricingV3BillingIssue
isGro38RecoveryReason(e): e===OverageDisabled || e===UsageExhausted
// customers 表：gro43WalletUnlockVariant:"control"|"treatment"（free 钱包解锁实验）
// dailyFreeCreditRefreshVariant:"control"|"treatment"（每日免费额度刷新实验）
```

低水位自动弹窗（模块 516962，chunk 00d0pt9gjg7yi.js）：

```js
"FREE_PLAN_CREDIT_THRESHOLD",0,250,"PAID_PLAN_CREDIT_THRESHOLD",0,500
m=(p=e===l.PricingV3Plan.Free)?250:500,{displayCredits:u,isFreePlan:p,threshold:m,shouldShowCreditWarning:u<m}
```

---

## 三、证据与来源

### 3.1 chunk 清单（本任务实际读取/提取的文件）

| Chunk | 内容 |
|---|---|
| `25b_jv9e6qdx1.js` | 模块 955548（CENTS_TO_CREDITS=10、计划枚举+价格表）、242026（legacy↔v3 换算）、825054（周期枚举）、936015（branded types）、294626（calculateCost / calculatePricingV3ReservationCost / G/U、input_images 附加费）、447727（provider 枚举） |
| `0h-k40t8ezsga.js` | 模块 38495（top-up 常量与校验、canPurchasePricingV3TopUp） |
| `207ldnnvugp-_.js` | 模块 920833/965796（auto top-up 默认值与校验、UsageTopUpMode/Source） |
| `2d1m61zu3l589.js` | 模块 736693（getPricingV3ClientAvailableUsage / InsufficientUsageReason / PreflightCost） |
| `14khmbpcundo7.js` | 模块 31129（useGatewayQuotedTotal/sumQuotedCostGroups）、10794/79979（buildGatewayQuoteRequest）、770724（requestRunCostConfirmation 阈值 1e4/1e5） |
| `1pp_mcr9fd5g4.js` | 模块 642814（POST /api/model-service/quote、缓存/并发） |
| `2n2uwrludwnb0.js` | 模块 658225（getGenerationCostCreditCost）、useGatewayQuote、StylesTrainDialog（LoRA 报价） |
| `02hbz0c-fn_hc.js` | 模块 712588（IMAGINE_HEARTBEAT_INTERVAL_MS=15e3、MOVIE_RESOLUTIONS）、534796（useImagineUsageMeter）、Realtime 组件（outOfCredits 处理） |
| `1bv8kp198hzhl.js` / `3mggxwccmdq62.js` | useImagineUsageMeter 另两份拷贝（多入口共享） |
| `35mzqs-lfuw81.js` | Pose Lab UI（pose-lab-usage / autostop / credits-notice 文案） |
| `3y610i8z2910c.js` | Director `/api/fal/wma` 402 → requiredUsageCredits 错误文案 |
| `2ru825uhloavh.js` | 模块 98368：customers/余额/credit 消耗/月度赠送/overage 发票 validators；billingIssueStatus 结构 |
| `245x6abtmz2ih.js` | EVENTS（billing_* / pricing_v3_* / run_cost_confirmation…）、appRoutes（REST 端点表、checkout、admin credit 路由）、docsRoutes |
| `3jhgeds-e4yyh.js` | 静态路由清单（/settings/billing /usage /plans、/checkout、/admin/credit-statements…） |
| `00d0pt9gjg7yi.js` | 模块 516962（阈值/警告）、74801（套餐文案+launch offer）、844388（getPricingV3PlanCatalog）、903720（entitlements 默认值，Free INCLUDED_USAGE_CENTS=250）、504397（formatPriceDollars）、PricingModal 卡片 |
| `0co13buln55xq.js` | usage 页默认导出（getUsage 分页/CSV 导出）、749097（PeriodBreakdownCard/UsageModelBreakdownList、pool 标签、formatCostBreakdownForDisplay 消费端）、389299（getPricingV3PeoplePlanSummary）、billing 面板（卡管理/overage） |
| `0qc9wg5ly4_ux.js` | 模块 62817（usage waterfall/tooltip）、388324（overage 开关/hard cap）、965796（PricingV3UsageTopUpDialog + 「$X gets you about」估算 + stripe checkout）、formatUsageDollarsInput |
| `1bthkvq3fhxwj.js` / `2vbd3ltw6fooi.js` / `0ji-dzh0p7x00.js` | useHandleInsufficientCredits / ContextualUsageRecoveryHost / GRo-38 prompt+dialog / reportContextualUsageRecoveryFailure |
| `1n2meeaqbzn9r.js` | 组织分析（/api/organization-analytics/summary、/models、CSV 导出） |
| `1hayrh3hp9xtt.js` | Batch/GenerationTable：requestRunCostConfirmation 消费端、requestedUsageCreditsEstimate 参数 |
| `18_rcz_m_sgob.js` | 模块 674428（formatCostBreakdownForDisplay / formatUsageCreditsAsDollars）、SUBSCRIPTION_CANCELLATION_REASONS |
| `0zuerjfqaw5ej.js` | creditsForWorkspaces 消费端（工作区切换器 credits 徽标） |

### 3.2 可复现命令

```bash
# 定位关键词所在 chunk
grep -l 'creditCost\|usageCredits\|IMAGINE_HEARTBEAT\|CENTS_TO_CREDITS\|outOfCredits' /tmp/flora-chunks/*.js

# 定向提取窗口（示例：心跳间隔）
python3 - <<'EOF'
import re
src=open('/tmp/flora-chunks/02hbz0c-fn_hc.js').read()
i=src.find('IMAGINE_HEARTBEAT')
print(src[i-200:i+200])
EOF

# 模块全文提取（示例：定价模块 955548）
python3 - <<'EOF'
import re
src=open('/tmp/flora-chunks/25b_jv9e6qdx1.js').read()
m=re.search(r'955548,e=>\{"use strict"',src)
print(src[m.start():m.start()+7000])
EOF
```

### 3.3 证据等级与缺口

**一手逐字**：换算常量与公式、套餐价格表、心跳间隔 15e3、确认阈值 1e4/1e5、top-up/auto-top-up 常量、REST 端点、Convex validators、usage 页结构、超限原因文案、`/api/model-service/quote` 请求体、`/api/fal/wma` 402 行为。

**推断（已标注）**：recordImagineUsage 返回结构完整形态（由消费端字段反推）；`1.2` legacy→v3 系数的业务含义；price catalog 由服务端下发。

**未找到**：
- 各模型的具体单价数字（前端只有目录参数与运行时报价，无静态价目表）；
- Imagine 三工具的单价/费率（active seconds 与 frames 的美元单价完全在服务端）；
- `CENTS_TO_CREDITS` 与 Imagine 计费之间是否存在独立费率表；
- recordImagineUsage 请求体的服务端校验定义（前端仅有调用侧）；
- `/credit`、`/settings/plans` 页面的完整组件实现（本次未定位到渲染 chunk，路由存在为一手证据）。
