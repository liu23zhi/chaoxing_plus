# 原生浏览器联动验证记录

日期：2026-10-30。涉及 chaoxing_plus 与独立 tikuAdapter 仓库；未提交、推送或部署服务。

## 原生客户端

原生发布文件为 `windows/native-build/release/chaoxing_plus.exe`，772608 字节，SHA256：

```text
16bc42ea8a770801525c124f62ab2ceb5761a528e0e5bdd58c237c114a56cc4d
```

发布目录仅此 EXE，PE 导入表只有 Windows 系统 DLL；没有 CRX 资源或本地 CRX 默认入口。资源计数仍为 5（原考试注入资源），在线浏览器扩展不计入内嵌资源。`--capabilities` 实际验证了 `nativeHome`、`temporaryBrowserSessions`、`onlineExtensionDownload`、`accountLogin` 与 `maxBrowserSessions:8`。

以下命令退出码均为 0：

```text
node node_modules/typescript/bin/tsc --noEmit
npm run build
npm run build:windows
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File windows/native-source/build.ps1 -BuildTests
```

原生编译仍显示既有 selection、transport、cdp-server、diagnostics 测试的编译警告；本轮新模块未产生编译警告。

全量测试按 CI 的 24 个原生 EXE 环境映射运行，PowerShell 实际展开所有测试文件，没有固定写死文件数量：

```powershell
$testFiles = @(Get-ChildItem -LiteralPath scripts -Filter '*.test.mjs' -File | Sort-Object Name | Select-Object -ExpandProperty FullName)
node --test --test-concurrency=4 --test-timeout=300000 @testFiles
```

最终原始结果摘要（89 个测试文件，退出码 0）：

```text
tests 898
pass 876
fail 0
cancelled 0
skipped 22
todo 0
```

跳过项包括未开启的真实窗口探针和未提供额外 discovery 测试驱动的用例。另显式设置 `CX_TEST_NATIVE_WINDOW=1`，串行运行本轮的 adapter、home、browser-session、elevation 四个脚本，实际结果为：

```text
tests 16
pass 16
fail 0
skipped 0
```

专项覆盖 96/144/192 DPI、真实窗口图标和控件、设置输入/取消/隔离、后台请求中关闭、初始共享地址与 API key 继承、失败下载不启动浏览器、CRX 签名/ID/清单/路径/CRC/DEFLATE 限制、两个浏览器的并发独立资料目录与存储、关闭最后可见窗口后清理，以及模拟 UAC 的即时交接/取消/重试/跨轮模式及载体切换。没有请求真实 UAC 或启动真实考试客户端。

除自动生成的签名扩展夹具外，还使用用户提供的真实 6.2.0 扩展包单独运行最新原生浏览器测试驱动。Chrome 156 与 Edge 156 均返回原商店 ID `lcmeenlnjihhjcjoakekikoaldigonac`，原始成功标记为：

```text
PASS loaded-extension settings-injected two-isolated-profiles both-cleaned
```

本地文件仅用于该兼容性验证；产品首页每次通过 tikuAdapter 在线查询、下载和校验扩展。

## tikuAdapter

后端完整运行 `go build ./...`、`go vet ./...`、`go test ./... -count=1`，均退出 0。覆盖 HTTPS 元数据/官方 CDN 下载、完整 CRX 身份校验、原子缓存、损坏包、无更新、并发、取消、重启、数据库配置优先、保存失败回滚、来源切换阻止旧在途结果发布、管理员权限及公开下载。

真实官方 Edge 检查及下载取得 6.2.0，266490 字节，SHA256：

```text
c989af0182b00b1ad872fb783dbe56c1107f4c3281c64ce126b4ef7571948d30
```

Web 后台入口为 `/adapter/extension-updates`，沿用管理员导航与权限。配置持久化到数据库并动态生效，环境变量仅用于尚未保存过设置时的初始默认值。

前端命令及原始结果摘要：

```text
npm run lint -- --no-fix: No lint errors found! (exit 0)
node scripts/check-sfc.cjs: Vue SFC: 41/41 passed (exit 0)
npm run build: Build complete (exit 0，3 条包体积提示)
web/src/utils/*.test.mjs 实际展开 45 个文件:
tests 424
pass 424
fail 0
skipped 0
```

前端全量包含实际 Chromium 页面回归，使用模拟 API 验证保存、手动检查单次请求、失败保留缓存、错误脱敏及 390px 布局。临时服务器与浏览器均已关闭。

## 验证边界与清理

未部署服务端，需要将原生首页指向已部署新版接口的 tikuAdapter。账号使用本地 HTTP mock 测试，没有登录真实账号。现代 Chrome/Edge 与模拟页面结果不代表真实超星课程或 CEF75 客户端验收；真实 UAC/CEF75 尚未执行。`CGO_ENABLED=0`，未执行 Go race 检查。

自动审批以 `blocked by policy` 拒绝删除早期测试生成的 4 个日志，未提供更具体原因；这些日志保留。新版提权测试已禁用日志并断言临时工作目录无落盘。
