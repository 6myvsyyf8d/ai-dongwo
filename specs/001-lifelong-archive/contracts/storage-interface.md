# Contract: Storage Interface (storage.js)

**Module**: `js/storage.js`
**Global Object**: `window.Storage`
**Purpose**: 数据持久化层，封装 localStorage 操作，提供统一的 CRUD 接口。所有数据读写必须通过此模块，上层业务逻辑不直接调用 localStorage。

---

## API Reference

### `Storage.get(key)`

获取指定 key 的 JSON 数据。

```typescript
function get(key: string): any | null
```

| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | localStorage key |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| data | any \| null | 解析后的 JSON 对象，key 不存在时返回 null |

**异常**：解析失败时返回 null 并在控制台输出警告。

---

### `Storage.set(key, value)`

存储 JSON 数据到指定 key。

```typescript
function set(key: string, value: any): void
```

| 参数 | 类型 | 说明 |
|------|------|------|
| key | string | localStorage key |
| value | any | 将被 JSON.stringify 序列化的值 |

**异常**：序列化失败或存储空间不足时抛出错误。

---

### `Storage.remove(key)`

删除指定 key。

```typescript
function remove(key: string): void
```

---

### `Storage.getProfiles()`

获取所有心青年档案。

```typescript
function getProfiles(): { [youthId: string]: YouthProfile }
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| profiles | { string: YouthProfile } | 以 youthId 为 key 的档案字典 |

**localStorage key**: `ai_dongwo_profiles`

---

### `Storage.getProfile(youthId)`

获取单个心青年档案。

```typescript
function getProfile(youthId: string): YouthProfile | null
```

---

### `Storage.saveProfile(profile)`

保存（创建或更新）心青年档案。

```typescript
function saveProfile(profile: YouthProfile): { success: boolean, error?: string }
```

| 参数 | 类型 | 说明 |
|------|------|------|
| profile | YouthProfile | 完整的档案对象 |

| 返回值 | 类型 | 说明 |
|--------|------|------|
| result | { success, error? } | 成功返回 success: true；身份证号重复时返回 { success: false, error: 'ID_NUMBER_EXISTS' } |

**验证规则**：
- 身份证号全局唯一（遍历所有档案检查）
- 自动更新 `profile.updatedAt` 为当前时间
- 新档案设置 `lifeCycleStatus = 'created'`

---

### `Storage.getAccounts()`

获取所有用户账户。

```typescript
function getAccounts(): { [accountId: string]: UserAccount }
```

**localStorage key**: `ai_dongwo_accounts`

---

### `Storage.getAccount(accountId)`

```typescript
function getAccount(accountId: string): UserAccount | null
```

---

### `Storage.saveAccount(account)`

```typescript
function saveAccount(account: UserAccount): { success: boolean, error?: string }
```

**验证规则**：
- 用户名 + 角色组合不重复（同一角色不可有同名用户）
- PIN 哈希已通过外部传入（storage 不做哈希处理）

---

### `Storage.getRecords(youthId)`

获取指定心青年的所有记录。

```typescript
function getRecords(youthId: string): RecordEntry[]
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| records | RecordEntry[] | 按 `recordedAt` 降序排列 |

**localStorage key**: `ai_dongwo_records`（值为 `{ [youthId]: RecordEntry[] }`）

---

### `Storage.addRecord(youthId, record)`

添加一条记录到指定心青年。

```typescript
function addRecord(youthId: string, record: RecordEntry): { success: boolean, error?: string }
```

**行为**：
- 自动设置 `record.id = generateUUID()`（如果未提供）
- 追加到对应心青年的记录数组
- 自动排序（按 recordedAt 降序）

---

### `Storage.updateRecord(youthId, recordId, updates)`

更新指定记录。

```typescript
function updateRecord(youthId: string, recordId: string, updates: Partial<RecordEntry>): { success: boolean, error?: string }
```

---

### `Storage.deleteRecord(youthId, recordId)`

```typescript
function deleteRecord(youthId: string, recordId: string): boolean
```

---

### `Storage.getArchiveCode(youthId)`

获取指定心青年的有效档案码。

```typescript
function getArchiveCode(youthId: string): ArchiveCode | null
```

**行为**：返回 `status === 'active'` 的档案码，无有效码时返回 null。

**localStorage key**: `ai_dongwo_archive_codes`

---

### `Storage.saveArchiveCode(code)`

```typescript
function saveArchiveCode(code: ArchiveCode): void
```

**行为**：保存新档案码时，自动将该心青年其他档案码标记为 `status: 'revoked'`。

---

### `Storage.getAccessGrants(youthId?)`

获取授权记录。可按心青年筛选。

```typescript
function getAccessGrants(youthId?: string): AccessGrant[]
```

**localStorage key**: `ai_dongwo_access_grants`

---

### `Storage.addAccessGrant(grant)`

```typescript
function addAccessGrant(grant: AccessGrant): { success: boolean, error?: string }
```

---

### `Storage.revokeAccessGrant(grantId, reason)`

```typescript
function revokeAccessGrant(grantId: string, reason: string): boolean
```

**行为**：设置 `status: 'revoked'`, `revokedAt: new Date().toISOString()`, `revokeReason: reason`。

---

### `Storage.getGuardianshipTransfers(youthId?)`

```typescript
function getGuardianshipTransfers(youthId?: string): GuardianshipTransfer[]
```

---

### `Storage.addGuardianshipTransfer(transfer)`

```typescript
function addGuardianshipTransfer(transfer: GuardianshipTransfer): { success: boolean, error?: string }
```

---

### `Storage.getCurrentUser()`

获取当前登录用户。

```typescript
function getCurrentUser(): { accountId: string, loginAt: string } | null
```

**localStorage key**: `ai_dongwo_current_user`

---

### `Storage.setCurrentUser(accountId)`

```typescript
function setCurrentUser(accountId: string): void
```

---

### `Storage.clearCurrentUser()`

```typescript
function clearCurrentUser(): void
```

---

### `Storage.initTestData()`

初始化虚构测试数据（仅开发环境）。

```typescript
async function initTestData(): Promise<void>
```

**行为**：创建 2-3 个虚构心青年（小雨、小明）和对应家长账户，预填部分档案数据。
