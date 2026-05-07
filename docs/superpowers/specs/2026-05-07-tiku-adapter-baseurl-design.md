# chaoxing_plus 题库 Adapter BaseURL 对接设计

日期：2026-05-07

## 1. 背景与目标

当前 `chaoxing_plus` 已经具备超星页面内的学习 / 答题面板，以及基于 `AnswererWrapper` 的题库请求抽象，但默认题库配置仍为空，用户需要手工提供完整的题库包装器配置，使用门槛较高。

本次变更的目标是以最小成本对接本地题库服务项目 `C:\Users\Zelly\Documents\GitHub\tikuAdapter`，让用户可以直接在现有面板中配置并使用一个默认题库服务，而不必理解底层 wrapper 结构。

本次设计只处理以下内容：

- 引入一个用于编译时设置默认题库地址的变量
- 在现有学习 / 答题面板中新增 `baseurl` 输入区、`key` 输入区和跳转按钮
- 运行时根据 `baseurl` 和 `key` 动态生成默认题库请求配置
- 使用 `POST {baseurl}/adapter-service/search` 作为默认搜索接口
- 请求头使用 `Authorization: Bearer <key>`

本次不改造 `tikuAdapter` 服务端，不新增新的后台流程，也不把用户暴露到底层 `AnswererWrapper` 的技术配置细节。

## 2. 已确认决策

1. 配置入口放在当前页面里的学习 / 答题面板中，而不是扩展 popup
2. 跳转按钮直接打开当前配置的 `baseurl`
3. 编译期变量只提供默认 URL，运行时用户配置优先
4. 默认搜索接口固定为：`POST {baseurl}/adapter-service/search`
5. 认证方式固定为：`Authorization: Bearer <key>`
6. `key` 为必填项；为空时不允许发起题库请求
7. `baseurl` 与 `key` 都需要本地持久化，刷新页面后继续保留
8. 采用方案 A：在现有面板中新增题库配置区域，并动态生成默认 `AnswererWrapper`

## 3. 设计结论

### 3.1 编译期默认 URL

新增一个专门用于题库服务地址的默认变量，例如 `DEFAULT_TIKU_BASE_URL`。该变量在构建期注入到前端代码中，只作为第一次使用或本地尚无配置时的默认值。

优先级规则固定为：

1. 用户本地已保存的 `baseurl`
2. 编译期注入的默认 `baseurl`

这意味着后续更换部署地址时，只需要修改构建变量即可；而一旦用户手动保存过自己的地址，运行时将始终尊重本地配置，不会被新的默认值覆盖。

### 3.2 面板内题库配置区

在现有学习 / 答题面板中新增一个轻量的“题库配置”区域，包含：

- `baseurl` 输入区
- `key` 输入区
- “跳转”按钮

界面职责保持简单：

- `baseurl` 输入区用于填写题库服务根地址
- `key` 输入区用于填写访问令牌
- “跳转”按钮用于直接打开当前输入的 `baseurl`

不新增复杂配置项，不暴露 `method`、`headers`、`handler` 等底层 wrapper 字段，不在这一轮支持多题库切换或自定义接口路径。

### 3.3 默认题库包装器生成

运行时不要求用户手工维护 `answererWrappers`。系统会根据当前 `baseurl` 和 `key` 动态生成一个默认的 `AnswererWrapper`，并将其接入现有答题流程。

生成规则固定为：

- `url`：`{normalizedBaseUrl}/adapter-service/search`
- `method`：`post`
- `contentType`：按现有答题链可消费的 JSON 响应处理
- `type`：沿用现有项目默认请求方式
- `headers`：包含 `Authorization: Bearer <key>`
- `name` / `homepage`：使用清晰的人类可读标识，便于在结果面板中展示来源

这样做的好处是：现有 `commonWork`、`defaultAnswerWrapperHandler`、结果展示与题库缓存逻辑都可以继续复用，不需要另外发明一套题库请求协议。

## 4. 组件与文件边界

### 4.1 修改文件

- `build.mjs`
  - 注入默认题库 `baseurl` 变量
- `src/projects/common.ts`
  - 在现有面板中新增题库配置区域
  - 读取和保存 `baseurl` / `key`
  - 将默认题库配置接入现有工作选项或答题配置流程
- `src/projects/cx.ts` 或当前实际消费 `answererWrappers` 的接线位置
  - 使用动态生成的默认题库 wrapper 参与答题流程

### 4.2 新增文件

- 建议新增一个小型 helper，例如：`src/projects/tiku-adapter-config.ts`
  - 负责 `baseurl` 规范化
  - 负责校验题库配置是否可用
  - 负责拼接 `/adapter-service/search`
  - 负责生成默认 `AnswererWrapper`

该 helper 应保持纯函数化，便于直接用 `node:test` 做最小回归测试。

## 5. 数据流与行为

1. 页面初始化时读取本地保存的 `baseurl` 和 `key`
2. 如果本地没有 `baseurl`，则回退到编译期注入的默认值
3. 面板显示当前 `baseurl` 与 `key` 输入区
4. 用户修改输入后，配置保存到本地持久化存储
5. 用户点击“跳转”按钮时：
   - 读取当前输入框中的 `baseurl`
   - 进行轻量校验与规范化
   - 直接在新窗口 / 新标签页中打开该地址
6. 自动答题流程需要题库时：
   - 先检查 `baseurl` 是否可用
   - 再检查 `key` 是否非空
   - 如果任一条件不满足，则不发起请求，并给出明确提示
   - 如果配置完整，则动态生成默认 `AnswererWrapper`
   - 向 `POST {baseurl}/adapter-service/search` 发起请求，并附带 `Authorization: Bearer <key>`
7. 题库返回结果后，继续走当前项目已有的答题解析、展示和缓存链路

## 6. 错误处理与兼容策略

- `key` 为空：阻断题库请求，并提示用户先填写 key
- `baseurl` 为空或非法：阻断跳转和请求，并提示用户先填写正确的 URL
- `baseurl` 末尾多余斜杠：在拼接接口路径前进行规范化，避免出现双斜杠
- 远端接口无结果或返回异常：继续沿用现有答题结果展示逻辑，只保证默认 wrapper 的请求和解析边界清晰
- 跳转按钮不依赖 key：即使尚未填写 key，只要 `baseurl` 合法，仍可打开目标地址

## 7. 测试与验证

本次以最小验证为主：

1. 为题库配置 helper 增加纯函数测试，覆盖：
   - `baseurl` 规范化
   - 搜索接口 URL 拼接
   - `Authorization: Bearer <key>` 请求头生成
   - `key` 为空时配置不可用
2. 增加源码接线测试，确认面板中存在：
   - `baseurl` 输入区
   - `key` 输入区
   - 跳转按钮
   - 默认 URL 变量接入点
3. 运行 `npm run typecheck`
4. 运行 `npm run build`
5. 手动验证：
   - 刷新页面后 `baseurl` / `key` 仍然保留
   - 点击跳转按钮能打开当前 `baseurl`
   - `key` 为空时自动答题会被阻断并提示
   - 配置完整时题库请求能按默认接口发出

## 8. 范围外事项

以下内容不在本次范围内：

- 支持多个题库服务切换
- 支持自定义搜索路径或请求方法
- 支持用户手工编辑完整 `AnswererWrapper`
- 在面板中新增“连接测试”功能
- 改造 `tikuAdapter` 服务端接口或认证机制
- 新增 popup 中的题库配置入口
