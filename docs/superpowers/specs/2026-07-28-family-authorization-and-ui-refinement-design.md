# 家庭授权与 UI 精简设计

> 日期：2026-07-28
> 状态：已确认

## 背景

用户反馈"添加授权时显示其他孩子家长"的问题。经分析，根源在于 `GRANTABLE_ROLES` 包含 `parent`，导致所有家长账号都会出现在授权列表中。同时，速读卡设计过于复杂、底部导航 tab 过多、独立页面返回按钮不合理等问题也需要一并解决。

## 一、家长角色授权设计

### 1.1 核心思路

不新增角色类型，在 `access_grant` 授权记录上增加 `relation` 字段，标记家长的家庭身份。家庭协作者（祖父母、兄弟姐妹等）不能通过"添加授权"手动加入，只能通过扫码或邀请码走申请审批流程。只有主监护人（最初创建档案的家长）能管理授权。

### 1.2 数据模型改动

#### `access_grants` 新增 `relation` 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `relation` | string \| null | 仅当 `granteeRole === 'parent'` 时有意义。可选值：`father` / `mother` / `grandfather` / `grandmother` / `brother` / `sister` / `other_guardian` / `null` |

- 家长注册引导页创建的首份授权，`relation` 默认 `null`
- 扫码或邀请码加入的家长，申请时必选关系
- 非 `parent` 角色（teacher/caregiver/volunteer），`relation` 始终为 `null`
- 关系是相对于某个心青年的属性，放在 `access_grant` 上而非 `account` 上

#### 新增 `invitations` 存储

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | UUID |
| `youthId` | string | 心青年 ID |
| `grantorId` | string | 生成邀请码的家长 ID |
| `code` | string | 6 位数字 |
| `role` | string | 固定为 `'parent'` |
| `createdAt` | string | 创建时间 |
| `expiresAt` | string | 过期时间（24 小时后） |
| `status` | string | `'active'` / `'used'` / `'expired'` |
| `usedBy` | string \| null | 使用者账号 ID |
| `usedAt` | string \| null | 使用时间 |

### 1.3 主监护人权限机制

- 复用现有 `profile.currentGuardianId` 判断主监护人身份
- `Permissions.canManage()` 改为：主监护人 或 admin
- 主监护人可以：管理授权（添加/撤销）、审批申请、生成邀请码
- 其他家长（祖父母、兄弟姐妹等）：只有数据访问权限，不能管理授权
- 管理页的授权管理入口仅对主监护人和 admin 可见
- 第一版不支持主监护人转让

### 1.4 `GRANTABLE_ROLES` 调整

```
// 修改前
var GRANTABLE_ROLES = ['parent', 'teacher', 'caregiver', 'volunteer'];

// 修改后
var GRANTABLE_ROLES = ['teacher', 'caregiver', 'volunteer'];
```

### 1.5 注册流程调整

家长注册后不再直接跳转 `welcome` 创建档案，而是跳转一个**选择页**：

- 🏠 **创建心青年档案**（主监护人）→ 进入档案创建表单（现有 welcome 页内容）
- 🔗 **加入已有家庭**（家庭协作者）→ 展开两个子选项：
  - 📱 扫码加入（扫档案码）
  - 🔢 输入邀请码

其他角色（teacher/caregiver/volunteer）注册后保持不变：进入游离态页面，显示扫码加入。

### 1.6 家庭协作者加入流程

#### 路径 1：扫码加入（面对面场景）

1. 家庭成员扫档案码
2. 系统判断：已登录 & 角色是 parent & 没有该心青年的授权 → 显示"申请加入"页
3. 页面上必选**关系**（父亲/母亲/祖父/祖母/兄弟/姐妹/其他监护人）
4. 填写申请理由（选填）→ 提交 → 待主监护人审批
5. 审批通过后，`access_grant` 的 `relation` 字段记录所选关系

#### 路径 2：邀请码加入（远程场景）

1. 主监护人在授权管理页点"邀请家庭成员" → 生成 6 位数字邀请码（24 小时有效）
2. 家长把邀请码发给对方
3. 对方注册/登录后（角色必须是 parent），在游离态页面输入邀请码
4. 系统识别出是哪个心青年的邀请 → 自动跳转到"申请加入"页（同样选关系、填理由）
5. 后续流程同扫码

### 1.7 审批流程调整

#### 待审批申请的展示

家长申请的情况，待审批卡片上多显示"关系"：

```
👨‍👩‍👧 王叔叔
家长 · 申请作为：叔叔
我是孩子的叔叔，想帮忙照看
                  [✕] [✓]
```

#### 审批通过后的处理

`_approveRequest` 函数需要修改：
- 如果申请人角色是 `parent`，把 `relation` 也传进去，写入 `access_grant`
- 其他角色不变

#### 授权列表显示

- 如果有 `relation`，显示对应的关系（如"父亲"、"祖母"）
- 如果 `relation` 为空（最初注册创建的家长），显示"监护人"标签
- 非 `parent` 角色保持原样

## 二、速读卡设计优化

### 2.1 核心改动

- 去掉标签切换，改为单页展示
- 只保留 4 类关键信息，按使用频率从高到低排列：
  1. 基本信息（姓名、年龄、性别）
  2. 过敏源
  3. 行为红线（含应对方式）
  4. 紧急联系人（放最下面，使用频率最低）
- 紧凑排版，压缩卡片内边距和间距
- 底部保留"查看完整档案"按钮
- 去掉复制文本和打印按钮（精简）

### 2.2 定位

给不熟悉孩子的人（志愿者、新老师）快速扫一眼知道"不能做什么、出事找谁"。

## 三、底部导航调整

### 3.1 从 6 个减为 4 个

```
// 修改前（constants.js NAV_ITEMS）
NAV_ITEMS: [
  { page: 'dashboard', icon: '🏠', label: '主页' },
  { page: 'records', icon: '📋', label: '记录' },
  { page: 'analytics', icon: '📊', label: '分析' },
  { page: 'profile', icon: '📁', label: '档案' },
  { page: 'chat', icon: '💬', label: '对话' },
  { page: 'management', icon: '⚙️', label: '管理' }
]

// 修改后
NAV_ITEMS: [
  { page: 'dashboard', icon: '🏠', label: '首页' },
  { page: 'records', icon: '📋', label: '记录' },
  { page: 'profile', icon: '📁', label: '档案' },
  { page: 'management', icon: '⚙️', label: '管理' }
]
```

### 3.2 各 tab 职责

| Tab | 内容 |
|---|---|
| 首页 | 健康速报（含"查看详细分析 →"入口）+ 每日交接 + 速读卡入口 |
| 记录 | 对话采集 + 记录表单合并 |
| 档案 | 档案详情页（右上角保留速读卡按钮） |
| 管理 | 档案信息 + 授权管理 |

### 3.3 分析入口

- 去掉独立的"分析"tab
- 分析入口放到首页"今日健康速报"卡片内，作为"查看详细分析 →"按钮
- 点击后跳转到分析页（日报/周报/月报）

### 3.4 对话与记录合并

- "对话"和"记录"合并为一个"记录"tab
- 记录页内同时提供对话采集和传统记录两种方式

## 四、独立页面返回按钮

### 4.1 改动

- 去掉所有独立页面的"← 返回"按钮
- 二级页面（速读卡、授权管理、档案码）保留"✕ 关闭"按钮
- 关闭后回到上一级 tab

### 4.2 涉及页面

| 页面 | 当前 | 改动后 |
|---|---|---|
| 速读卡（quickcard.js） | "← 返回" | "✕ 关闭" |
| 授权管理（grants.js） | "← 返回" | "✕ 关闭" |
| 档案码（archive-code.js） | "← 返回" | "✕ 关闭" |

## 五、实施清单

### 数据层
- [ ] `Storage` 新增 `invitations` CRUD 方法
- [ ] `access_grant` 数据结构兼容 `relation` 字段

### 权限层
- [ ] `Permissions.canManage()` 改为主监护人 + admin
- [ ] `Permissions.grantAccess()` 支持 `relation` 参数

### 页面层
- [ ] `welcome.js` 改造为家长游离态选择页（创建档案 / 加入家庭）
- [ ] `grants.js` 移除 `parent` 从 `GRANTABLE_ROLES`，加邀请码生成，显示关系标签
- [ ] 扫码加入页增加家长关系选择（必填）
- [ ] 新增邀请码输入入口（游离态页面）
- [ ] `quickcard.js` 改为极简单页（4 类信息，去掉标签切换）
- [ ] `constants.js` `NAV_ITEMS` 从 6 个减为 4 个
- [ ] 记录页合并对话采集
- [ ] 首页健康速报卡片增加"查看详细分析"入口
- [ ] 独立页面返回按钮改为"✕ 关闭"

### 测试
- [ ] 主监护人创建档案、生成邀请码、审批申请
- [ ] 家庭协作者扫码加入、邀请码加入
- [ ] 非主监护人家长不能管理授权
- [ ] 速读卡极简展示
- [ ] 底部导航 4 tab 正常
- [ ] 独立页面关闭按钮回到上一级
