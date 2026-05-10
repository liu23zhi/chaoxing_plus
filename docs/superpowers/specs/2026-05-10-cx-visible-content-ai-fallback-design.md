# 超星可见内容兜底答题与 AI Fallback 设计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create an implementation plan after this design is approved.

**Goal:** 修正超星 `/knowledge/cards` 学习链路中“页面里有题目/内容但因 attachment/job 识别失败而被直接跳过”的问题，并在普通题库失败时通过 `tikuAdapter` 提供统一的 AI fallback 搜题能力。

**Architecture:** 保持 `chaoxing_plus` 现有超星学习主链与章节答题器不变，把新能力收敛为两个层次：一是前端在标准任务点识别失败时，基于“页面上确实存在题目 DOM”触发可见题目兜底答题；二是后端 `tikuAdapter` 新增一个独立于普通 `/adapter-service/search` 的 AI fallback 服务，统一返回标准成功/失败结构。AI 仅作为最后一级搜题来源，不参与页面完成判定。

**Tech Stack:** TypeScript、现有超星学习脚本 `src/projects/cx.ts`、现有答题器 `OCSWorker` 与题库缓存链路、Go 服务 `tikuAdapter`、统一 JSON 响应结构、Node `node:test` 源码断言测试。

---

## Scope

本次设计覆盖两个协同仓库：

1. `chaoxing_plus`
   - 修正 `/knowledge/cards` 页面中章节测试在非标准任务点场景下被误跳过的问题。
   - 收紧“页面任务点已完成，即将跳转”的触发条件，避免把“未识别到标准 job”误当成“页面已完成”。
   - 在普通题库失败时，可选调用 `tikuAdapter` 的 AI fallback 作为最后一级搜题来源。

2. `tikuAdapter`
   - 新增一个统一的 AI fallback 服务能力。
   - 对未配置 AI、上游报错、无答案、不可安全作答等情况返回稳定的标准错误结构。

本次设计**不**覆盖：

- 用 AI 参与“页面是否已完成”的判定。
- 把整条超星学习链重写成 AI-first。
- 一次性重构全部超星脚本为 `ocsjs` 同构实现。

## Problem Statement

当前 `chaoxing_plus` 的超星学习链存在一个结构性问题：

- `study()` 在未找到可执行 `job.func` 后，会直接走“页面任务点已完成，即将跳转”的收尾逻辑。
- `searchJob()` 只有在以下链路全部成立时才会生成可执行 job：
  1. iframe 中找到已知内容节点（如 `.TiMu`）
  2. frame `data` 中取到 `jobid/_jobid`
  3. `unsafeWindow.attachments` 中匹配到 attachment
  4. 分支逻辑认可当前 `workType` 可执行
- 章节测试分支目前只在 `workType === 'job'` 时进入答题。

这导致一个典型误判：

- 页面里确实已经显示题目 DOM
- 但并未形成标准 attachment/job 任务点
- 脚本没有进入答题链路
- 最终却提示“页面任务点已完成，即将跳转”

与 `ocsjs` 对照后已确认：当前项目保留了“视频 not-job 可强制学习”的兜底能力，但裁掉了“章节测试在 not-job 场景下的兜底答题”能力。

## Design

### 1. 前端学习链改为“内容检测 + 任务映射 + 执行决策”

保留现有 `study() -> searchJob() -> JobRunner` 总体结构，但把语义拆成三层：

1. **内容检测**
   - 先判断当前 iframe/card 中实际存在什么内容：
     - 章节测试 `.TiMu`
     - 阅读 `#img.imglook`
     - 计时阅读 iframe
     - PPT `.swiper-container`
     - 链接 `#hyperlink`
     - 视频 `#video,#audio`
   - 这一层不要求先成功匹配 attachment/job。

2. **任务映射**
   - 再尝试把检测到的内容映射到标准 attachment/job。
   - 把结果明确分成：
     - `standard-job`：标准任务点，可正常执行
     - `finished-job`：标准任务点，但已完成
     - `visible-nonjob`：页面有内容，但不是标准 job
     - `visible-unmapped`：页面有内容，但缺少 jobid/attachment 映射
     - `empty`：页面里没有可处理内容

3. **执行决策**
   - `standard-job`：沿用现有执行逻辑。
   - `finished-job`：保持原完成逻辑。
   - `visible-nonjob` / `visible-unmapped`：
     - 如果是章节测试且启用了可见题目兜底答题，则进入兜底答题链路。
     - 如果是其他内容类型，则本轮先只做保守提示与停留，不直接宣称已完成。
   - `empty`：才允许进入“页面任务点已完成，即将跳转”。

### 2. 新增“可见题目兜底答题”入口

章节测试是这次修复的核心场景。

设计要求：

- 当页面中检测到 `.TiMu`，但没有形成标准 `job.func` 时：
  - 不直接跳转。
  - 允许通过“页面上已可见题目 DOM”触发答题链路。
- 触发后仍然复用现有 `JobRunner.chapter(...)`、`OCSWorker`、题目解析、缓存查题、答案填写和提交逻辑。
- 不新建第二套答题器，也不让 AI 直接操作 DOM 填题。

这样可以把改动面收敛在“如何进入答题链路”，而不是“如何重写答题逻辑”。

### 3. 收紧“页面已完成”提示语义

当前收尾语义过强，把“未找到标准 job”误当成“页面已完成”。

改动后需要把收尾状态拆开：

1. **页面无可见内容，且无标准任务点**
   - 允许提示：`页面任务点已完成，即将跳转。`

2. **页面有可见内容，但当前未形成可执行任务**
   - 不允许提示“已完成”。
   - 应提示类似：
     - `检测到页面存在可处理内容，但当前未识别为标准任务点。`
     - 如果进入兜底答题，则提示正在尝试兜底处理。
     - 如果无法安全处理，则停页并提示人工处理。

3. **AI fallback 不可用或失败**
   - 也不允许回退成“已完成”。
   - 默认停页，并给出明确失败原因。

### 4. AI 仅作为最后一级搜题来源

AI 不参与页面完成判定，也不直接决定页面该不该跳转。

前端章节测试兜底链路的搜题顺序固定为：

1. 本地缓存
2. 现有普通题库 / `tikuAdapter` 普通 `/adapter-service/search`
3. `tikuAdapter` AI fallback

只有前两级失败、异常或无结果时，才触发 AI fallback。

这样做的原因：

- 维持现有普通题库优先级与成本结构。
- 把 AI 风险限制在最小范围。
- 保持与现有 `defaultAnswerWrapperHandler`、缓存链路和工作结果面板兼容。

### 5. `tikuAdapter` 提供统一 AI fallback 服务

`tikuAdapter` 不应把 AI 能力散落进各 provider，而应新增一条统一服务能力。

推荐结构：

- 独立的 AI fallback service 层
- 独立的 AI fallback controller / endpoint
- 与普通 search 解耦，但可被前端显式调用

输入统一结构：

- `question`
- `type`
- `options`
- 可选 `extraContext`

输出统一结构：

```json
{
  "success": true,
  "result": {
    "answer": "A#C",
    "source": "ai-fallback",
    "confidence": 0.82
  },
  "error": null
}
```

或失败：

```json
{
  "success": false,
  "result": null,
  "error": {
    "code": "AI_UNAVAILABLE",
    "message": "AI fallback is not configured."
  }
}
```

### 6. 明确支持“未配置 AI”的降级场景

这是本次设计里的必选场景。

`tikuAdapter` 已配置普通 search，不代表 AI 一定可用。

因此前端必须区分两类能力：

1. 普通 search 可用
2. AI fallback 可用

当 AI 未配置时：

- `chaoxing_plus` 仍然照常：
  - 进入可见题目兜底答题链路
  - 使用缓存和普通题库
- 只是跳过 AI fallback 这一步
- 若最终无答案：停页并提示人工处理
- **绝不因为 AI 未配置，就再次退化成“页面已完成并跳转”**

`tikuAdapter` 在未配置 AI 时，应稳定返回：

- `success: false`
- `error.code: AI_UNAVAILABLE`

这属于可预期降级，不属于系统故障。

## Configuration

### `chaoxing_plus` 新配置

建议在超星学习设置中新增：

1. **可见题目兜底答题**
   - 含义：检测到页面上有题目 DOM，但未识别成标准任务点时，仍尝试进入章节测试答题链路。
   - 默认值：`true`

2. **AI 兜底搜题**
   - 含义：普通缓存/普通题库失败后，允许调用 `tikuAdapter` AI fallback。
   - 默认值：`false`

3. **AI 兜底失败后行为**
   - 可选值：
     - `pause`：停留当前页并提示人工处理
     - `skip`：记录失败后允许继续后续流程
   - 默认值：`pause`

### `tikuAdapter` 新配置

建议新增：

- `enabled`
- AI provider/model 标识
- 认证信息 / token
- 请求超时
- 最大重试次数
- 是否允许返回低置信度答案
- 是否记录详细错误

当这些配置缺失时，接口应返回 `AI_UNAVAILABLE`，而不是模糊的长字符串报错。

## Failure Policy

统一失败策略如下：

1. **有题目 DOM，但无标准任务点映射**
   - 不跳转
   - 优先尝试可见题目兜底答题

2. **普通题库失败，但 AI 可用**
   - 调用 AI fallback
   - 成功则继续自动答题

3. **AI fallback 返回无答案 / 不安全 / 不可用**
   - 默认停页
   - 提示明确原因
   - 不宣称页面已完成

4. **网络或服务异常**
   - 默认停页
   - 给出可区分的错误提示
   - 不自动跳转

## Testing

### `chaoxing_plus`

测试应至少覆盖：

1. 当页面存在 `.TiMu`，但没有标准 `job` 映射时：
   - 不进入“页面任务点已完成，即将跳转”分支
   - 会进入章节测试兜底链路

2. 当页面无内容、无 job 时：
   - 仍然允许进入正常跳转收尾

3. 当 AI fallback 未配置时：
   - 普通题库仍可运行
   - 不把 `AI_UNAVAILABLE` 当成系统错误
   - 不因为 AI 不可用而误跳转

4. 当 AI fallback 返回统一错误码时：
   - 前端能区分 `NO_ANSWER`、`AI_UNAVAILABLE`、`UPSTREAM_ERROR`
   - 并执行对应停页/提示策略

### `tikuAdapter`

测试应至少覆盖：

1. AI fallback 请求输入校验
2. 未配置 AI 时返回 `AI_UNAVAILABLE`
3. 上游 AI 报错时返回 `UPSTREAM_ERROR`
4. AI 返回无答案时返回 `NO_ANSWER` 或等价标准码
5. 正常返回时结构稳定，能被前端直接消费

## Tradeoffs

### 推荐方案：前端兜底入口 + 后端统一 AI fallback

**优点：**
- 改动集中，保持现有答题器稳定
- 能修复“页面有题却误跳转”的核心问题
- AI 只承担搜题兜底，不承担页面状态判断
- `tikuAdapter` 能作为通用服务复用

**缺点：**
- 仍保留现有 `cx.ts` 的部分识别复杂度
- 阅读/PPT/链接本轮只做到保守不误跳，不全面自动兜底

### 备选方案：全链 AI 判定

不推荐。AI 直接参与“页面是否完成”的判断会放大误判风险，也会使行为难以验证。

## Success Criteria

- 页面中存在可见题目 DOM 时，不再直接提示“页面任务点已完成，即将跳转”。
- 非标准任务点的章节测试可通过兜底入口进入现有答题链路。
- 普通题库失败后，可选调用 `tikuAdapter` AI fallback。
- `tikuAdapter` 未配置 AI 时，系统可稳定降级，不误跳转、不误报系统故障。
- 前后端对 AI fallback 的成功/失败语义一致，错误可区分、可观察、可恢复。
