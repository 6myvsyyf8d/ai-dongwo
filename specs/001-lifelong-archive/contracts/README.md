# Contracts: AI懂我 - 模块间接口契约

**Feature**: 001-lifelong-archive
**Date**: 2026-07-25

本目录定义 AI懂我 v1.x 各 JavaScript 模块之间的接口契约。由于本项目是纯前端单页应用（无框架），模块间通过全局对象和函数调用通信。接口契约确保模块解耦，每个模块可独立开发和测试。

## 契约文件

| 文件 | 说明 |
|------|------|
| [storage-interface.md](./storage-interface.md) | 数据存储层接口（storage.js 暴露的 API） |
| [state-interface.md](./state-interface.md) | 全局状态管理接口（AppState） |
| [permissions-interface.md](./permissions-interface.md) | 权限检查接口（permissions.js 暴露的 API） |
| [quickcard-interface.md](./quickcard-interface.md) | 速读卡生成接口 |

## 约定

- 所有模块通过 `window` 全局对象暴露接口（命名空间隔离）
- 函数命名使用 camelCase，事件使用 on + 动名词
- 回调函数模式（非 Promise），保持与无 async/await 环境兼容
- 每个模块文件 < 300 行
