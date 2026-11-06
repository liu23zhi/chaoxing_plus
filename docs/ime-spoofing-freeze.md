# 输入法伪装（legacy IMM）冻结记录

- 日期：2026-11-06
- 状态：**冻结**（不再开发、不再安装、不再由 CI 验证）
- 结论：仓库删除语言包与伪装输入法安装包；`CXExam.exe` 的输入法检测不再尝试绕过。

## 1. 背景

考试客户端会检查系统里是否存在"受支持的输入法"，不满足时弹出"未检测到支持的输入法"。
曾经的目标是：自己写一个最小 IME32 模块，注册成 `E0xxxxxx` 布局，让客户端读到非空描述，从而通过检测。

## 2. 已证实的事实（保留证据，避免重走弯路）

客户端侧（IG5 v4.1.4.25389）：

1. 判据是 `GetKeyboardLayoutList` → `ImmGetDescriptionW`，**只看描述是否非空**；
   调用点 `FUN_004a2780`（唯一调用 `ImmGetDescriptionW` 的位置）。
2. 语言比较在 `FUN_004a1330`：取 `GetKeyboardLayoutNameW` 的末四位与当前布局比较。
3. TSF profile、安装目录、卸载表项都**不是**证据；客户端完全不看 TSF。

系统侧（`SysWOW64\imm32.dll` 10.0.26100）：

4. `ImmGetDescriptionW` 需要 `ImmGetImeInfoEx` 成功、KLID 为 `E0xxxxxx`、且 `(flags & 2) == 0`；
   纯键盘布局永远返回 0。
5. 最小可行模块必须导出全部 16 个 IME32 入口，并带 `VERSIONINFO`：
   缺版本资源时 `LoadKeyboardLayoutW` 返回 `1813 ERROR_RESOURCE_TYPE_NOT_FOUND`。
6. 手写 `Keyboard Layouts` 键不足以让布局进会话：
   - `ImmInstallIMEW` 在英文镜像上返回 `NULL` 且 `GetLastError() = 0`；
   - 手写 `E0F0xxxx` 后 `LoadKeyboardLayoutW` 返回 `1419 ERROR_HOTKEY_NOT_REGISTERED`；
   - 先用 `KLF_ACTIVATE` 载入 `00000804` 基础布局也不能绕过。

根因：

7. legacy IMM 依赖"东亚语言支持"，而语言包带来的系统区域设置（ACP=936）与语言组**在启动时生效**。
   语言包刚装完、尚未重启的会话里，IME 子系统仍然不可用。
8. GitHub hosted runner 是"一 job 一台一次性 VM"，job 中途重启即失败，没有"重启后继续"的机制。
9. 语言包本身约 222 MB，不适合长期入库；用 Git LFS 时未拉 LFS 的 job 只能看到 134 字节指针。

## 3. 为什么冻结

- CI 无法真实验证：需要"已装 zh-CN 且已重启"的机器，hosted 镜像给不了；
- 在真实用户机上，这属于改动系统输入法配置，收益低、回滚成本高；
- 语言包的体积与 LFS 依赖拖累所有 job（检出、单元测试、真实客户端）。

## 4. 本次变更：语言包删除，工具封存

| 内容 | 说明 |
| --- | --- |
| `tools/fake-ime/` | **封存保留**（不删除）：`cxime.c` / `cxime.def` / `cxime.rc`、`build-cxime.ps1`、`Install-FakeInputMethod.ps1`、`Probe-ImeLoad.ps1`、README，新增 `SEALED.md` 说明归档 |
| `tools/fake-ime/langpack/` | **删除**：`WinSrv2025-zhCN-LanguagePack.zip`（约 222 MB）及其 LFS 规则 |
| `.gitattributes` 的 LFS 规则 | `tools/fake-ime/langpack/*.zip filter=lfs …` |
| `.github/workflows/ci.yml` | `windows-fake-ime` job、真实客户端 job 的模块下载步骤、汇总表里的对应行与 `needs` 项 |
| `prepare-windows-real-client-environment.ps1` | 模块编译与安装调用（改为固定状态 `stand-in-frozen`） |

## 5. 封存与保留的内容

- `tools/fake-ime/` 整包作为归档保留，入口文件顶部与 `SEALED.md` 都标注"已封存"，任何 CI job、准备脚本、测试都不得调用；
- 桌面准备里的**只读**探针：`Get-ImmInputMethodProbe` / `Test-ImmInputMethodReady`，
  只读取 `GetKeyboardLayoutList` 与 `ImmGetDescriptionW` 并写进报告，用于解释"客户端为何提示没有输入法"。
  它不写注册表、不复制模块、不安装任何东西。
- 历史诊断：`tests/fixtures/sogou-imm-vm/IMM-TSF-diagnostic-report.md`（客户端与 imm32 的静态证据）。

## 6. 如果将来要复活

前提条件（缺一不可）：

1. 一台**已安装 zh-CN 语言支持并已重启**的 Windows（自托管 runner 或本机管理员会话）；
2. 明确接受"会修改系统 `Keyboard Layouts` 与 `SysWOW64/System32` 模块"的副作用。

步骤：

1. 归档就在 `tools/fake-ime/`（先确认 `SEALED.md` 并取得授权）；
2. 重新编译模块（需要 MSVC + Windows SDK，产物不要入库）；
3. 安装布局并**只**以 `ImmGetDescriptionW` 是否返回非空描述作为验收标准；
4. 不要在 CI 里安装语言包：改为使用系统自带的语言支持，或指向自托管 runner；
5. 具体实现细节见本文第 2 节的事实清单，不要重复已验证失败的写法。

## 7. 相关提交

```
git log --oneline --grep 伪装输入法
git log --oneline --grep 冻结
```
