# Themida 加壳客户端的脱壳方法（4.3.0.4）

本文记录 `电子科技大学中山学院考试客户端-4.3.0.4\CXExam.exe`（x86，110,226,296 B，IG5 sha256
`8131252bd0f848175154cf18495003bcd1b342a2c01c7db7e8602f802166e364`）的壳体检出结果、可执行的脱壳
步骤，以及各类产物的验收口径。**本轮没有完成脱壳**：动态车道需要宿主审批与管理员权限，当前会话两者都不具备
（详见第 4 节）。下面的步骤是按 IG5 自带的 `packing.next` 建议与仓库既有约束整理的，供有权限的操作者执行。

## 1. IG5 体检结论（已验证）

`ig5_scan`（Ghidra 后端）对该样本的判定：

| 字段 | 值 |
| --- | --- |
| `packing.status` / `kind` / `score` | `packed` / `protector` / `100` |
| `identified` | `Themida/WinLicense`（`confidence: name-only`，依据节名 `.themida`） |
| `entry` | `rva=0x6E60058`，位于 `.boot`，`intact=false`（不是标准入口） |
| `unpack` | `attempted=false`，`status=not-unpacked`，`reason: This analysis detects packing; it does not unpack.` |
| 节表 | 前 7 个节**节名被清零**（`'        '`），`.themida` 5.7 MB **RWX** 且 `rawSize=0`（只有内存映像） |
| 熵（IG5 采样，前 1 MB） | `SECTION.0`（rx）=**7.985**、`SECTION.1`=7.961、`SECTION.2`=7.957、104 MB 资源体=7.407、`.boot`=7.922；`.idata`=4.573、`.rsrc`=3.749 |
| 指标（权重） | 签名节名 40、加密可执行段 35、仅内存可执行段 30、入口不在标准节 20、随机节名 20、入口不在首个代码节 15、RWX 段 10 |
| 导入表 | **44 条，每 DLL 恰好 1 条**（`kernel32!GetModuleHandleA`、`user32!CloseClipboard`、`gdi32!GetNearestPaletteIndex` …）：这是壳的桩导入，真实 API 集在运行期重建 |
| 可静态确认的依赖 | `libcef.dll`、`duilib_u.dll`、`desktopcapture.dll`、`loopbackcapture.dll`、`mediamixer.dll`、`opencv_world3415.dll`、`faster_mtcnn_ncnn_api.dll`、`dynamic_live_detect_ncnn_api.dll`、`wtsapi32.dll`、`psapi.dll` 等（只证明"会加载这些 DLL"，不证明调用哪个函数） |
| 函数恢复量 | IG5/Ghidra 全程序 **45 个函数**，其中非库函数只有 `entry`（336 B）与 `FUN_072601a8`（94 B） |

结论：静态视图只覆盖壳的引导代码；`SECTION.0`/`.boot`/资源体均为高熵密文，未执行或未仿真引导代码就拿不到明文映像。

## 2. 可执行的脱壳步骤

### 2.1 IG5 原生车道（首选，需宿主审批）

IG5 对"加载器壳"的标准路线是**在调试器里等控制流离开引导代码**，而不是静态解密：

1. `ig5_open` 打开样本（已建库，工程 `project_bcdf7124-…`），确认 `sourceHash` 与上表一致。
2. `ig5_dbg op=load` → `op=start`（`backend=x64dbg`，同一台机器，位数一致；本样本是 x86，需 32 位调试上下文）。
3. 在引导代码内对"解包后即将跳转"的位置下断：常见做法是对 `VirtualAlloc`/`VirtualProtect`/`VirtualProtectEx`
   下断（`op=bpt`，或用 `op=apitrace` 记录这些 API 的调用序列），观察返回值指向的新可执行区。
4. 断到"跳入刚写入的低熵可执行页"时，记录该页的**运行时 VA、页权限、写入来源**（`op=readmem` 取字节，
   `op=regs` 取上下文），确认它不是壳代码而是应用代码（可读字符串/导入调用模式）。
5. `op=trace record_trace=true`（可选 `record_image=true`）把这一段连同主映像可读页固化成本次证据，
   保留空洞与原始文件差异；随后把 dump 保存成新文件。
6. 对 dump 重新 `ig5_open` 做静态检查（见第 3 节验收）。

注意：`.themida` 段是 RWX 且仅内存存在，说明还叠了 VM 保护层；**"脱掉外层压缩壳"不等于"恢复 VM 字节码
或业务逻辑"**，两者必须分开验收（IG5 `references/unpacking.md` 的口径）。

### 2.2 仿真车道（仅对纯计算型桩可行）

`ig5_emulate` 是 CPU 指令级仿真，**没有导入/OS 仿真**（工具自身说明）。本样本的桩会调用 Windows API
（`GetModuleHandleA` 等）并依赖 TLS，因此只能仿真到第一次导出调用为止；除非能找到"纯内存解密循环"
单独取出，否则这条车道给不出明文映像。要用就把解密循环的入口地址与初始内存显式喂进去，并保留
"未覆盖导入"的结论。

### 2.3 外部车道（有管理员权限时的等效做法）

1. 以管理员启动客户端，让它跑到检查页（无需进入考试）；记录 pid。
2. 用 `procdump -ma <pid> <out.dmp>` 或任务管理器"创建转储文件"抓全内存；不需要附加调试器，
   因此不会被反调试直接针对（但反调试仍可能导致进程拒绝继续运行）。
3. 也可以在 `x64dbg`（x86 目标用 x32dbg）+ ScyllaHide 下断后 `Scylla` dump + 修 IAT。
4. 从 dump 的 `MINIDUMP_MODULE` 找到 `CXExam.exe` 的基址，导出映像并转成 PE（修复
   `SizeOfImage`/节表/`AddressOfEntryPoint`）；IG5 可直接 `ig5_open` 该 dump/映像做静态分析。

**权限前提**：客户端清单是 `requireAdministrator`，非管理员进程无法 `OpenProcess(PROCESS_VM_READ)`
或调试它（本轮实测 `CreateProcessW` 直接返回 `740 ERROR_ELEVATION_REQUIRED`）。

## 3. 产物验收（必须分级，不能互相替代）

| 产物 | 需要的证据 | 不能据此宣称 |
| --- | --- | --- |
| **可分析映像** | 同一目标/run/暂停身份下的区域、权限、来源、空洞、SHA | 不要求能运行；初始快照不证明后续自修改已捕获 |
| **可重新装载文件** | 真实导出文件摘要 + 独立格式/映射核对 + 入口与数据目录可解释 | 静态重开不证明可运行 |
| **受测可运行文件** | 隔离环境启动、正常退出、受测输入输出、必要副作用 | 一次启动不证明全输入域等价 |
| **VM/业务恢复** | handler/控制流/内存/环境范围 + 独立语义 + 路径覆盖 | 脱掉压缩壳后可能仍有虚拟化字节码 |

落盘与复验要求：改写只写任务产物目录，保留原样本、派生关系与两步的 SHA；不修改原保护器或系统安全设置；
复验必须针对本次产物（重新静态装载并抽查目标地址/引用），不能沿用旧报告。

## 4. 本轮为什么没脱成（实测记录）

- `ig5_dbg op=load backend=x64dbg` → **`IG5 ig5_dbg approval was rejected; operation was not dispatched.`**
  （本会话宿主审批被自动拒绝，动态车道不可用）。
- 当前 shell `elevated=False`，样本 `requireAdministrator`：即使审批通过，也无法调试高完整性进程；
  `CreateProcessW` 实测返回 `740`。
- 因此本轮结论止于第 1 节的体检与第 2、3 节的方法记录；**没有生成任何 dump/映像，也没有解包后的静态结果**。

## 5. 解包后要立刻查什么（与 4.1.4 对齐的验证清单）

对解包产物 `ig5_open` 后按顺序核对，全部命中才说明三个版本同源：

1. `ig5_search` 找 `SetWindowDisplayAffinity` 的导入与 xref；两份 4.1.4 构建里它是 2 处调用
   （`push 1` / `push 0` 包在 `cmp [hwndGlobal],0` 之后）。
2. `ig5_search`/`ig5_xrefs` 找 `SetWindowsHookExW` 调用点，确认 `idHook=0xD`（`WH_KEYBOARD_LL`）且
   `dwThreadId=0`（会话级）。
3. 找字符串 `CLIENT_SNAP_SHOT` / `GetScreenImage` / `ExamCheckUI` / `screenImg`，确认取证抓屏与窗口类
   与 4.1.4.25389 一致（消息表见 `tests/private-clients/README.md` 的"客户端自定义窗口消息"一节）。
4. 确认未加壳模块侧结论仍然成立：`desktopcapture.dll` 的 `GetDC→CreateCompatibleBitmap→BitBlt→GetDIBits`
   路径（目录内 86 个 PE 全量扫描，无任何未加壳模块导入 `SetWindowDisplayAffinity`）。

在拿到上述证据前，4.3.0.4 的"防截屏 / 键盘钩子"只能保留为未知；运行期替代证据仍是最便宜的一条：
`entry.json` 里的 `windowAffinity`（考试窗口 `hwnd=1`）与 `keyboardHookLog`。
