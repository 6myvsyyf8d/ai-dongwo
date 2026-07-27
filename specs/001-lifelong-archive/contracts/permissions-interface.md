# Contract: Permissions Interface (permissions.js)

**Module**: `js/permissions.js`
**Global Object**: `window.Permissions`
**Purpose**: 角色权限管理，提供权限检查、授权创建/撤销、有效期管理功能。基于 research.md 决策 3 的"角色 + 授权令牌"双层权限模型。

---

## API Reference

### `Permissions.refresh(youthId)`

刷新当前用户对指定心青年的权限缓存。由 `AppState.selectYouth()` 自动调用。

```typescript
function refresh(youthId: string): void
```

**行为**：
1. 从 Storage 加载该心青年的所有 AccessGrant
2. 过滤出 `granteeId === AppState.currentUser.id` 且 `status === 'active'` 且未过期的授权
3. 更新 `AppState.currentGrants`、`AppState.canRead`、`AppState.canWrite`、`AppState.canManage`

---

### `Permissions.canRead(module?)`

检查当前用户是否有读取权限。

```typescript
function canRead(module?: string): boolean
```

| 参数 | 类型 | 说明 |
|------|------|------|
| module | string? | 可选指定模块（如 'emotionBehavior'），不传则检查是否有任何读取权限 |

**权限判定规则**：
- 心青年本人 (`youth`)：始终返回 true（受保护字段除外）
- 家长 (`parent`)：始终返回 true
- 机构老师 (`teacher`)：检查 `read:full` scope + 有效期内
- 照护者 (`caregiver`)：检查 `read:safety` scope + 有效期内
- 志愿者 (`volunteer`)：检查 `read:safety` scope + 有效期内
- 政府 (`government`)：始终返回 false（不可读取个体档案）

---

### `Permissions.canWrite(module)`

检查当前用户是否有写入指定模块的权限。

```typescript
function canWrite(module: string): boolean
```

| 参数 | 类型 | 说明 |
|------|------|------|
| module | string | 模块名（如 'emotionBehavior', 'careMedical'） |

**权限判定规则**：检查当前用户授权 scope 中是否包含 `write:${module}`。

---

### `Permissions.canManage()`

检查当前用户是否有管理权限（授权管理、监护权管理）。

```typescript
function canManage(): boolean
```

**返回 true 的条件**：当前用户是心青年本人 或 当前用户是家长 且授权 scope 包含 `manage:grants`。

---

### `Permissions.grantAccess(youthId, granteeId, granteeRole, validUntil?)`

创建授权令牌。仅心青年本人或家长可调用。

```typescript
function grantAccess(
  youthId: string,
  granteeId: string,
  granteeRole: 'teacher' | 'caregiver' | 'volunteer',
  validUntil?: string
): { success: boolean, error?: string }
```

| 参数 | 类型 | 说明 |
|------|------|------|
| youthId | string | 被访问的心青年 |
| granteeId | string | 被授权的用户 ID |
| granteeRole | enum | 被授权人角色 |
| validUntil | string? | 授权到期时间（ISO date），null 使用默认值 |

**默认 validUntil 规则**：
- teacher：服务期结束日期（需手动指定）
- caregiver：雇佣期结束日期（需手动指定）
- volunteer：活动结束时间（默认当天 23:59:59）

**默认 scope 模板**：参见 data-model.md AccessGrant 默认 scope 模板。

**前置检查**：
1. 调用者必须是心青年本人或家长 → `Permissions.canManage()`
2. 被授权用户必须是已注册账户 → `Storage.getAccount(granteeId)` 不为 null
3. 该用户对该心青年没有 `status: 'active'` 的授权

---

### `Permissions.revokeAccess(grantId, reason)`

撤销授权令牌。

```typescript
function revokeAccess(grantId: string, reason: string): boolean
```

**前置检查**：调用者必须是授权人（grantorId）或心青年本人。

---

### `Permissions.checkRecordVisibility(record)`

检查当前用户是否可以看到指定记录。

```typescript
function checkRecordVisibility(record: RecordEntry): boolean
```

**判定逻辑**：

| record.visibilityLevel | 可见角色 |
|----------------------|----------|
| `full` | 心青年本人、家长、服务期内的机构老师 |
| `safety_only` | 所有有授权的角色（包括照护者、志愿者） |
| `private` | 仅记录者本人、家长、心青年本人 |

**额外规则**：照护者只能看到自己录入的 `private` 记录。

---

### `Permissions.checkExpired()`

检查并标记所有过期授权。

```typescript
function checkExpired(): number
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| count | number | 本次标记为 expired 的授权数量 |

**行为**：遍历所有 AccessGrant，将 `validUntil < now` 且 `status === 'active'` 的授权标记为 `status: 'expired'`。

---

### `Permissions.getAccessibleYouths()`

获取当前用户可访问的所有心青年列表。

```typescript
function getAccessibleYouths(): YouthProfile[]
```

**行为**：
1. 心青年本人：返回自己的档案
2. 家长：返回所有已创建档案的心青年
3. 其他角色：返回有 `status: 'active'` 授权的心青年列表

---

### `Permissions.initGuardianshipTransfer(youthId, toGuardianId, proof)`

发起监护权转移。

```typescript
function initGuardianshipTransfer(
  youthId: string,
  toGuardianId: string,
  proof?: string
): { success: boolean, error?: string }
```

**前置检查**：
1. 调用者必须是当前监护人（`YouthProfile.currentGuardianId`）
2. 新监护人必须是已注册的 parent 角色账户
3. 该心青年没有 `reviewStatus: 'pending'` 的转移记录
