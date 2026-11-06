# 搜狗输入法 IMM/TSF 诊断报告（修订版）

**日期**：2026-11-06
**修订**：2026-11-06（依据客户端二进制与 imm32 反汇编逐条核对，替换原报告的 TSF 结论）
**范围**：`CXExam.exe` 的输入法检测判据、本机输入法状态、`run-sogou-imm-diagnostic.ps1` 探针结论
**结论状态**：原报告的主要结论不成立。客户端只用 IMM32 判定；本机确实没有任何可用的 IMM 输入法，
探针输出是真阴性，不是「探针覆盖不到 TSF」。

## 一、修订后的结论

1. `CXExam.exe` 的输入法检测只走 IMM32：`GetKeyboardLayoutList` → 逐个 `ImmGetDescriptionW`，
   描述非空才算「支持的输入法」。它没有 TSF 枚举路径（详见第二节）。
2. Windows 的 `ImmGetDescriptionW` 只对 **IME 标记 HKL**（`(hkl >> 16) & 0xF000 == 0xE000`，
   即 KLID 形如 `E0xxxxxx`）返回文本，且要求 `ImmGetImeInfoEx` 成功、必要时能加载
   `IME file` 指向的模块（详见第三节）。普通键盘布局（`0x08040804`、`0x04090409`）
   恒返回 0，这是设计行为，不是探针缺陷。
3. 本机实测：`HKLM\SYSTEM\CurrentControlSet\Control\Keyboard Layouts` 下**没有任何**
   带 `IME file` 的布局项；`HKCU\Keyboard Layout\Preload` 只有 `00000409`、`00000804`，
   于是 `GetKeyboardLayoutList` 只返回 `0x04090409`、`0x08040804`，两者描述都为空。
4. 搜狗 15.9.0.2369 只注册了 TSF（`CLSID {E7EA138E-69F8-11D7-A6EA-00065B844310}` →
   `C:\Windows\System32\SogouTSF.ime`）。`SogouPY.ime` 虽然存在于 `System32` / `SysWOW64`
   且导出完整 IME32 接口，但**没有对应的 `Keyboard Layouts` 项**，所以客户端看不到它。
5. 因此本机现在的状态会让客户端报「未检测到支持的输入法」。原报告把它归因为
   「探针只查 IMM、漏掉 TSF」，方向相反：漏掉的恰恰是客户端也不看的东西。

## 二、客户端证据（`CXExam.exe`，v4.1.4.25389）

样本来源：`tests/private-clients/chaoxing-exam-v4.1.4.25389.exe` 是 **NSIS-3 安装包**
（overlay 起始处 `EF BE AD DE "NullsoftInst"`，SubType=NSIS-3，尾部带 Authenticode）。
真正的客户端是包内的 `CXExam.exe`：

- 大小 108,914,192 字节，SHA256 `9D5F785E1BCC070517BBF31F5AD2B21458A9D3B3357F63F1A4808F2EAF8CF926`，
  与 `C:\Users\Zelly\Desktop\重庆工商大学自考_考试客户端_V4.1.4.25389(2022.11.22)\CXExam.exe` 完全一致。
- PE32 / 镜像基址 `0x400000`；IG5（内置 Ghidra 通道）分析出 22,942 个函数。

判定链（静态证据）：

| 位置 | 内容 |
| --- | --- |
| `FUN_004a2780` | `GetKeyboardLayoutList(0,NULL)` → `malloc` → `GetKeyboardLayoutList(n,buf)`；逐个 HKL 调 `ImmGetDescriptionW(hkl, buf, 0x400)`；描述为空则丢弃，非空才记录（KLID 字符串、描述、HKL、是否当前布局） |
| `0x4a2bd0` | 全程序**唯一**的 `ImmGetDescriptionW` 调用点（另一处 `0x6d05dc` 是 IAT 数据引用） |
| `FUN_004a2270` | 另一条只枚举 HKL、不读描述的收集路径 |
| `FUN_004a1330` | `GetKeyboardLayoutNameW` 取当前 KLID，再 `substr(4)` 取末四位（语言，如 `0804`），与每条记录比较；对应字符串 `CInputMethodManager::ChangeInputMethodStatus`（`0x7295a8` 附近） |
| `FUN_004a0a50` | `LoadKeyboardLayoutW` + `SystemParametersInfoW(0x5A=SPI_SETDEFAULTINPUTLANG)`，并通过 `CoCreateInstance` 拿到 `ITfInputProcessorProfiles` 后调虚表 `+0x44/+0x48/+0x24/+0x28`（Enable/IsEnabled/SetDefault/Activate profile）——TSF 只用于**启用/激活**，不参与判定 |
| 导入表 | `imm32`: `ImmGetDescriptionW`、`ImmGetContext`；`user32`: `GetKeyboardLayoutList`、`GetKeyboardLayoutNameW`、`LoadKeyboardLayoutW`、`UnloadKeyboardLayout`；`ole32`: `CoCreateInstance` |
| 常量 | `CLSID_TF_InputProcessorProfiles`（文件偏移 `0x3022F0`）、`IID_ITfInputProcessorProfiles`（`0x3022E0`）；**没有** `msctf.dll` 名字符串，说明 TSF 只经 COM 访问 |

界面文案（UTF-16，位于 `.rsrc` 的 DuiLib 皮肤资源）：

- `检测是否能读取到输入法信息`（`0x32FFF4`，`check/keyboard.png` 同段）
- `输入法检测`（`0x32E19C`）
- `输入法正常`（`0x71BCE4`）
- `未检测到支持的输入法，可查看常见问题处理后重试`（`0x71BDA8`）

## 三、Windows 侧证据（`C:\Windows\SysWOW64\imm32.dll` 10.0.26100.9278）

`ImmGetDescriptionW`（x86 `0x10015b60`）反编译要点：

```c
ImmGetImeInfoEx(&info, 0, &hkl);
if (ok && ((hkl >> 16) & 0xF000) == 0xE000 && (info.flags & 2) == 0)
    copy info.szDescription;   /* 否则返回 0，缓冲区保持空 */
```

`ImmGetImeInfoEx`（`0x100032e0`）对 `0xE0` 标记的 HKL 会走
`ImmLoadLayout(...)`（按注册表 `IME file` 加载模块），失败才退回 `NtUserGetImeInfoEx`。
所以「只在注册表里写一个布局、没有可加载的 IME 模块」不足以拿到描述。

本机实测（只读，`GetKeyboardLayoutList` + `ImmGetDescriptionW`）：

```text
count=2
0x08040804 len=0 desc=<empty>     # HKCU Preload 00000804
0x04090409 len=0 desc=<empty>     # HKCU Preload 00000409
```

补充实测（用于确认判据与部署方式）：

- 另一个进程 `LoadKeyboardLayoutW("00000410")` 后，本进程 `GetKeyboardLayoutList` 立刻多出
  `0x04100410`，且加载进程退出后仍然保留 → 键盘布局列表是**会话级共享**的。
- `0x04100410` 的描述同样为 0 → 非 IME 布局无论是否加载都拿不到描述。
- `LoadKeyboardLayoutW("E0F00804")`（未注册）失败，`GetLastError=1419` → 注册表项必须是真实布局。

## 四、原报告逐条修正

| # | 原报告说法 | 核对结果 |
| --- | --- | --- |
| 1 | 「搜狗已安装且存在 TSF 组件」 | **成立**。`HKLM\SOFTWARE\WOW6432Node\SogouInput` 版本 15.9.0.2369；`CTF\TIP\{E7EA138E-…}` 的 `IconFile` 为 `SogouTSF.ime` |
| 2 | 「现有探针只查 IMM32，没有覆盖 TSF profile」 | **成立**，但这是**正确**的覆盖范围：客户端本身也只查 IMM32 |
| 3 | 「出现 `<empty>` 不能得出搜狗未就绪」 | **不成立**。`<empty>` 就是客户端的判定结果；本机 `Keyboard Layouts` 下 0 个 `IME file` 项，结论应为「没有可用 IMM 输入法」 |
| 4 | 「更准确的判断是：TSF 已安装，探针无法证明 profile 是否注册/启用」 | **不成立**。profile 注册/启用与客户端判据无关；实测 `GetKeyboardLayoutList` 里根本没有 `0xE0xx` 布局 |
| 5 | 「重启/切换无法修复，因为旧 IMM API 不会变成 TSF 枚举 API」 | 结论对，理由要改：不是 API 覆盖问题，而是 **Sogou 15.9 只注册 TSF**，`SogouPY.ime` 虽在 `System32`/`SysWOW64` 却没有布局项 |
| 6 | 「推荐修复方向：枚举 `ITfInputProcessorProfiles`，把 TSF profile 当作就绪证据」 | **方向错误**。TSF 枚举再完整也不能让 `ImmGetDescriptionW` 返回文本；就绪判据必须是「`0xE0` 标记 + 语言匹配 + 描述非空」的 HKL |
| 7 | 「`ImmGetDescriptionW` 查的是 IMM 描述，不是 TSF 注册枚举」 | **成立**，但缺少关键前提：只有 `0xE0xxxxxx` 布局才可能有描述，普通布局恒为空 |

另外两处细节更正：

- 报告里的 `ImmDescriptions=0x08040804=<empty>` / `0x04090409=<empty>` 正是
  `HKCU\Keyboard Layout\Preload` 的两项，不是「搜狗布局读取失败」。
- `IconFile` 指向的是 `SogouTSF.ime`，与 `SogouPY.ime` 是两个组件；后者才可能被 IMM 路径使用。

## 五、正确的就绪判据

对 v4.1.4.25389，就绪 = 同时满足：

1. 存在 HKL 满足 `(hkl >> 16) & 0xF000 == 0xE000`（KLID 以 `E0` 开头）；
2. 该 HKL 已加载（`GetKeyboardLayoutList` 能看到）；
3. 其 KLID 末四位与当前布局语言一致（中文环境为 `0804`）；
4. `ImmGetDescriptionW(hkl, buf, 0x400)` 返回 > 0。

`run-sogou-imm-diagnostic.ps1` 与 CI 的 `Get-ImmInputMethodProbe` 已经覆盖 1/2/4，
缺的是把 3 写进结论、以及不要用 TSF 状态兜底。就绪判断不要再看安装目录、卸载项或
TSF profile 的 `Enable` 值。

## 六、伪装输入法的可行性

结论：可行，但不能只写注册表。

最小可行组合（`tools/fake-ime/` 已实现）：

1. 一个导出完整 IME32 接口、`ImeInquire` 返回 TRUE 的模块（`cxime.ime`，x86 给客户端，
   x64 给系统；也可用现成的 `SogouPY.ime`）；
2. `HKLM\SYSTEM\CurrentControlSet\Control\Keyboard Layouts\E0F00804`，值
   `Layout File=kbdus.dll`、`Layout Text=<描述>`、`IME file=cxime.ime`；
3. `LoadKeyboardLayoutW("E0F00804", 0)` 把布局加载进会话（立刻对其它进程可见），
   并在 `HKCU\Keyboard Layout\Preload` 留一项；
4. 复核：`GetKeyboardLayoutList` 出现 `0xE0F00804` 且描述非空即成功。

不成立的捷径：

- 纯 TSF / 微软拼音 / 搜狗 TSF 模式：拿不到 `ImmGetDescriptionW`；
- 只建注册表项、`IME file` 指向不存在的文件：`ImmGetImeInfoEx` → `ImmLoadLayout` 失败；
- 把 `imm32.dll` 放到客户端目录：`imm32` 在 KnownDLLs 名单里，永远从 System32 加载。

用法与回滚见 `tools/fake-ime/README.md`；`Install-FakeInputMethod.ps1 -Verify` 可只读复核，
安装/卸载需要管理员（写 `HKLM`、`SysWOW64`、`System32`）。

## 七、本报告的验证边界

- 已做：客户端与 `imm32` 的静态反汇编（IG5，含唯一调用点与判据）、本机注册表/目录核对、
  只读探针、布局加载的会话级可见性与失败码实测、`cxime` 模块编译与导出表核对。
- 未做：提权安装 `cxime.ime` 并让真实客户端跑完整检测（当前会话不是管理员，
  `-Verify` 仍为 `IME_NOT_READY`）；真实考试客户端登录后的界面验收。
  因此第六节是「按判据设计并已在只读层面验证」，不是「已在客户端上跑通」。
