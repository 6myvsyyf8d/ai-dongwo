# AI Chat Phase 1：基础修复与流式化

**日期**：2026-08-02
**范围**：照护者 chatbot（chatbot.js）+ 心青年 chat（youth-chat.js）+ 服务端两处 function
**前置依赖**：无
**后续阶段**：Phase 2（prompt + 分类质量）、Phase 3（历史持久化 + 移动端）

## 1. 目标

修复已知 bug、清理死代码、引入真正的流式渲染与 markdown 渲染，为 Phase 2/3 打基础。

**成功标准**：
- `handleQuickButton` 格式 bug 修复，快捷按钮触发 AI 回复正常
- 照护者 chatbot 与心青年 chat 的 AI 回复均为流式逐 token 渲染
- AI 回复支持 markdown 渲染（粗体/列表/代码/链接等）
- legacy 死代码全部删除（约 200 行）
- AI 调用失败/流式中断/断网有明确的错误 UI 与重试入口
- 家长/老师/照护者/心青年四角色各跑通一轮主流程

**非目标（Phase 1 不做）**：
- prompt 增强（档案上下文注入）—— Phase 2
- 分类准确性优化 —— Phase 2
- 模型可配置 —— Phase 2
- 对话历史持久化（照护者侧）—— Phase 3
- 会话恢复、导出 —— Phase 3
- 移动端双栏适配优化 —— Phase 3

## 2. 架构概览

改动覆盖 4 层：

| 层 | 文件 | 改动 |
|---|---|---|
| 服务端 | `netlify/functions/chatbot.js`、`api/chat.js` | 新增 SSE 流式 action，透传智谱 stream |
| 客户端 API | `js/zhipu-client.js` | 新增 `generateReplyStream`，复用已有 `_readStream` |
| 客户端 UI | `js/chatbot.js`、`js/youth-chat.js` | 流式 bubble + markdown 渲染 + bug 修复 + 死代码清理 |
| 依赖 | `index.html`、`js/lib/` | 引入 marked.js + DOMPurify |

## 3. Bug 修复：handleQuickButton 格式

**位置**：`js/chatbot.js` L594

**问题**：`handleQuickButton` 直接传 `state.messages`（`{role:'ai'/'user', text, time}`）给 `ZhipuClient.generateReply`，未转成智谱要求的 `{role:'assistant'/'user', content}` 格式，导致 API 拒绝。`handleUserInput`（L524-529）已有相同转换逻辑，但未复用。

**方案**：抽取公共 helper：

```js
function _toApiMessages(messages) {
  return messages.map(function (msg) {
    return {
      role: msg.role === 'ai' ? 'assistant' : msg.role,
      content: msg.text
    };
  });
}
```

`handleUserInput` 与 `handleQuickButton` 均改为调用 `_toApiMessages(state.messages)`。

## 4. 流式渲染

### 4.1 服务端

**`netlify/functions/chatbot.js`** 新增 `action: 'generateReplyStream'`：

- 入参与 `generateReply` 一致（`messages`、`youthName`）
- 响应头：`Content-Type: text/event-stream`、`Cache-Control: no-cache`、`Connection: keep-alive`，保留 CORS
- 调用智谱 `stream: true`，读取 SSE chunk
- 逐个 `res.write('data: ' + JSON.stringify({ token: <delta> }) + '\n\n')` 转发
- 结束时 `res.write('data: [DONE]\n\n')` + `res.end()`
- 错误时 `res.write('data: ' + JSON.stringify({ error: <msg> }) + '\n\n')` + `res.end()`
- `systemPrompt` 与现有 `generateReply` 保持一致（Phase 2 再优化）

**`api/chat.js`**（心青年）改造为流式：

- 请求 body 增加 `stream` 字段（boolean）
- `stream: true` 走 SSE 模式（同上转发逻辑）
- `stream` 未传或为 false 走原 await 模式（向后兼容）
- **危险信号检测在流式前拦截**：命中 `DANGER_PATTERNS` 时直接返回非流式安全回复（带 `safetyAlert: true`），不走流式
- System Prompt 与现有保持一致

### 4.2 客户端 zhipu-client.js

新增 `generateReplyStream(history, youthName, onToken)`：

- POST 到代理，body `{action:'generateReplyStream', messages: history, youthName}`
- 用 `fetch` + `response.body.getReader()` 读取 SSE（复用已有 `_readStream` 逻辑，但需适配新数据格式：解析 `{token}` 而非智谱原生 delta）
- 每个 token 调 `onToken(token, fullText)`
- 返回 Promise，resolve 为完整文本
- 代理失败时降级到直连智谱 stream（`_generateReplyDirect` 的流式版本，调用 `chat(messages, {stream:true, onToken})`）

### 4.3 客户端 chatbot.js

**新增 `addStreamingAIMessage()`**：

```js
function addStreamingAIMessage() {
  var chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return null;
  var bubble = document.createElement('div');
  bubble.className = 'chat-bubble chat-bubble-bot chat-bubble-streaming';
  chatMessages.appendChild(bubble);
  scrollToBottom();
  return {
    bubbleEl: bubble,
    append: function (text) {
      bubble._rawText = (bubble._rawText || '') + text;
      // 流式过程中显示纯文本（转义 + 换行），避免未闭合 markdown 渲染错乱
      bubble.innerHTML = escapeHtml(bubble._rawText).replace(/\n/g, '<br>');
      scrollToBottom();
    },
    finalize: function () {
      var text = bubble._rawText || '';
      bubble.classList.remove('chat-bubble-streaming');
      bubble.innerHTML = window.ChatMarkdown.render(text) +
        '<div style="font-size:0.68rem;opacity:0.5;margin-top:4px;text-align:right;">' + formatTime() + '</div>';
      scrollToBottom();
      state.messages.push({ role: 'ai', text: text, time: new Date().toISOString() });
    }
  };
}
```

**`handleUserInput` 改造**：

1. addUserMessage + 分类（不变）
2. `showTyping()`
3. 若 `ZhipuClient.isAvailable()`：
   - 调 `generateReplyStream(_toApiMessages(state.messages), youthName, onToken)`
   - `onToken` 首次调用时：`hideTyping()` + `streaming = addStreamingAIMessage()`
   - 后续 token：`streaming.append(token)`
   - 完成：`streaming.finalize()`，`state.totalRounds++`，检查 maxRounds
   - catch：`hideTyping()` + 错误气泡 + 重试
4. 否则：错误气泡（不再降级到模板提问，Phase 2 重做 prompt）

**`handleQuickButton` 改造**：同上，调用 `generateReplyStream`。

### 4.4 客户端 youth-chat.js

**`_callAI` 改为 `_callAIStream(text, onToken)`**：

- POST 到 `/api/chat`，body `{messages, youthProfile, stream: true}`
- 用 reader 读取 SSE，逐 token 调 `onToken`
- 返回 Promise，resolve 为完整文本

**`sendMessage` 改造**：

1. 推入 user 消息 + 保存 + 渲染
2. 创建 streaming bubble（替换原 typing bubble）
3. 调 `_callAIStream(text, onToken)`
4. `onToken`：`bubble.append(token)`
5. 完成：`bubble.finalize()`（markdown 渲染）+ 推入 state.messages + 保存 + 提取 findings
6. catch：**不调用 finalize**（不把不完整回复推入 state.messages），保留 bubble 已显示的部分文本，末尾追加 `<span class="stream-interrupted">回复中断</span> <button class="retry-btn">重试</button>`，重试按钮点击后重新发起 `_callAIStream` 并替换当前 bubble
7. finally：`state.isAiCalling = false`、`sendBtn.disabled = false`

## 5. Markdown 渲染

### 5.1 依赖引入

- 下载 `marked.min.js`（~20KB gzipped）到 `js/lib/marked.min.js`
- 下载 `purify.min.js`（DOMPurify）到 `js/lib/purify.min.js`
- `index.html` 在 `zhipu-client.js` 之前引入这两个脚本

### 5.2 公共工具

新增 `js/chat-markdown.js`（或挂在 utils.js，视复杂度）：

```js
window.ChatMarkdown = {
  render: function (text) {
    if (!window.marked || !window.DOMPurify) {
      // 降级：纯文本 + 换行
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML.replace(/\n/g, '<br>');
    }
    var html = window.marked.parse(text, { breaks: true });
    return window.DOMPurify.sanitize(html);
  }
};
```

### 5.3 渲染应用点

- `chatbot.js`：`addAIMessage`（非流式场景，如开场白）、`addStreamingAIMessage().finalize()`
- `youth-chat.js`：`_renderMessages` 中 AI 消息渲染、streaming bubble 的 finalize
- **用户消息保持纯文本**（`escapeHtml`），只对 AI 消息做 markdown

## 6. Legacy 死代码清理

删除 `js/chatbot.js` 中以下代码（约 200 行）：

| 行号 | 内容 |
|---|---|
| L30-37 | `SUGGESTIONS` 数组 |
| L264-294 | `renderLegacyLayout` |
| L345-384 | `bindLegacyEvents` |
| L614-631 | `handleLegacySend` |
| L633 | `_pendingClassification` 变量 |
| L635-669 | `processLegacyMessage` |
| L671-680 | `handleLegacyKeywordFallback` |
| L682-714 | `classifyText` |
| L716-728 | `handleLegacyConfirm` |
| L730-761 | `saveLegacyRecord` |
| L211-213 | `initEngine` 中 `renderLegacyLayout` 分支，改为直接 `renderEnhancedLayout` |

**依据**：`grep` 确认 legacy 函数仅 chatbot.js 内部引用；`hasClassifier` 实际恒为 true（`ChatbotProviders`/`ChatbotTemplates`/`ChatbotClassifier` 作为 fallback 始终存在）。

## 7. 错误处理

### 7.1 AI 调用失败（非流式场景，如开场白后追问）

- 在 AI bubble 位置显示错误气泡（`.chat-bubble-error`，红底）
- 错误气泡内含"重试"按钮，点击重试上次请求
- **不自动重试**（避免成本失控）

### 7.2 流式中断

- 保留已收到的部分文本（不推入 state.messages，避免持久化不完整回复）
- bubble 末尾追加 `<span class="stream-interrupted">回复中断</span> <button class="retry-btn">重试</button>`
- 重试时重新发起完整请求（不续传，简化实现），替换当前 bubble 内容

### 7.3 网络断开

- `!navigator.onLine` 时禁用输入框 + 发送按钮
- 显示提示"网络已断开，请检查连接"
- `online` 事件恢复输入

### 7.4 降级策略

- 代理失败 → 直连智谱 stream
- 直连失败 → 错误气泡 + 重试
- **不再降级到模板提问**（模板提问体验差，Phase 2 会重做 prompt）
- 心青年侧 `_generateAIReply`（本地关键词回复）保留作为最后兜底（已有逻辑，不动）

### 7.5 流式中断文案

统一使用"回复中断" + 独立"重试"按钮（见 7.2）。

## 8. 测试验证

### 8.1 照护者 chatbot

- 发消息 → 流式回复逐 token 显示 → 完成后 markdown 渲染
- 快捷按钮触发 → AI 回复正常（验证 bug 修复）
- 归类面板实时更新 → 确认保存 → 记录入库
- AI 回复含 markdown（如 `**粗体**`、`- 列表`）→ 正确渲染
- 微信式语音/文字切换：点 🎤 切语音 → 按住说话 → 松开转文字发送 → AI 流式回复
- 上滑取消：按住后上滑 → 显示"松开手指，取消发送" → 松开后不发送
- 不支持语音的浏览器：切换钮隐藏，仅文字模式

### 8.2 心青年 chat

- 发消息 → 流式回复 → markdown 渲染
- 任务卡片正常显示与完成
- 危险信号检测仍生效（"不想活"等 → 安全回复）
- 每日额度超限 → 降级提示
- 微信式语音/文字切换：同照护者，按钮更大（56px）

### 8.3 错误场景

- 断网 → 输入禁用 + 提示
- API 502 → 错误气泡 + 重试
- 流式中断（手动断开网络）→ 部分文本 + "回复中断，点击重试"

### 8.4 角色覆盖

- 家长、老师、照护者各跑一轮照护者 chatbot
- 心青年跑一轮 youth-chat

## 9. UI 设计约束（全局统一）

实施阶段使用 `trae-remote-official:frontend-design` 插件辅助，所有 chat UI 改动必须遵循项目既有暗色主题 + Linear/Modern 设计系统（见 user_rules 的 design-system）。

### 9.1 设计 Token（与现有全局主题一致）

| Token | 值 | 用途 |
|---|---|---|
| 背景基色 | `#050506` | chat 页面背景 |
| 背景提升 | `#0a0a0c` / `#0d0d22` | 气泡、面板背景 |
| 主色 | `#5E6AD2` | 发送按钮、AI 强调、focus ring |
| 主色高亮 | `#6872D9` | 发送按钮 hover |
| 主色辉光 | `rgba(94,106,210,0.3)` | streaming bubble 微光、按钮 glow |
| 前景色 | `#EDEDEF` | AI 气泡文字 |
| 次要前景 | `#8A8F98` | 时间戳、占位符 |
| 边框默认 | `rgba(255,255,255,0.06)` | 气泡/面板 hairline 边框 |
| 边框 hover | `rgba(255,255,255,0.10)` | 输入框聚焦/hover |
| 错误色 | `rgba(255,60,60,0.12)` 背景 + `#ff6b6b` 文字 | 错误气泡、流式中断标记 |

### 9.2 气泡样式

**AI 气泡**（`chat-bubble-bot`）：
- 背景：`bg-gradient-to-b from-white/[0.08] to-white/[0.02]`
- 边框：`border border-white/[0.06]`
- 圆角：`rounded-2xl`（16px）
- 阴影：`shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_2px_20px_rgba(0,0,0,0.4)]`
- 文字：`#EDEDEF`
- 内边距：`12px 16px`

**用户气泡**（`chat-bubble-user`）：
- 背景：`#5E6AD2`（主色实色）
- 阴影：`shadow-[0_0_0_1px_rgba(94,106,210,0.5),0_4px_12px_rgba(94,106,210,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)]`（含 accent glow + inner highlight）
- 文字：`#fff`
- 圆角：`rounded-2xl`

**Streaming 气泡**（`chat-bubble-streaming`）：
- 在 AI 气泡基础上追加微妙 accent glow：`shadow-[0_0_0_1px_rgba(94,106,210,0.2),0_2px_20px_rgba(0,0,0,0.4),0_0_30px_rgba(94,106,210,0.15)]`
- 流式过程中可加微弱呼吸动画（200-300ms ease-out，不 bouncy）

**错误气泡**（`chat-bubble-error`）：
- 背景：`rgba(255,60,60,0.12)` 暗红底
- 边框：`border border-[rgba(255,60,60,0.3)]`
- 文字：`#ff6b6b`
- 内含"重试"按钮（次级按钮样式）

### 9.3 输入区

- 输入框背景：`#0F0F12`
- 边框：`border-white/10`
- 聚焦：`border-[#5E6AD2]` + `ring-2 ring-[#5E6AD2]/50 ring-offset-2 ring-offset-[#050506]`
- 占位符：`text-gray-500` / `#8A8F98`
- 发送按钮：主色 `#5E6AD2` 实色 + accent glow shadow，hover `#6872D9`，active `scale-[0.98]`
- 语音按钮：次级样式（`bg-white/[0.05]`），hover `bg-white/[0.08]`

### 9.4 交互细节（遵循设计系统"Bold Factor"）

- **多层阴影**：气泡/按钮禁止单一阴影，必须 border highlight + diffuse shadow + 可选 accent glow
- **微交互**：所有过渡 200-300ms，expo-out easing `[0.16, 1, 0.3, 1]`，位移 ≤ 8px
- **Focus ring**：输入框聚焦必须有可见 `ring-2 ring-[#5E6AD2]/50 ring-offset-2 ring-offset-[#050506]`
- **Active state**：按钮按下 `scale-[0.98]`
- **重试按钮**：次级按钮样式（`bg-white/[0.05]` + `text-[#EDEDEF]`），hover `bg-white/[0.08]` + 微弱外发光
- **流式中断标记**：`<span class="stream-interrupted">` 用错误色，与重试按钮并排

### 9.5 反模式（禁止）

- 禁止纯黑 `#000000` 背景，用 `#050506`
- 禁止纯白 `#ffffff` 文字，用 `#EDEDEF`
- 禁止 bouncy / spring 动画，用 expo-out
- 禁止单层阴影
- 禁止大幅 hover 位移（> 8px）
- 禁止彩色 accent 滥用（accent 只用于交互强调，不装饰）

### 9.6 输入区交互（微信式语音/文字切换）

参考微信的语音/文字输入方式，输入区改为模式切换式（非现有"语音按钮 + 输入框"并排）。

**布局结构**：

```
文字模式：[切换钮 ⌨️] [文字输入框 ...............] [发送 ➤]
语音模式：[切换钮 🎤] [────── 按住 说话 ──────]
```

- 左侧切换按钮：点击在"文字模式"和"语音模式"间切换
  - 文字模式下显示 🎤 图标（点击切到语音）
  - 语音模式下显示 ⌨️ 图标（点击切到文字）
  - 样式：次级按钮（`bg-white/[0.05]`，44×44px，`rounded-full`），hover `bg-white/[0.08]`
- 文字模式：切换钮 + textarea + 发送按钮（与现有一致）
- 语音模式：切换钮 + "按住 说话"大按钮（占满剩余宽度，无发送按钮，松开自动转文字发送）

**"按住 说话"按钮**：
- 默认态：背景 `bg-white/[0.05]`，文字 `#8A8F98`，"按住 说话"
- 按住态：背景 `bg-[#5E6AD2]`，文字 `#fff`，文字变为"松开发送"，加 accent glow shadow
- 录制中：可加微弱声波/呼吸动画（200-300ms ease-out，不 bouncy）
- 上滑取消：按住后手指上滑 → 显示"松开手指，取消发送"（红底 `rgba(255,60,60,0.12)` + `#ff6b6b` 文字），松开后不发送

**交互逻辑**：
- 按住（`mousedown`/`touchstart`）→ 开始 SpeechRecognition 录音
- 松开（`mouseup`/`touchend`）→ 停止录音 → 转文字 → 自动作为用户消息发送（复用现有 `handleUserInput`/`sendMessage`）
- 上滑取消：`touchmove` 检测 Y 位移 > 阈值（如 40px）→ 标记取消 → `touchend` 时不发送
- 转文字失败（SpeechRecognition 无结果或报错）→ toast 提示"未识别到语音，请重试"，不发送空消息
- 模式切换时清空当前输入框内容（避免遗留）

**心青年 chat（youth-chat.js）**：
- 同样实现微信式切换
- 心青年场景按钮可更大（便于操作），"按住 说话"按钮高度 56px
- 语音转文字后走现有 `sendMessage` 流程

**技术复用**：
- 复用现有 `bindVoiceEvents` 的 SpeechRecognition 逻辑（L907-963）
- 抽取 `_startRecording()` / `_stopRecording()` / `_cancelRecording()` 三个函数
- `handleUserInput` / `sendMessage` 不变，语音转文字后调用它们

**降级**：
- 不支持 SpeechRecognition 的浏览器（Safari iOS < 14.5 等）：隐藏语音切换钮，只显示文字模式
- 检测：`!window.SpeechRecognition && !window.webkitSpeechRecognition` → 切换钮 `display:none`

**反模式**：
- 禁止语音按钮和输入框并排（现有布局，微信式是切换而非并排）
- 禁止 bouncy 录音动画
- 禁止松开后还需手动点发送（松开即发送）

### 9.7 实施流程

实施 chat UI 改动时：
1. 先调用 `trae-remote-official:frontend-design:frontend-design` skill 获取设计指导
2. 对照本节 Token 与样式约束编写 CSS
3. 在暗色主题下验证视觉一致性（与档案页、首页风格统一）
4. 移动端验证（< 400px）确保不拥挤
5. 微信式语音/文字切换在真机验证（触摸事件、上滑取消）

## 10. 移动端"按住后页面放大溢出"Bug 修复

用户反馈：按住画面某处后，整个页面放大溢出整个屏幕。这是移动端（尤其 iOS Safari）常见的 touch 默认行为问题。

### 10.1 根因分析

经查现状：
- [index.html:5](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/index.html#L5) viewport 为 `width=device-width, initial-scale=1.0`，**未禁用用户缩放**
- [main.css:135-140](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/css/main.css#L135) `html` 无 `overflow-x: hidden`、无 `touch-action`
- [main.css:142-163](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/css/main.css#L142) `body` 无 `overflow-x: hidden`、无 `touch-action`、无 `overscroll-behavior`
- chat 容器无 `-webkit-touch-callout: none`（长按触发系统菜单/选择）

"按住后放大"通常由以下原因之一触发：
1. **iOS 双击缩放**：快速双击触发缩放（300ms 内两次 touch）
2. **长按触发系统行为**：长按触发"callout"（链接/图片菜单）或文本选择，导致布局重排
3. **横向溢出 + 缩放**：某元素宽度 > viewport，双击放大后溢出更明显
4. **touch 事件未 preventDefault**：按住按钮的 touchstart 未阻止默认，触发浏览器手势

### 10.2 修复方案

**A. viewport 收紧（index.html）**：

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
```

- `maximum-scale=1.0` + `user-scalable=no`：禁用用户手动缩放（iOS Safari 会同时禁用双击缩放）
- `viewport-fit=cover`：配合 `env(safe-area-inset-*)` 处理刘海屏

**无障碍权衡**：禁用用户缩放会牺牲部分视障用户的无障碍体验（WCAG 1.4.4）。但本项目是面向心青年照护者的工具型应用，且"按住放大"bug 严重影响可用性，权衡后选择禁用。若后续有无障碍合规要求，可改用 `maximum-scale=5` 保留有限缩放。

**B. 全局 touch 行为约束（main.css）**：

```css
html, body {
  overflow-x: hidden;
  overscroll-behavior: none;        /* 禁用橡皮筋/下拉刷新 */
  -webkit-text-size-adjust: 100%;
  touch-action: pan-y;              /* 只允许垂直滚动，禁用双指缩放/双击缩放 */
}

body {
  -webkit-touch-callout: none;      /* 禁用长按系统菜单 */
  -webkit-user-select: none;        /* 禁用长按文本选择（全局） */
  user-select: none;
}

/* 允许输入框/textarea 选择文本 */
input, textarea, [contenteditable] {
  -webkit-user-select: text;
  user-select: text;
  -webkit-touch-callout: default;
}
```

**C. chat 容器专项约束（chatbot.css）**：

```css
.chat-messages {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;     /* 滚动边界不传播到 body */
}

/* "按住 说话"按钮 — 严格阻止默认 */
.chat-voice-hold-btn {
  touch-action: none;               /* 禁用所有默认手势 */
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

**D. JS 层 touch 事件补全**：

现有 [chatbot.js:921-928](file:///Users/jinjun/Desktop/开发/参赛/ai-dongwo/js/chatbot.js#L921) `touchstart`/`touchend` 已 `preventDefault()`，但需在新的微信式"按住 说话"按钮上同样严格 `preventDefault` + `touch-action: none`，避免 iOS 长按触发缩放。

### 10.3 验证

- iOS Safari 真机：长按任意位置 → 不放大、不出系统菜单
- iOS Safari 真机：双击 → 不缩放
- iOS Safari 真机：按住"按住 说话"按钮 → 不触发缩放/选择
- Android Chrome：同上
- 输入框内仍可正常选择/输入文本
- 横向无溢出（`overflow-x: hidden` 后检查无水平滚动条）

### 10.4 影响范围

本修复是全局性的（viewport + html/body CSS），会影响到所有页面，不仅仅是 chat。但因为是修复 bug 而非改功能，且方向是收紧移动端默认行为，风险低。需在测试时覆盖：
- 首页、记录页、档案页、管理页（确认无横向溢出、无意外禁用选择）
- chat 页面（重点验证按住场景）
- 输入框/textarea（确认文本可选可输入）

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 智谱 stream API 行为与文档不符 | 先用 curl 验证 stream 响应格式，再写代码 |
| marked.js 渲染未闭合 markdown 错乱 | 流式过程显示纯文本，finalize 时才渲染 |
| DOMPurify 未加载导致 XSS | `ChatMarkdown.render` 内部检查存在性，降级为纯文本 |
| 服务端 function 流式响应被平台缓冲 | Netlify/Vercel function 需确认支持 SSE；若不支持，降级为客户端 polling 或保留非流式 |
| legacy 清理误删活代码 | grep 确认无外部引用；清理后跑全角色测试 |
| SpeechRecognition 兼容性（iOS Safari 等） | 检测后降级：隐藏语音切换钮，只显示文字模式 |
| 上滑取消误判（touchmove 抖动） | 设阈值 40px + 防抖；真机验证 |

## 12. 文件清单

新增：
- `js/lib/marked.min.js`
- `js/lib/purify.min.js`
- `js/chat-markdown.js`（若不挂 utils.js）

修改：
- `netlify/functions/chatbot.js`
- `api/chat.js`
- `js/zhipu-client.js`
- `js/chatbot.js`
- `js/youth-chat.js`
- `index.html`（引入新脚本 + viewport 收紧 + 缓存破坏版本号）
- `css/main.css`（全局 touch 行为约束：overflow-x/overscroll/touch-action/user-select）
- `css/chatbot.css`（streaming bubble、错误气泡、重试按钮、微信式语音/文字切换、"按住说话"按钮、上滑取消样式、chat 容器 touch 约束）
