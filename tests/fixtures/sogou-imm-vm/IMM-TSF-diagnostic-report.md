# 搜狗输入法 IMM/TSF 诊断报告

**日期**：2026-11-06  
**范围**：本机与虚拟机上的搜狗输入法就绪探测  
**结论状态**：已确认现有探测逻辑存在兼容性缺口，不能据此判定搜狗输入法未安装或未就绪。

## 结论

本机输入法是在更早时间安装完成的，安装后已经重启；本次问题不是“安装后没有重启”，也不是简单切换输入法即可解决的问题。

本机文件和注册表证据表明搜狗输入法已经安装，并且存在 TSF 组件：

- `C:\Program Files (x86)\SogouInput\15.9.0.2369\SogouTSF.dll`
- `HKLM\Software\Microsoft\CTF\TIP` 下存在搜狗相关 TSF 注册信息
- `IconFile` 指向 `C:\Windows\system32\SogouTSF.ime`
- 搜狗卸载项和安装目录存在

现有探测器主要检查旧式 IMM32 路径：

```text
HKLM\SYSTEM\CurrentControlSet\Control\Keyboard Layouts\*.ime
GetKeyboardLayoutList
LoadKeyboardLayoutW
ImmGetDescriptionW
```

这套检查没有覆盖 TSF profile。`ImmGetDescriptionW` 查询的是 HKL 对应的 IMM 描述，不是 TSF 输入法注册枚举接口。因此出现以下结果时，不能直接得出“搜狗未就绪”：

```text
SogouLayouts=[]
ImmDescriptions=0x08040804=<empty>
ImmDescriptions=0x04090409=<empty>
```

当前更准确的判断是：**搜狗 TSF 已安装，但现有 IMM 探针无法证明 TSF profile 是否已注册、是否已启用或是否可供客户端使用。**

## 现场证据

### 虚拟机安装测试

目录：`20261106-180518`

- 安装包校验成功，SHA256 与清单一致
- Authenticode 签名有效，签名主体为 Beijing Sogou Technology Development Co., Ltd.
- 安装器退出码为 `0`
- 安装器运行期间出现过 `SGTool.exe`、`SogouExe.exe`、`SogouComMgr.exe`、`PinyinUp.exe` 等子进程
- 安装器退出后没有持续观测到子进程
- 退出后直到 180 秒，仍未发现旧式 Sogou `.ime` 键盘布局
- 该次结果为 `INSTALLER_EXITED_IMM_NOT_READY`

这次测试证明原来的等待循环会在启动器退出且退出码为 0 后继续等待到超时；它没有证明 TSF 输入法本身没有安装。

### 虚拟机已安装后的只读探测

目录：`20261106-181314`

运行参数：

```powershell
.\run-sogou-imm-diagnostic.ps1 -ProbeOnly -TimeoutSeconds 30
```

结果：

```text
SogouLayouts=[]
AllImeLayouts=[]
ImmDescriptions=0x08040804=<empty>
Result=PROBE_TIMEOUT_IMM_NOT_READY
```

这次是在已安装并手动切换输入法后进行的只读探测，仍然为空。它说明“手动切换输入法”不能修复当前探针的覆盖范围。

### 本机已安装环境

目录：`results/20261106-181555`

本机是已安装环境，运行的是 `-ProbeOnly`，不是安装器测试。记录显示：

- 搜狗版本为 `15.9.0.2369`
- 搜狗安装目录存在
- 存在 `SogouTSF.dll`
- `HKLM\Software\Microsoft\CTF\TIP` 下存在大量 TSF 注册项
- 其中出现 `IconFile REG_SZ C:\Windows\system32\SogouTSF.ime`
- 旧式 `Keyboard Layouts` 探测仍为空
- `ImmGetDescriptionW` 仍返回 `<empty>`

因此本机结果更支持“TSF 已注册、旧 IMM 探针漏检”的解释。

## 为什么重启和切换没有改变结果

重启只会重新建立 Windows 用户会话和 TSF 服务状态；它不会把 TSF profile 转换成旧式 `Keyboard Layouts` 项。切换输入法也只会尝试激活已有的语言 profile；如果探测器仍然只调用 `GetKeyboardLayoutList` 和 `ImmGetDescriptionW`，它仍可能看不到 TSF profile 的描述。

所以“已经重启”和“切换后仍为空”并不矛盾：它们都不能使旧 IMM API 变成 TSF 枚举 API。

## 推荐修复方向

生产代码应增加 TSF 检查，并把它与旧式 IMM 检查分开：

1. 初始化 `ITfInputProcessorProfiles`。
2. 对中文 `LANGID 0x0804` 调用 `EnumLanguageProfiles`。
3. 读取每个 profile 的 `CLSID`、profile GUID、语言 ID、描述和启用状态。
4. 使用 profile 描述、`IconFile` 或经过现场确认的搜狗 CLSID 识别搜狗。
5. 将可枚举且有效的 Sogou TSF profile 作为就绪证据。
6. 保留 `ImmGetDescriptionW` 作为旧式 IMM 兼容检查，不再将它作为唯一成功条件。

相关 Microsoft 文档：

- [Text Service Registration](https://learn.microsoft.com/en-us/windows/win32/tsf/text-service-registration)
- [ImmGetDescriptionW](https://learn.microsoft.com/en-us/windows/win32/api/imm/nf-imm-immgetdescriptionw)
- [ITfInputProcessorProfiles::EnumLanguageProfiles](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfinputprocessorprofiles-enumlanguageprofiles)
- [ITfInputProcessorProfiles::GetLanguageProfileDescription](https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfinputprocessorprofiles-getlanguageprofiledescription)

## 当前限制

目前粘贴的注册表输出包含完整的 CTF/TIP 路径和 `SogouTSF.ime` 的 `IconFile` 证据，但没有完整列出对应的 Sogou CLSID、语言 profile GUID 及其启用状态。因此可以确认旧探针不足以判断 TSF 就绪，但还不能仅凭这份输出确认某个具体 profile 已经处于 active 状态。

下一次验证应直接枚举 `ITfInputProcessorProfiles`，并记录每个 profile 的 CLSID、GUID、LANGID、描述和 HRESULT；不需要重新安装搜狗，也不需要再次重启或切换输入法。
