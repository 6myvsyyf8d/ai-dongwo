# Contract: State Interface (state.js)

**Module**: `js/state.js`
**Global Object**: `window.AppState`
**Purpose**: 全局应用状态管理，所有模块通过 AppState 共享状态，避免全局变量污染。

---

## State Shape

```javascript
window.AppState = {
  // 用户状态
  currentUser: null,           // UserAccount | null — 当前登录用户
  isLoggedIn: false,          // boolean

  // 档案状态
  currentYouth: null,          // YouthProfile | null — 当前查看的心青年
  currentYouthRecords: [],     // RecordEntry[] — 当前心青年的记录缓存

  // UI 状态
  currentPage: 'login',       // string — 当前页面路由
  pageParams: {},              // object — 路由参数（如 youthId）
  isLoading: false,           // boolean
  toastMessage: null,         // string | null — 全局提示消息

  // 权限缓存
  currentGrants: [],           // AccessGrant[] — 当前用户对当前心青年的授权列表
  canRead: false,              // boolean — 是否有读取权限
  canWrite: false,             // boolean — 是否有写入权限
  canManage: false,            // boolean — 是否有管理权限（授权、监护权）

  // 事件监听器
  _listeners: {},              // { [event: string]: Function[] }
};
```

---

## Methods

### `AppState.init()`

初始化状态，检查 localStorage 中的登录状态。

```typescript
function init(): void
```

**行为**：
1. 检查 `Storage.getCurrentUser()`
2. 如有登录用户，恢复 `currentUser` 和 `isLoggedIn`
3. 触发 `onStateChange` 事件

---

### `AppState.login(account)`

设置当前登录用户。

```typescript
function login(account: UserAccount): void
```

**行为**：
- 设置 `currentUser = account`
- 设置 `isLoggedIn = true`
- 调用 `Storage.setCurrentUser(account.id)`
- 触发 `onStateChange` 事件

---

### `AppState.logout()`

登出当前用户。

```typescript
function logout(): void
```

**行为**：
- 清空所有用户相关状态
- 调用 `Storage.clearCurrentUser()`
- 触发 `onStateChange` 事件

---

### `AppState.selectYouth(youthId)`

选择要查看的心青年档案。

```typescript
function selectYouth(youthId: string): void
```

**行为**：
- 从 Storage 加载 YouthProfile 和 Records
- 更新 `currentYouth` 和 `currentYouthRecords`
- 调用 `Permissions.refresh(youthId)` 刷新权限缓存
- 触发 `onStateChange` 事件

---

### `AppState.navigate(page, params?)`

页面路由切换。

```typescript
function navigate(page: string, params?: object): void
```

**行为**：
- 更新 `currentPage` 和 `pageParams`
- 触发 `onNavigate` 事件（app.js 监听此事件进行页面渲染）

---

### `AppState.showToast(message, duration?)`

显示全局提示消息。

```typescript
function showToast(message: string, duration?: number = 3000): void
```

**行为**：设置 `toastMessage`，duration 毫秒后自动清除。

---

### `AppState.on(event, callback)`

注册事件监听器。

```typescript
function on(event: string, callback: Function): void
```

| 事件 | 触发时机 |
|------|----------|
| `onStateChange` | 任何状态变更后 |
| `onNavigate` | 页面路由切换时 |
| `onLogin` | 用户登录成功时 |
| `onLogout` | 用户登出时 |
| `onYouthChanged` | 当前心青年切换时 |

---

### `AppState.off(event, callback)`

移除事件监听器。

```typescript
function off(event: string, callback: Function): void
```
