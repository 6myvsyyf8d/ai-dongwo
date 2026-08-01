# 授权管理与系统管理员 — 设计方案

**Date**: 2026-07-28
**Status**: Draft

---

## 1. 概述

实现授权管理功能（监护人管理心青年的访问授权）和系统管理员角色（管理用户和全局授权）。

## 2. 需求

### 2.1 授权管理
- **管理者**: 监护人（仅自己心青年）+ 管理员（所有心青年）
- **操作**: 查看授权列表、添加授权、撤销授权
- **可授权角色**: 家长、老师、照护者、志愿者（排除 youth、government）
- **访问范围**: 预设模板 — 只读（read:full）或完全访问（read:full + write 全部模块）
- **页面布局**: 独立页面，底部 Sheet 添加授权

### 2.2 系统管理员
- **新角色**: `admin`，图标 🛡️，标签 "管理员"
- **功能**: 用户管理（创建/禁用/删除）、全局授权管理、数据查看
- **权限**: 不受监护人限制，可访问所有心青年数据

## 3. 技术方案

### 3.1 新增文件
- `js/grants.js` — 授权管理页面渲染 + 底部 Sheet 交互
- `js/admin.js` — 管理员专属页面（用户管理、全局授权）

### 3.2 修改文件
- `js/constants.js` — 新增 `admin` 角色定义
- `js/auth.js` — 新增 `admin` 角色支持
- `js/app.js` — 注册 `#grants` 路由，管理页区分监护人/管理员视图
- `js/storage.js` — 测试数据新增管理员账号
- `index.html` — 引入 `grants.js`、`admin.js`

### 3.3 页面结构

**授权管理页 (`#grants`)**:
1. 页头：心青年名称 + "授权管理" 标题
2. 授权列表：每项显示 用户头像/角色/范围 + "撤销" 按钮
3. 底部固定按钮："+ 添加授权"
4. 添加 Sheet：用户单选列表 + 只读/完全访问切换 + 确认
5. 撤销确认：弹窗二次确认

**管理员页 (`#admin`)**:
1. 用户列表 Tab：所有注册用户，支持禁用/启用
2. 创建用户 Tab：新建用户账号
3. 全局授权 Tab：选择心青年 → 管理授权

### 3.4 数据流
```
Storage.getAccessGrants(youthId) → 渲染列表
Storage.addAccessGrant(grant) → 添加授权
Storage.revokeAccessGrant(grantId, reason) → 撤销授权
Storage.getAccounts() → 用户列表
Storage.saveAccount() → 创建用户
```

### 3.5 授权范围预设
- **只读访问**: `['read:full']`
- **完全访问**: `['read:full', 'write:communicationGuide', 'write:emotionBehavior', 'write:careMedical', 'write:workSupport', 'write:relationshipMap', 'manage:grants']`

## 4. 验收标准
- [ ] 监护人能从管理页进入授权管理，查看当前授权列表
- [ ] 监护人能添加新授权（选用户 + 选范围）
- [ ] 监护人能撤销已有授权（二次确认）
- [ ] 管理员账号能登录，看到管理后台
- [ ] 管理员能查看所有用户列表
- [ ] 管理员能管理任意心青年的授权
- [ ] 10 个角色登录测试全部通过