# Data Model: AI懂我 - 全生涯数据灯塔

**Feature**: 001-lifelong-archive
**Date**: 2026-07-25
**Status**: Draft
**Research Reference**: [research.md](./research.md)

---

## Overview

本文档定义 AI懂我 v1.x 的完整数据模型。数据模型基于 spec.md 中的 7 个 Key Entities 和 research.md 中的 8 项技术决策，采用 localStorage + JSON Schema 存储，为后续服务端迁移预留扩展空间。

### 设计原则

1. **心青年中心**：所有实体以 `YouthProfile` 为核心，其他实体通过外键关联
2. **主权可追溯**：每条记录可追溯到记录者角色和时间，数据归属清晰
3. **模块化存储**：档案数据按 6 大模块结构化，便于检索和速读卡提取
4. **前端可实现**：数据结构适合 localStorage 序列化，无需复杂关系数据库
5. **迁移友好**：字段命名和结构与服务端 REST API / PostgreSQL schema 对齐，降低迁移成本

---

## Entity Definitions

### 1. YouthProfile（心青年档案）— 核心实体

心青年全生涯档案的主记录，以身份证号为唯一主键，终身绑定。

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "YouthProfile",
  "type": "object",
  "required": ["id", "idNumber", "name", "gender", "birthDate", "createdAt", "lifeCycleStatus"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "系统生成的唯一档案 ID（UUID v4），非身份证号"
    },
    "idNumber": {
      "type": "string",
      "pattern": "^[1-9]\\d{5}(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])\\d{3}[0-9Xx]$",
      "description": "身份证号，唯一主键（业务层校验唯一性），加密存储"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 50,
      "description": "心青年姓名（可使用化名）"
    },
    "gender": {
      "type": "string",
      "enum": ["male", "female", "other"],
      "description": "性别"
    },
    "birthDate": {
      "type": "string",
      "format": "date",
      "description": "出生日期"
    },
    "avatar": {
      "type": ["string", "null"],
      "description": "头像标识（emoji 或预设图标 ID），不存储真实照片"
    },
    "lifeCycleStatus": {
      "type": "string",
      "enum": ["created", "active", "institution_change", "guardian_change", "supervised", "deceased", "anonymized"],
      "description": "档案生命周期状态，参考 Constitution v2.0.0 数据生命周期主权流转"
    },
    "currentGuardianId": {
      "type": ["string", "null"],
      "format": "uuid",
      "description": "当前监护人 UserAccount.id，null 表示无监护人（成年独立心青年）"
    },
    "emergencyContacts": {
      "type": "array",
      "items": { "$ref": "#/definitions/EmergencyContact" },
      "description": "急救联系人列表"
    },
    "modules": {
      "type": "object",
      "description": "6 大模块的结构化数据，各模块独立存储",
      "properties": {
        "lifePreferences": { "$ref": "#/definitions/LifePreferences" },
        "communicationGuide": { "$ref": "#/definitions/CommunicationGuide" },
        "emotionBehavior": { "$ref": "#/definitions/EmotionBehavior" },
        "careMedical": { "$ref": "#/definitions/CareMedical" },
        "workSupport": { "$ref": "#/definitions/WorkSupport" },
        "relationshipMap": { "$ref": "#/definitions/RelationshipMap" }
      }
    },
    "createdAt": {
      "type": "string",
      "format": "date-time",
      "description": "档案创建时间"
    },
    "updatedAt": {
      "type": "string",
      "format": "date-time",
      "description": "最后更新时间"
    },
    "deceasedAt": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "死亡时间，仅 deceased/anonymized 状态有值"
    }
  }
}
```

**生命周期状态机**：

```
created → active → institution_change → active
                → guardian_change → active
                → supervised
                → deceased → anonymized
```

| 状态 | 触发条件 | 设计要求 |
|------|----------|----------|
| `created` | 档案首次创建 | 身份证号主键确立，生成档案码 |
| `active` | 正常使用中 | 多角色可授权访问和录入 |
| `institution_change` | 更换机构 | 扫码迁移中，旧机构权限冻结 |
| `guardian_change` | 监护权转移中 | 原监护人权限降级，新监护人待审核 |
| `supervised` | 政府监管介入 | 限政府看板聚合，零个体接触 |
| `deceased` | 心青年去世 | 触发脱敏流程，档案只读 |
| `anonymized` | 脱敏完成 | 去除所有 PII，进入研究库 |

---

### 2. UserAccount（用户账户）

所有 6 种角色的登录账户，通过 AccessGrant 关联到具体心青年。

```json
{
  "title": "UserAccount",
  "type": "object",
  "required": ["id", "name", "role", "pinHash", "registeredAt"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "用户唯一 ID"
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 100,
      "description": "用户姓名/昵称"
    },
    "phone": {
      "type": ["string", "null"],
      "description": "手机号（可选，用于找回）"
    },
    "role": {
      "type": "string",
      "enum": ["youth", "parent", "teacher", "caregiver", "volunteer", "government"],
      "description": "角色类型"
    },
    "pinHash": {
      "type": "string",
      "description": "PIN 码哈希（SHA-256），v1.x 简易认证"
    },
    "institutionName": {
      "type": ["string", "null"],
      "description": "所属机构名称（仅 teacher 角色必填）"
    },
    "registeredAt": {
      "type": "string",
      "format": "date-time"
    },
    "lastLoginAt": {
      "type": ["string", "null"],
      "format": "date-time"
    },
    "isActive": {
      "type": "boolean",
      "default": true,
      "description": "账户是否活跃"
    }
  }
}
```

**角色枚举值映射**：

| 枚举值 | 中文角色 | 权限模板 |
|--------|----------|----------|
| `youth` | 心青年本人 | 终身、全档案读取、心情/愿望写入 |
| `parent` | 家长/监护人 | 至监护权转移、全档案读写、授权管理 |
| `teacher` | 机构老师 | 服务期内、ISP/行为干预/能力评估读写 |
| `caregiver` | 照护者/护工 | 雇佣期内、安全速查+自己的护理记录 |
| `volunteer` | 志愿者 | 单次活动、仅安全速查+活动记录 |
| `government` | 政府 | 永久、仅宏观趋势看板 |

---

### 3. RecordEntry（记录条目）

多角色录入的档案记录，每条带角色和时间戳。

```json
{
  "title": "RecordEntry",
  "type": "object",
  "required": ["id", "youthId", "recorderId", "recorderRole", "module", "content", "recordedAt"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "youthId": {
      "type": "string",
      "format": "uuid",
      "description": "关联的心青年 YouthProfile.id"
    },
    "recorderId": {
      "type": "string",
      "format": "uuid",
      "description": "记录者 UserAccount.id"
    },
    "recorderRole": {
      "type": "string",
      "enum": ["youth", "parent", "teacher", "caregiver", "volunteer"],
      "description": "记录时角色（快照，防止角色变更影响历史记录）"
    },
    "module": {
      "type": "string",
      "enum": ["lifePreferences", "communicationGuide", "emotionBehavior", "careMedical", "workSupport", "relationshipMap"],
      "description": "记录归属的 6 大模块之一"
    },
    "recordType": {
      "type": "string",
      "enum": ["observation", "intervention", "assessment", "daily_care", "isp_plan", "activity_log", "mood_check", "wish", "chatbot_captured"],
      "description": "记录类型细分"
    },
    "content": {
      "type": "object",
      "description": "记录内容，结构因 recordType 而异",
      "properties": {
        "text": {
          "type": "string",
          "description": "记录文本内容"
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" },
          "description": "自动/手动标签（如 '红线', '过敏', '情绪波动'）"
        },
        "structuredData": {
          "type": ["object", "null"],
          "description": "结构化数据（如能力评分、ISP 目标等），按 recordType 定义 schema"
        }
      }
    },
    "visibilityLevel": {
      "type": "string",
      "enum": ["full", "safety_only", "private"],
      "default": "full",
      "description": "可见性级别：full=全档案可见，safety_only=仅速查可见，private=仅记录者和家长可见"
    },
    "recordedAt": {
      "type": "string",
      "format": "date-time",
      "description": "精确记录时间戳"
    },
    "isOffline": {
      "type": "boolean",
      "default": false,
      "description": "是否离线录入"
    },
    "syncedAt": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "离线记录同步时间"
    }
  }
}
```

**可见性规则**：

| visibilityLevel | 心青年本人 | 家长 | 机构老师 | 照护者 | 志愿者 | 政府 |
|-----------------|-----------|------|----------|--------|--------|------|
| `full` | ✅ | ✅ | ✅（服务期内） | ❌ | ❌ | ❌ |
| `safety_only` | ✅ | ✅ | ✅ | ✅（速查） | ✅（速查） | ❌ |
| `private` | ✅ | ✅ | ❌ | 仅自己录入 | ❌ | ❌ |

---

### 4. ArchiveCode（档案码）

全生涯数字档案码，终身绑定心青年。

```json
{
  "title": "ArchiveCode",
  "type": "object",
  "required": ["id", "youthId", "codeUrl", "generatedAt", "status"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid",
      "description": "档案码记录 ID"
    },
    "youthId": {
      "type": "string",
      "format": "uuid",
      "description": "关联的心青年 YouthProfile.id"
    },
    "codeUrl": {
      "type": "string",
      "description": "编码的 URL：{HOST}/archive/{youthId}?token={HMAC}"
    },
    "qrImageData": {
      "type": ["string", "null"],
      "description": "二维码图片的 base64 数据（缓存，避免重复生成）"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "status": {
      "type": "string",
      "enum": ["active", "revoked", "expired"],
      "description": "档案码状态"
    },
    "revokedAt": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "失效时间（档案码丢失重新生成时）"
    },
    "hmacSecret": {
      "type": "string",
      "description": "HMAC 签名密钥（localStorage 加密存储）"
    }
  }
}
```

**档案码生命周期**：`active` → `revoked`（丢失补办） → 新码生成（新 `ArchiveCode` 记录）

---

### 5. AccessGrant（权限授权记录）

授权令牌，定义"谁"对"哪个心青年"有"什么权限"。

```json
{
  "title": "AccessGrant",
  "type": "object",
  "required": ["id", "youthId", "grantorId", "granteeId", "granteeRole", "scope", "status", "grantedAt"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "youthId": {
      "type": "string",
      "format": "uuid",
      "description": "被访问的心青年"
    },
    "grantorId": {
      "type": "string",
      "format": "uuid",
      "description": "授权人（心青年本人或家长/监护人）"
    },
    "granteeId": {
      "type": "string",
      "format": "uuid",
      "description": "被授权人 UserAccount.id"
    },
    "granteeRole": {
      "type": "string",
      "enum": ["parent", "teacher", "caregiver", "volunteer"],
      "description": "被授权人的角色"
    },
    "scope": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "read:full",
          "read:safety",
          "read:own_records",
          "write:lifePreferences",
          "write:communicationGuide",
          "write:emotionBehavior",
          "write:careMedical",
          "write:workSupport",
          "write:relationshipMap",
          "manage:grants"
        ]
      },
      "description": "授权权限范围"
    },
    "validFrom": {
      "type": "string",
      "format": "date-time"
    },
    "validUntil": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "授权到期时间，null = 永久（家长角色）"
    },
    "status": {
      "type": "string",
      "enum": ["active", "expired", "revoked", "pending_approval"],
      "description": "授权状态"
    },
    "grantedAt": {
      "type": "string",
      "format": "date-time"
    },
    "revokedAt": {
      "type": ["string", "null"],
      "format": "date-time"
    },
    "revokeReason": {
      "type": ["string", "null"],
      "description": "撤销原因（如：服务期满、监护权转移）"
    }
  }
}
```

**默认 scope 模板**（按角色）：

| 角色 | 默认 scope |
|------|-----------|
| `parent` | `["read:full", "write:*", "manage:grants"]` — validUntil: null |
| `teacher` | `["read:full", "write:communicationGuide", "write:emotionBehavior", "write:workSupport", "write:careMedical"]` — validUntil: 服务期 |
| `caregiver` | `["read:safety", "read:own_records", "write:careMedical"]` — validUntil: 雇佣期 |
| `volunteer` | `["read:safety", "write:relationshipMap"]` — validUntil: 活动结束 |

---

### 6. GuardianshipTransfer（监护权转移记录）

监护权转移全流程记录。

```json
{
  "title": "GuardianshipTransfer",
  "type": "object",
  "required": ["id", "youthId", "fromGuardianId", "toGuardianId", "appliedAt", "reviewStatus"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "youthId": {
      "type": "string",
      "format": "uuid"
    },
    "fromGuardianId": {
      "type": "string",
      "format": "uuid",
      "description": "原监护人"
    },
    "toGuardianId": {
      "type": "string",
      "format": "uuid",
      "description": "新监护人（候选）"
    },
    "toGuardianProof": {
      "type": ["string", "null"],
      "description": "新监护人资格证明描述（v1.x 为文本描述，后续可上传文件）"
    },
    "appliedAt": {
      "type": "string",
      "format": "date-time"
    },
    "reviewStatus": {
      "type": "string",
      "enum": ["pending", "approved", "rejected"],
      "description": "审核状态（v1.x 由家长手动确认，后续由系统或人工审核）"
    },
    "reviewedAt": {
      "type": ["string", "null"],
      "format": "date-time"
    },
    "reviewNote": {
      "type": ["string", "null"],
      "description": "审核备注"
    },
    "effectiveAt": {
      "type": ["string", "null"],
      "format": "date-time",
      "description": "生效时间（审核通过后自动设置）"
    }
  }
}
```

> **v1.x 说明**：监护权转移在当前纯前端版本以手动确认方式实现，后续服务端版本加入更严格的身份验证和审批流程。

---

### 7. AnonymizedResearchData（脱敏研究数据）

心青年去世后脱敏处理的数据，用于统计研究。

```json
{
  "title": "AnonymizedResearchData",
  "type": "object",
  "required": ["id", "dimension", "value", "sourceCount", "generatedAt"],
  "properties": {
    "id": {
      "type": "string",
      "format": "uuid"
    },
    "dimension": {
      "type": "string",
      "enum": ["age_distribution", "service_needs", "behavior_patterns", "capability_trends", "care_duration", "institution_transitions"],
      "description": "统计维度"
    },
    "value": {
      "type": "object",
      "description": "聚合统计值，维度相关（如 age_distribution: {\"18-25\": 10, \"26-35\": 25}）"
    },
    "sourceCount": {
      "type": "integer",
      "minimum": 0,
      "description": "来源档案数（不可逆追溯，不存储原始 ID）"
    },
    "generatedAt": {
      "type": "string",
      "format": "date-time"
    },
    "period": {
      "type": ["string", "null"],
      "description": "统计周期（如 \"2026-Q3\", \"2026-07\"）"
    }
  }
}
```

---

## Module Sub-Schemas（6 大模块子模型）

### LifePreferences（我喜欢的生活）

```json
{
  "title": "LifePreferences",
  "type": "object",
  "properties": {
    "favoriteActivities": {
      "type": "array",
      "items": { "type": "string" },
      "description": "喜欢的活动列表"
    },
    "favoritePlaces": {
      "type": "array",
      "items": { "type": "string" },
      "description": "想去的地方"
    },
    "futureWishes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "text": { "type": "string" },
          "recordedAt": { "type": "string", "format": "date-time" }
        }
      },
      "description": "未来安置意愿/愿望"
    },
    "dailyRoutine": {
      "type": ["object", "null"],
      "properties": {
        "wakeTime": { "type": "string" },
        "mealTimes": { "type": "array", "items": { "type": "string" } },
        "sleepTime": { "type": "string" }
      },
      "description": "日常作息偏好"
    }
  }
}
```

### CommunicationGuide（沟通说明书）

```json
{
  "title": "CommunicationGuide",
  "type": "object",
  "properties": {
    "preferredMethods": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "method": { "type": "string" },
          "description": { "type": "string" }
        }
      },
      "description": "推荐的沟通方式（如 '使用图片卡', '给 5 秒等待时间', '避免命令语气'）"
    },
    "expressionDifficulties": {
      "type": ["string", "null"],
      "description": "表达困难的描述"
    },
    "specialHabits": {
      "type": "array",
      "items": { "type": "string" },
      "description": "特殊沟通习惯"
    },
    "sensoryPreferences": {
      "type": ["object", "null"],
      "properties": {
        "avoid": { "type": "array", "items": { "type": "string" } },
        "prefer": { "type": "array", "items": { "type": "string" } }
      },
      "description": "感官偏好（听觉/视觉/触觉敏感度）"
    }
  }
}
```

### EmotionBehavior（情绪与行为支持）

```json
{
  "title": "EmotionBehavior",
  "type": "object",
  "properties": {
    "behaviorRedLines": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "description": { "type": "string" },
          "trigger": { "type": ["string", "null"] },
          "response": { "type": "string" },
          "severity": { "type": "string", "enum": ["high", "medium", "low"] }
        }
      },
      "maxItems": 10,
      "description": "行为红线（速读卡核心数据）"
    },
    "emotionTrend": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "date": { "type": "string", "format": "date" },
          "mood": { "type": "string", "enum": ["great", "good", "neutral", "low", "crisis"] },
          "note": { "type": ["string", "null"] }
        }
      },
      "description": "情绪趋势数据点（用于趋势图和速读卡'近期情绪趋势'）"
    },
    "interventionHistory": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "strategy": { "type": "string" },
          "effectiveness": { "type": "string", "enum": ["effective", "partial", "ineffective"] },
          "appliedAt": { "type": "string", "format": "date-time" }
        }
      },
      "description": "行为干预记录"
    }
  }
}
```

### CareMedical（照护与医疗提醒）

```json
{
  "title": "CareMedical",
  "type": "object",
  "properties": {
    "allergies": {
      "type": "array",
      "items": { "type": "string" },
      "description": "过敏源列表"
    },
    "medications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "dosage": { "type": "string" },
          "frequency": { "type": "string" },
          "prescriber": { "type": ["string", "null"] },
          "startDate": { "type": ["string", "null"], "format": "date" },
          "notes": { "type": ["string", "null"] }
        }
      },
      "description": "用药记录"
    },
    "medicalHistory": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "event": { "type": "string" },
          "date": { "type": ["string", "null"], "format": "date" },
          "facility": { "type": ["string", "null"] },
          "notes": { "type": ["string", "null"] }
        }
      },
      "description": "就医/健康事件记录"
    },
    "careNotes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "category": { "type": "string", "enum": ["diet", "sleep", "hygiene", "elimination", "other"] },
          "note": { "type": "string" },
          "recordedAt": { "type": "string", "format": "date-time" }
        }
      },
      "description": "日常照护记录"
    }
  }
}
```

### WorkSupport（工作支持）

```json
{
  "title": "WorkSupport",
  "type": "object",
  "properties": {
    "ispPlans": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "goals": { "type": "array", "items": { "type": "string" } },
          "status": { "type": "string", "enum": ["active", "completed", "paused"] },
          "startDate": { "type": "string", "format": "date" },
          "reviewDate": { "type": ["string", "null"], "format": "date" },
          "notes": { "type": ["string", "null"] }
        }
      },
      "description": "ISP 个体支持计划"
    },
    "capabilityAssessment": {
      "type": ["object", "null"],
      "properties": {
        "socialInteraction": { "type": "integer", "minimum": 1, "maximum": 5 },
        "selfCare": { "type": "integer", "minimum": 1, "maximum": 5 },
        "workSkills": { "type": "integer", "minimum": 1, "maximum": 5 },
        "communityAccess": { "type": "integer", "minimum": 1, "maximum": 5 },
        "communication": { "type": "integer", "minimum": 1, "maximum": 5 },
        "assessedAt": { "type": "string", "format": "date" },
        "assessorId": { "type": "string", "format": "uuid" }
      },
      "description": "能力评估雷达图数据（1-5 分）"
    },
    "workPreferences": {
      "type": "array",
      "items": { "type": "string" },
      "description": "就业偏好（如 '烘焙', '植物养护', '简单手工'）"
    }
  }
}
```

### RelationshipMap（关系地图）

```json
{
  "title": "RelationshipMap",
  "type": "object",
  "properties": {
    "relationships": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "relationType": { "type": "string", "enum": ["parent", "sibling", "teacher", "caregiver", "friend", "colleague", "other"] },
          "importance": { "type": "string", "enum": ["primary", "secondary", "tertiary"] },
          "notes": { "type": ["string", "null"] }
        }
      },
      "description": "重要关系人列表"
    },
    "peerInteractions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "setting": { "type": "string" },
          "behavior": { "type": "string" },
          "observedAt": { "type": "string", "format": "date-time" }
        }
      },
      "description": "同伴互动观察"
    }
  }
}
```

---

## Entity Relationships

```
┌──────────────┐       1:N       ┌──────────────┐
│ YouthProfile │◄────────────────│ ArchiveCode  │
│              │                  └──────────────┘
│              │
│              │       1:N       ┌──────────────┐
│              │◄────────────────│ RecordEntry  │
│              │                  └──────────────┘
│              │                       ▲
│              │                       │ N:1
│              │                  ┌──────────────┐
│              │       1:N       │ UserAccount  │
│              │◄────────────────│              │
│              │                  └──────┬───────┘
│              │                         │
│              │       1:N               │ 1:N
│              │◄────────────────┌───────┴───────┐
│              │                 │ AccessGrant   │
└──────────────┘                 └───────────────┘
        ▲                                ▲
        │ 1:N                            │
┌───────┴───────────┐          ┌─────────┴──────────┐
│ Guardianship      │          │ AnonymizedResearch │
│ Transfer          │          │ Data               │
└───────────────────┘          └────────────────────┘
```

**关系说明**：

| 关系 | 基数 | 说明 |
|------|------|------|
| YouthProfile → ArchiveCode | 1:N | 一个心青年可有多条档案码（补办），但只有一条 `status: active` |
| YouthProfile → RecordEntry | 1:N | 一个心青年可拥有无限条记录 |
| UserAccount → RecordEntry | 1:N | 一个用户可录入多条记录 |
| YouthProfile → AccessGrant | 1:N | 一个心青年可被多人授权访问 |
| UserAccount → AccessGrant | 1:N | 一个用户可被多个心青年授权 |
| YouthProfile → GuardianshipTransfer | 1:N | 一个心青年可有多条转移记录（历史） |
| AnonymizedResearchData ← N YouthProfile | N:1（聚合） | 脱敏数据从多个档案聚合，不可逆追溯 |

---

## Storage Layout（localStorage）

数据以 JSON 对象存储在 localStorage 中，按实体类型分 key：

```text
localStorage keys:
├── ai_dongwo_profiles        → { [youthId]: YouthProfile }
├── ai_dongwo_accounts       → { [accountId]: UserAccount }
├── ai_dongwo_records        → { [youthId]: RecordEntry[] }
├── ai_dongwo_archive_codes  → { [youthId]: ArchiveCode }
├── ai_dongwo_access_grants  → AccessGrant[]
├── ai_dongwo_guardianships  → GuardianshipTransfer[]
├── ai_dongwo_anonymized     → AnonymizedResearchData[]
└── ai_dongwo_current_user   → { accountId, loginAt }
```

**存储层抽象**（参考 research.md 决策 2）：所有读写通过 `storage.js` 统一接口，内部使用 localStorage，后续可替换为 IndexedDB 或 API 调用而不影响上层业务逻辑。

---

## Validation Rules

| 规则 | 实体 | 说明 |
|------|------|------|
| 身份证号唯一 | YouthProfile | 系统全局唯一，重复创建时拒绝 |
| 年龄合法性 | YouthProfile | 出生日期不能晚于当前日期 |
| 角色不变性 | RecordEntry | `recorderRole` 为快照，不受 UserAccount 角色变更影响 |
| 授权有效期 | AccessGrant | 读取时检查 `validUntil`，过期自动标记 `expired` |
| 档案码唯一有效 | ArchiveCode | 同一心青年同时只能有一条 `status: active` |
| 红线上限 | EmotionBehavior | `behaviorRedLines` 最多 10 条 |
| 评分范围 | WorkSupport.capabilityAssessment | 所有维度 1-5 分 |
| 未成年人保护 | YouthProfile | `birthDate` 对应年龄 < 18 时，强制绑定监护人 |
| 脱敏不可逆 | AnonymizedResearchData | 不存储任何原始 ID 或 PII |

---

## Migration Path to Server

当前 v1.x 为纯前端 localStorage 存储。数据模型已为服务端迁移预留：

| v1.x (localStorage) | v2.x (IndexedDB) | v3.x (Server) |
|----------------------|-------------------|---------------|
| JSON 对象序列化 | IndexedDB Object Store | PostgreSQL / MySQL 表 |
| scope 字符串数组 | 同左 | PostgreSQL JSONB |
| PIN + SHA-256 | 同左 | JWT + bcrypt 密码 |
| 前端 HMAC 校验 | 同左 | 服务端 HMAC + 签名校验 |
| 前端模拟聚合 | 同左 | 联邦计算引擎 |
| 手动监护权确认 | 同左 | 审批工作流 API |

**字段命名约定**：所有字段使用 camelCase，与服务端 REST API 的 snake_case 可通过转换层映射。
