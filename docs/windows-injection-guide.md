# Windows 注入操作手册

面向实际使用：先选通道，再按步骤执行，最后按症状对照排查。所有命令都在仓库根目录执行。

## 0. 先看这台客户端支持什么

```powershell
.\build-windows\bin\chaoxing_plus.exe --probe-all --no-disk-write --quiet
```

输出示例（本机实测）：

```
probe-all: candidates=2
probe: client=...\超星考试客户端_V4.3.0.4\CXExam.exe
probe: machine=x86 version=4.3.0.4
probe: libcef=92MB port=yes pipe=yes
probe: winmm=absent marker=absent
probe: suggested=cdp-port
```

判读：

- `port=yes` → 可以用 `cdp-port`；
- `pipe=yes` → 可以用 `cdp-pipe`；
- `marker=present` → 代理已安装，可以用 `dll-proxy` 或 `--attach`。

单独探测一台：

```powershell
.\build-windows\bin\chaoxing_plus.exe --probe-client "C:\...\CXExam.exe"
```

## 1. 通道 A：宿主启动客户端（端口）

```powershell
.\build-windows\bin\chaoxing_plus.exe --client "C:\...\CXExam.exe" --panel-all-pages
```

- 默认（不传 `--inject-mode`）就是这条通道；
- 出现 UAC 弹窗是正常的：客户端自身要求管理员权限；
- 登录后非考试页默认不显示面板，加 `--panel-all-pages` 可以在任何页面看到面板（用于确认注入是否生效）。

## 2. 通道 B：宿主启动客户端（winmm 代理追加开关）

适用：客户端会忽略外部命令行参数，或需要验证代理链路。

```powershell
# 2.1 构建代理（只需一次，产物在 build-windows\hook\winmm.dll）
powershell -ExecutionPolicy Bypass -File windows\hook-source\build-proxy.ps1

# 2.2 安装到客户端目录（写 winmm.dll + 标记 + 端口文件）
.\build-windows\bin\chaoxing_plus.exe --install-proxy `
  --proxy-source ".\build-windows\hook\winmm.dll" `
  --proxy-port 9222 `
  --client "C:\...\CXExam.exe"

# 2.3 用代理通道启动
.\build-windows\bin\chaoxing_plus.exe --inject-mode dll-proxy --client "C:\...\CXExam.exe" --panel-all-pages

# 2.4 还原（只删我们装的文件）
.\build-windows\bin\chaoxing_plus.exe --uninstall-proxy --client "C:\...\CXExam.exe"
```

验证代理是否生效：`%TEMP%\cxhook-<pid>.log` 里应出现 `winmm proxy loaded | ...\CXExam.exe`（每个 CEF 进程一条）。

## 3. 通道 C：客户端被考试系统拉起

宿主拿不到启动时机时，用固定端口 + attach：

```powershell
# 3.1 安装代理并写入固定端口（同 2.2，端口记在 cxhook-port.txt）
# 3.2 由考试系统/启动器正常启动客户端（不要用宿主启动）
# 3.3 宿主接管已打开的端点
.\build-windows\bin\chaoxing_plus.exe --attach 9222 --client "C:\...\CXExam.exe" --panel-all-pages
```

- `--attach` 不做归属校验（报告里 `ownershipVerified=false` 是预期值）；
- 端点没打开时先看 `cxhook-port.txt` 是否还在客户端目录、`%TEMP%\cxhook-*.log` 是否存在。

## 4. 通道 D：管道（cdp-pipe）

```powershell
.\build-windows\bin\chaoxing_plus.exe --inject-mode cdp-pipe --client "C:\...\CXExam.exe" --panel-all-pages
```

链路：`--remote-debugging-pipe` 启动 → `Target.getTargets` → `Target.attachToTarget` → 三次 `Runtime.evaluate`（配置、bootstrap、bundle）。

诊断命令（不需要真实客户端）：

```powershell
.\build-windows\bin\chaoxing_plus.exe --pipe-test
.\build-windows\bin\chaoxing_plus.exe --pipe-client ".\build-windows\bin\cdp-echo.exe"
.\build-windows\bin\chaoxing_plus.exe --pipe-call ".\build-windows\bin\cdp-echo.exe" --pipe-expr "document.title.length"
```

## 5. 症状对照表

| 现象 | 可能原因 | 处置 |
| --- | --- | --- |
| 启动即 `elevation-requested`，随后无后续 | 客户端要求管理员，UAC 被拒 | 用管理员 PowerShell 运行宿主 |
| `client-already-running` | 已有同名 `CXExam.exe` 在运行 | 关闭已有客户端再试 |
| `endpoint-unavailable` | 客户端没接受调试开关 | 换 `dll-proxy` 或 `cdp-pipe`；先用 `--probe-all` 确认 `port/pipe` |
| `inject-proxy-missing` | 客户端目录没有我们的 `winmm.dll` | 跑 `--install-proxy` |
| 面板一直不出现 | 当前页面不是考试页 | 加 `--panel-all-pages` 观察；登录后再看考试页 |
| `%TEMP%` 无 `cxhook-*.log` | 代理未被加载 | 确认 DLL 名是 `winmm.dll`、客户端确实导入了 winmm |
| `pipe-call: ... failed` | 对端不支持管道 CDP | 该客户端只能用 `cdp-port` |

## 6. 报告字段（排障时先看这个）

`--report report.json` 生成，关键字段：

| 字段 | 含义 |
| --- | --- |
| `mode` | `launch` 或 `attach` |
| `injectMode` | 实际使用的注入通道 |
| `commandLineInjected` | 是否由代理在进程内追加了调试开关 |
| `ownershipVerified` | 端点归属是否校验通过（`attach` 恒为 false） |
| `totals.pageSessions` / `bootstraps` / `bundles` | 会话与注入阶段计数 |
| `stopReason` | 结束原因（`duration` 表示正常到时退出） |

## 7. 未完成/未验证

- `input`（键鼠兜底）未实现；
- `dll-proxy` 与 `cdp-pipe` 尚未在真实 CEF 75 客户端上人工验收（需要管理员权限 + 登录）；
- 河南应用技术职业学院客户端目录当前不在本机，未纳入探测表。
