# Codex History Rail

[English](README.md) | 中文

为 DeepSeek Harness Web UI 提供 Codex 风格的回合时间轴。它位于左侧栏与对话区之间的窄留白处，每个回合显示一条短横线。

## 功能

- **回合刻度**：当前会话每个回合一条短横线。
- **悬停预览**：横线局部放大，右侧卡片显示该回合的用户提示与助手回复摘要。
- **点击跳转**：点击刻度或卡片里的「跳到此处」，对话会滚动到对应回合；未加载的历史会自动向前翻页。
- **收藏**：在卡片里收藏回合；顶部星标打开跨会话收藏面板，点击收藏项可跳转，必要时自动切换会话。
- **跟随主题**：只使用宿主的 `--dsw-alias-*` 主题变量；宽度低于 1080px 时自动隐藏。

收藏保存在浏览器 `localStorage` 的 `dsh-codex-rail.favorites.v1` 中，不会上传任何宿主数据。

## 安装

可以从 DSH 插件市场安装；也可以把本目录链接进 DSH profile，然后启用 `@jaycou/codex-history-rail`：

```sh
# 在本包目录中执行
dsh plugin add .
```

本包声明了 `dsh.bundle.patch` 和 Web 客户端半部。它是纯 UI bundle，Host 半部故意为空。

## 实现方式

- 在 `conversation.session.header.utilities` 插槽注册 React 组件，并把时间轴 portal 到对话根节点的左边缘。
- 从 `turnOutline` projection 读取整个会话的大纲，从 `useChat(snapshot => snapshot.navigation.items())` 读取已加载回合。
- 跳转到未加载回合时调用 `sessions.binding(sessionId).session.loadThrough(seq)`，然后把对应的 `[data-chat-anchor-key]` 行滚入视野。
- 只使用 `--dsw-alias-*` 主题变量，不引入 DSH 客户端包。

## 开发

```sh
node --check client.js
node --check index.js
```

客户端是单个 `window.__ModuleLoader__.load(...)` 工厂；`client.js` 就是全部 UI。语言元数据在 `locale/`。
