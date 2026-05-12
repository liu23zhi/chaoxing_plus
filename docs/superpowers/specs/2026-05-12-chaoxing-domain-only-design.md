# Chaoxing 官方域名收敛设计

## 目标

将当前项目的运行与表达边界统一收紧为仅支持 `*.chaoxing.com`，不再把学校镜像域名视为官方支持范围。

本次变更的重点是收敛域名边界，而不是修改学习、答题、面板、题库或日志等业务功能。

## 范围

本次设计覆盖三层收敛：

1. 扩展注入与权限范围
   - `build.mjs` 中生成的 `manifest.json`
   - `host_permissions`
   - `content_scripts.matches`

2. 项目运行边界
   - `src/projects/cx.ts` 中 `CXProject.domains`
   - 任何依赖该域名白名单判断项目是否匹配当前站点的运行逻辑

3. 仓库内测试与说明表达
   - 直接断言镜像域名支持的测试
   - 默认把镜像域名当作支持范围的文案或设计说明

## 明确保留与不做的事

### 保留

- 保留现有超星学习、作业、考试、自动阅读、浮动面板、题库配置等功能逻辑
- 保留 popup 跳转到 `https://www.chaoxing.com/` 的行为
- 保留所有基于 `chaoxing.com` 的页面匹配规则

### 不做

- 不顺手重构学习流程、答题流程或注入机制
- 不改 `tikuAdapter` 仓库
- 不因为这次域名收敛而调整无关的 UI、日志、配置结构
- 不尝试兼容学校镜像域名的替代映射逻辑

## 设计决策

### 1. Manifest 仅保留 `*.chaoxing.com`

当前 `build.mjs` 里的 `chaoxingHosts` 包含 `*.xueyinonline.com`、`*.hnsyu.net` 等多个镜像域名。

设计上将其收紧为只包含：

- `*://*.chaoxing.com/*`

这样生成后的扩展将只在 `chaoxing.com` 官方域名页面请求权限并注入内容脚本。

### 2. `CXProject.domains` 仅保留 `chaoxing.com`

当前 `src/projects/cx.ts` 的 `domains` 同时包含 `chaoxing.com` 以及多个学校镜像顶级域名。

设计上将其收紧为：

- `chaoxing.com`

这样项目内部的站点识别边界会与 manifest 注入边界保持一致，避免出现“扩展只注入官方域名，但项目定义仍声称支持镜像域名”的分裂状态。

### 3. 同步测试与说明表达

仓库里已经存在直接断言 manifest 权限和 popup 首页的测试，以及若干设计文档/计划文档中对站点范围的描述。

设计上做以下区分：

- **必须同步的内容**：会影响当前代码正确性的测试，尤其是 manifest 权限/匹配范围相关测试
- **建议同步的内容**：明确把镜像域名视为支持范围的说明文档
- **不强制同步的内容**：仅作为历史记录存在、且不影响当前行为验证的旧设计文档

也就是说，这次会优先保证“代码 + 测试 + 当前可见说明”三者一致，但不会为了历史文档整洁做大规模回写。

## 实现边界

实现应尽量小而明确：

- 修改 `build.mjs` 的 `chaoxingHosts`
- 修改 `src/projects/cx.ts` 的 `domains`
- 修改相关测试，确保只断言 `chaoxing.com` 官方域名范围
- 如存在当前仍在使用、且明显宣称支持镜像域名的说明文字，则同步改为仅表述 `chaoxing.com`

## 测试策略

至少覆盖以下验证：

1. Manifest 权限范围验证
   - `host_permissions` 只包含 `*://*.chaoxing.com/*`
   - `content_scripts.matches` 只包含 `*://*.chaoxing.com/*`

2. 项目域名边界验证
   - `CXProject.domains` 只包含 `chaoxing.com`
   - 不再包含任何镜像域名

3. 回归验证
   - popup 首页仍指向 `https://www.chaoxing.com/`
   - 现有与 `chaoxing.com` 学习路径相关的字符串测试不应被误伤

## 风险与取舍

### 风险

- 原先依赖镜像域名访问课程的用户将不再被扩展自动注入
- 如果某些测试或说明仍残留旧域名表达，可能造成仓库语义不一致

### 取舍

这是一次有意的支持范围收缩。设计上接受镜像域名不再受支持，以换取：

- 官方支持边界更明确
- manifest 与运行逻辑更一致
- 后续重构方向更清晰

## 验收标准

满足以下条件即可认为设计落地正确：

1. 生成后的 manifest 只匹配 `*.chaoxing.com`
2. `CXProject.domains` 只保留 `chaoxing.com`
3. 相关测试更新后通过
4. 仓库中当前活跃的说明表达不再暗示支持学校镜像域名
5. 现有超星官方域名上的学习与答题功能不因本次收敛而被额外改动
