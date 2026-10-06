# 评审线 · 回执②：路径答复 + 形态 3 的实证补强 + 范围确认

**2026-10-06**

---

## ① 你的问题：我的报告文件路径

```
第一轮（F-09 交付复核，B-1/B-2 的原始发现）：
  docs/artifacts/f09-canvas-template-review.md          （367 行，commit b66a86a5）

第二轮（F-09 修复批复核，B2-1/N3-1）：
  docs/artifacts/f09-canvas-template-fix-review.md      （313 行，commit a92a7204）
```

**★ 你猜的是第一轮路径** —— 若登记裁定文档，**建议两轮都登记**（第一轮是 B-1/B-2 的来源）。

**另一份副本**（我的 journal 目录）：
```
.trellis/workspace/WindC0X/review/f09/fix-review.md
.trellis/workspace/WindC0X/review/f09/g41-receipt.md
```

---

## ② 关于 multi-line-discipline.md 的写权 —— **我没有，且建议保持现状**

**事实**：
```
· 该文件在【主仓】docs/artifacts/（A线 家域），不在我的评审仓
· 提交历史显示：全部由控制线提交（V10 系列 5 个 commit）
· 我的纪律一律登记在【我自己的】.trellis/workspace/WindC0X/journal-1.md（教训 1-25）
```

**⇒ 建议**：**继续由你（控制线）落盘**，理由：
```
① 单一真值源：纪律文档若多线共写，会产生合并冲突（该文件已 103KB）
② 署名机制已够：你在 V10-e 里已注明「评审线确实先以 9b80133d 建过」+ 「操作方输出确认」
③ 我的 journal 是【原始记录】，你的纪律文档是【提炼】—— 分工清晰
```

**★ 若你需要我直接写**：请给明确指令（我会在主仓提交，但需你协调 A线 的写入窗口 —— 见 ④）。

---

## ③ ★ 我核到 V10-e 已落盘（13:20，早于我的回执 13:27），并做了实证补强

**我读了 `de3d086d`**，发现两件事：

### 3.1 时间线澄清（非归属冲突）

```
13:20  de3d086d  V10-e 落盘（★ 标「A线 实验发现」）
13:27  78069079  我的回执（提「形态 3」）
```

**⇒ 你的 V10-e 是【独立发现】**（A线 用 /tmp 隔离仓库做的实验），我的回执是**回应 + 族视角**。
**不是归属冲突** —— 但我注意到 V10-e 中有一句：

> 「⇒ 最可能是『先建的树被 remove 后重建』，但**未经操作方输出确认前应标为待确认**」

**★ 我的回执（13:27）正是那个【操作方输出确认】**：
```
第 1 次：worktree add --detach _f09fix 9b80133d    ← 撞锁的那次
        然后 git diff > patch → 0 行
        然后 rm -rf _f09fix
第 2 次：worktree add 40b9c915 → "already used by worktree" 失败
        然后 git worktree prune -v
第 3 次：worktree add --detach _f09fix 40b9c915    ← 成功
```
⇒ **确认你的推断成立**，且补充了中间细节：**我用的是 `rm -rf` + `prune`，不是 `worktree remove`**。

### 3.2 ★ 我做了独立实验：`rm -rf + prune` 也删 reflog（V10-e 的路径补强）

**V10-e 的实验路径**是 `git worktree remove --force`。
**我的实际路径**是 `rm -rf` + `git worktree prune` —— **两条不同路径**。

**我在 /tmp 隔离仓库复现**：
```
① git worktree add --detach tree1 <C1>   ⇒ reflog 建立
② rm -rf tree1                            ⇒ .git/worktrees/tree1 【仍在】（gitdir 失效）
   git worktree prune -v                  ⇒ Removing worktrees/tree1（目录整体删除）
③ git worktree add --detach tree1 <C2>   ⇒ reflog 首行 = C2，无 C1 痕迹
```

**⇒ 结论**：
```
worktree remove（V10-e 路径）  ⇒ 删 reflog
rm -rf + prune（我的路径）     ⇒ 同样删 reflog
⇒ ★ V10-e 的结论【比原文更强】：不限于 remove，prune 亦同
```

**★ 建议 V10-e 补一句**：
> 「除 `worktree remove` 外，`rm -rf <dir>` + `git worktree prune` **同样删除 reflog**
> （评审线 2026-10-06 独立实验，/tmp 隔离仓库）。
> ⇒ 纪律更强：**任何使 worktree 管理目录消失的路径**都会丢 reflog。」

---

## ④ 关于教训二十五：**同意合并入 lesson 16 族**，但有一处需要你裁定

**你的采纳**：「形态 3 ⇒ 采纳」，写入 V10-f。

**★ 但我建议明确一件事**（避免与 V10-e 重复）：
```
V10-e（已落盘）：具体机制（remove/prune 删 reflog）+ 替代证据（管理目录 mtime）
形态 3（我提的）：族视角（lesson 16 族的第 3 形态）+ 通用纠正（留独立时间戳证据）

⇒ 两者的关系：
   V10-e 是【具体条目的纪律】
   形态 3 是【族视图的分类】
⇒ ★ 建议：V10-f 写「族视图」，引用 V10-e 作为其实例 —— 不重复其内容
```

**★ 若你同意，V10-f 建议表述**：
```markdown
## V10-f — 共享资源的写入者互不可见（族视图）

本族三个形态（均为 2026-10 实证）：

| 形态 | 场景 | 后果 | 纠正 |
|---|---|---|---|
| 依赖共享 | symlink node_modules | 读到他方半成品 ⇒ 假红/假绿（R5 lesson 16） | 物理隔离（cp -r） |
| 家域共享 | 在他方主仓做 git 写操作 | 与他方写操作互斥 ⇒ 锁冲突（G4.1） | 建树前 ps aux 查活跃；从自己仓发起 |
| 证据共享 | worktree reflog 随 remove/prune 丢失（见 V10-e） | 事后审计误判「未发生过」 | ★ 关键操作留独立于 git 的证据 |

**★ 形态 3 的特殊性**：前两形态是【并发时】问题（当场出错），
形态 3 是【事后】问题（审计时出错）—— 「无法证明未发生」。

**★ 族内统一原则**：共享资源的写入者互不可见 ⇒
  · 依赖共享：写者 A 的半成品被读者 B 当成成品
  · 家域共享：写者 A 的锁被写者 B 撞上
  · 证据共享：写者 A 的痕迹被系统清除，审计者 C 误判
⇒ 共同纠正：**跨线操作前先确认共享资源的使用者**（进程 / 路径 / 证据）。
```

---

## ⑤ 二次复核范围：**确认扩大**

**你的扩大**（测试线 的新证据）：
```
f09-fix-batch.test.ts 10 条中 8 条是源码文本断言
测试线 做了 4 条注入：
  A：删派发调用（文本变化）        ⇒ 1 red ✓
  B：handler 首行早退              ⇒ 10 pass（我已发现）
  C：选区入口填槽 if(false&&)      ⇒ ★ 10 pass（新）
  D：guided 态渲染 {false&&}       ⇒ ★ 10 pass（新）
⇒ ★ 文本断言问题覆盖【3 项修复】（N-3 / □5-2 / B-2）
```

**★ 我确认这个扩大是必要的** —— 而且它**补上了我上一轮的盲区**：
```
我上一轮只做了 B-2 的「保留文本、语义失效」注入（handler 早退）
⇒ 我没对 N-3 / □5-2 做同类注入
⇒ ★ 测试线 的 C/D 揭示了【同一测试策略问题的更广覆盖】
⇒ 这本身是一个方法教训：发现一类问题后，应【扫描同类修复项】是否同病
```

**★ 我把它登记为教训二十六**（若你同意）：
```
### ★ 教训二十六：发现一类缺陷后，须扫描同类修复项

实例：F-09 修复批
  · 我发现 B-2 的测试是文本断言（注入「handler 早退」⇒ 10 pass）
  · 但我【只测了 B-2】，没测 N-3 / □5-2
  · 测试线 用同法测 C/D ⇒ 发现它们【同病】（也是 10 pass）
⇒ 教训：一类问题的发现，必须配【同类项的扫描】
  —— 否则只是「局部修复认知」，不是「模式识别」
```

**⇒ 二次复核计划（更新）**：
```
① B2-1：行为注入（打在 Config 可达路径）
   · resolveConfigGenerateAction 返回值改错 ⇒ 测试必须红
   · 静态确认 :2513 走 dispatchConfigGenerate（非直接 handleGenerateNode）
② N3-1：探针实测（三场景表）
③ ★ N-3 / □5-2 的行为断言：用测试线的注入 C/D 手法复验
   · 若 A线 补了行为断言 ⇒ 用「保留文本、语义失效」注入验证其捕获能力
④ 基线：受影响文件 + 全量一次（确认无回归）
```

---

## ⑥ A线 的修复方向（你告知的）

```
① resolveConfigGenerateAction(node) 纯函数（clone-recreate-submission.ts）
② dispatchConfigGenerate（project.tsx，两个 onGenerate 共用）
③ Config 真实入口 :2513 改调 dispatchConfigGenerate ✓
④ 通用面板 :2339 也改调 ✓
```

**★ 我预判这是正确方向**，理由：
```
· 判据单源（纯函数）⇒ 可行为断言（单元测试返回值）
· 两个 onGenerate 共用 ⇒ 防未来分叉（我上轮 §2 建议②）
· Config 真实入口（:2513）已接 ⇒ 修了 B2-1 的根因
```

**★ 二次复核时我会重点验证**：
```
· resolveConfigGenerateAction 是否【纯函数】（无副作用、可独立测试）
· dispatchConfigGenerate 是否【真的被两个入口共用】（防「只改一个」）
· 新测试是否【行为断言】而非【文本断言】（用测试线 的 C/D 手法反验）
```

---

## ⑦ 状态

- 我的报告：`b66a86a5`（第一轮）+ `a92a7204`（第二轮），均已推 fork
- 隔离树 `_f09fix` @ `f88feac7` 保留（供二次复核）
- 待你通知 A线 commit 号后开始二次复核（范围：①②③④）
