# Codex History Rail

[English](README.md) | [中文](README.zh.md)

> 为 DeepSeek Harness 对话左侧留白处加入 Codex 风格的回合时间轴，支持悬停预览、点击跳转与收藏。

A Codex-style turn rail for the DeepSeek Harness Web UI. It sits in the narrow gutter between the sidebar and the conversation and shows one short tick per turn.

## Features

- **Turn ticks** — one short horizontal line per turn in the current session.
- **Hover preview** — the line grows and a card shows that turn's prompt and assistant response.
- **Jump to turn** — click a tick or the card's **Jump here** button; the transcript scrolls to that turn and pages history in when needed.
- **Favorites** — star a turn from the card. The top star opens a cross-session favorites panel; clicking a saved turn jumps to it, switching sessions when necessary.
- **Theme aware** — uses the host's `--dsw-alias-*` tokens and hides itself below 1080 px.

Favorites are stored in the browser's `localStorage` and are never uploaded.

## Install

Install the bundle from the DSH plugin market, or link this directory into a DSH profile and enable `@jaycou/codex-history-rail`:

```sh
# from this package directory
dsh plugin add .
```

The package declares `dsh.bundle.patch` and a Web client half. It is a UI-only bundle: the Host half is intentionally empty.

## How it works

- Registers a React component in the `conversation.session.header.utilities` slot and portals the rail into the conversation root's left edge.
- Reads the whole-session outline from the `turnOutline` projection and the loaded turns from `useChat(snapshot => snapshot.navigation.items())`.
- Jumps to unloaded turns with `sessions.binding(sessionId).session.loadThrough(seq)`, then scrolls the matching `[data-chat-anchor-key]` row into view.
- Uses only `--dsw-alias-*` theme tokens and does not import DSH client packages.

## Development

```sh
node --check client.js
node --check index.js
```

The client is a single `window.__ModuleLoader__.load(...)` factory; `client.js` is the whole UI. Locale metadata lives in `locale/`.
