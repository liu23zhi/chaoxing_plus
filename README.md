# Chaoxing Plus — 超星学习通浏览器扩展

> 参照 [ocsjs](https://github.com/ocsjs/ocsjs/) 思路开发的超星学习通专用 **浏览器扩展**（Manifest V3）。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 🎬 视频自动播放 | 自动播放课程视频，可设置倍速（1.0 ~ 2.0x） |
| 🔇 静音模式 | 静音播放，后台挂课 |
| ⏭️ 自动下一任务 | 当前任务完成后自动切换至下一任务点 |
| 📋 视频弹题处理 | 随机答题或直接忽略章节内弹出的小测验 |
| 📄 PPT/文档自动翻页 | 自动翻阅 PPT 和文档类任务点 |
| 📚 电子书自动翻页 | 自动翻阅书籍阅读任务点 |
| 📝 作业/考试自动答题 | 对接外部题库 API，自动填写答案（需配置题库地址） |
| ⚙️ 悬浮设置面板 | 页面内可拖拽的实时设置面板，无需打开弹出页 |
| 🔔 弹出设置页 | 点击浏览器图标可快速调整所有配置 |

---

## 🚀 安装方法

### 方式一：从源码构建（推荐开发者）

```bash
# 安装依赖
npm install

# 生成图标并构建扩展
npm run build

# 产出目录：dist/
```

然后：
1. 打开 Chrome / Edge，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择 `dist/` 目录

### 方式二：直接使用预构建包

（待发布）

---

## 🛠️ 开发指南

```bash
# 类型检查
npm run typecheck

# 监听模式构建（保存后自动重新构建）
npm run dev
```

### 项目结构

```
chaoxing_plus/
├── public/
│   ├── manifest.json          # 扩展清单 (Manifest V3)
│   └── icons/                 # 自动生成的图标
├── src/
│   ├── shared/
│   │   ├── types.ts           # 全局 TypeScript 类型
│   │   └── constants.ts       # 常量（默认配置、URL 模式等）
│   ├── background/
│   │   └── index.ts           # Background Service Worker
│   ├── content/
│   │   ├── index.ts           # 内容脚本入口（页面检测 + 初始化）
│   │   ├── cx/
│   │   │   ├── video.ts       # 视频自动化模块
│   │   │   ├── study.ts       # 课程学习自动化模块
│   │   │   └── work.ts        # 作业/考试自动答题模块
│   │   ├── panel/
│   │   │   └── panel.ts       # 页面内悬浮面板 UI
│   │   └── utils/
│   │       ├── dom.ts         # DOM 工具函数
│   │       └── logger.ts      # 日志工具
│   └── popup/
│       ├── index.html         # 弹出页 HTML
│       ├── popup.ts           # 弹出页逻辑
│       └── popup.css          # 弹出页样式
├── scripts/
│   └── generate-icons.mjs     # 图标生成脚本（纯 Node.js，无外部依赖）
├── build.mjs                  # Vite 多入口构建脚本
├── package.json
└── tsconfig.json
```

---

## ⚙️ 配置说明

所有配置均可通过：
- **浏览器弹出页**（点击工具栏图标）
- **页面内悬浮面板**（自动注入到超星页面右侧）

进行调整，配置会同步保存到 `chrome.storage.sync`。

### 题库 API 格式

自动答题功能需要外部题库支持。请求格式如下：

```
GET https://your-api.example.com/query?question=<题目文本>
```

响应格式（JSON）：

```json
{
  "code": 1,
  "data": [
    {
      "question": "题目原文",
      "answer": "答案文本"
    }
  ]
}
```

---

## 🔒 注意事项

1. **仅供学习交流使用**，请遵守学校及平台的相关规定。
2. 自动答题功能默认关闭，需手动在设置中启用并配置题库地址。
3. 建议倍速不超过 **1.5x**，部分学校课程有倍速检测，过高倍速可能导致进度重置。
4. 扩展仅在 `*.chaoxing.com` 和 `*.xueyinonline.com` 域名下运行。

---

## 📄 License

MIT

---

## 致谢

本项目参考了 [ocsjs/ocsjs](https://github.com/ocsjs/ocsjs/) 的设计思路，感谢其开源贡献。