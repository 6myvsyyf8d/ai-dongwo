# Tasks: AI懂我 - 全生涯数据灯塔

**Input**: Design documents from `/specs/001-lifelong-archive/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: 手动测试清单（spec.md SC-001 至 SC-010），不生成自动化测试任务

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `js/`, `css/`, `index.html` at repository root
- Paths follow plan.md project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 项目初始化，创建目录结构和基础设施文件

- [ ] T001 Create project directory structure: create `js/`, `css/`, `assets/icons/`, `assets/fonts/` directories per plan.md
- [ ] T002 [P] Create `index.html` with script/link references to all JS and CSS modules, basic HTML5 boilerplate, viewport meta, Noto Sans SC font import
- [ ] T003 [P] Create `css/main.css` with CSS custom properties (color palette, spacing, typography scale), CSS reset, global layout styles, `@media print` base rules
- [ ] T004 [P] Download and place qrcode.js library file in `js/lib/qrcode.min.js`
- [ ] T005 [P] Download and place Chart.js library file in `js/lib/chart.min.js`
- [ ] T006 [P] Download and place html2pdf.js library file in `js/lib/html2pdf.min.js`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 核心基础设施——所有 User Story 都依赖的底层模块

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T007 Implement `js/utils.js`: UUID v4 generation, date formatting (ISO date-time), PIN hash (SHA-256 with salt 'ai-dongwo-salt'), Chinese ID number validation (pattern + checksum per GB 11643-1999), age calculation from birthDate
- [ ] T008 Implement `js/storage.js` per contracts/storage-interface.md: Storage global object with get/set/remove/getProfiles/saveProfile/getAccounts/saveAccount/getRecords/addRecord/updateRecord/deleteRecord/getArchiveCode/saveArchiveCode/getAccessGrants/addAccessGrant/revokeAccessGrant/getGuardianshipTransfers/addGuardianshipTransfer/getCurrentUser/setCurrentUser/clearCurrentUser methods. Include localStorage key constants (ai_dongwo_profiles, ai_dongwo_accounts, etc.), ID number uniqueness validation in saveProfile, automatic updatedAt setting, initTestData() with fictional test data (小雨: female, 1998-03-15, idNumber 210202199803152048; 小明: male, 2000-08-22, idNumber 210202200008221537)
- [ ] T009 Implement `js/state.js` per contracts/state-interface.md: AppState global object with state shape (currentUser, isLoggedIn, currentYouth, currentYouthRecords, currentPage, pageParams, isLoading, toastMessage, currentGrants, canRead, canWrite, canManage, _listeners), methods: init(), login(), logout(), selectYouth(), navigate(), showToast(), on(), off(). Event system must support onStateChange, onNavigate, onLogin, onLogout, onYouthChanged
- [ ] T010 Implement `js/app.js`: hash-based SPA router listening to window.hashchange, page rendering dispatcher (showLogin, showDashboard, showProfile, showRecords, showTimeline, showQuickcard, showChatbot, showCharts, showGovernment), module initialization order (utils → storage → state → auth → ...), AppState.init() on DOMContentLoaded, AppState.onNavigate listener that calls correct page render function
- [ ] T011 Implement `js/permissions.js` per contracts/permissions-interface.md: Permissions global object with refresh(youthId), canRead(module?), canWrite(module), canManage(), grantAccess(youthId, granteeId, granteeRole, validUntil?), revokeAccess(grantId, reason), checkRecordVisibility(record), checkExpired(), getAccessibleYouths(), initGuardianshipTransfer(youthId, toGuardianId, proof?). Include default scope templates per role (parent, teacher, caregiver, volunteer), role-based read/write/manage rules per data-model.md AccessGrant section

**Checkpoint**: Foundation ready - all global modules (Storage, AppState, Permissions, Utils, Router) functional. Can register accounts and create profiles via console.

---

## Phase 3: User Story 1 - 心青年档案创建与档案码生成 (Priority: P1) 🎯 MVP

**Goal**: 心青年注册、终身档案创建、二维码档案码生成与打印——"点亮灯塔"

**Independent Test**: 注册测试心青年"小雨"，填写信息，验证档案码生成且可被扫码读取，档案数据完整持久化到 localStorage

### Implementation for User Story 1

- [ ] T012 [P] [US1] Create `css/auth.css` with login/register page styles: role selection grid (6 roles with icons), form inputs, PIN input (4-6 digit), responsive layout for mobile
- [ ] T013 [P] [US1] Create `css/profile.css` with profile page styles: profile header (name, age, gender, avatar), module navigation tabs (6 modules), emergency contact card, archive code display area
- [ ] T014 [US1] Implement `js/auth.js`: 6-role registration flow (role selection → name/phone/institution → PIN setup → account creation via Storage.saveAccount), PIN login (hash comparison via utils.hashPin), login form UI rendering, AppState.login() integration, register page UI rendering. Include role-specific fields (teacher: institutionName required). Handle duplicate name+role validation
- [ ] T015 [US1] Implement `js/profile.js`: YouthProfile CRUD — create profile form (name, gender, birthDate, idNumber with validation), Storage.saveProfile with ID_NUMBER_EXISTS error handling, profile detail view rendering, profile edit form, emergency contacts management (add/remove EmergencyContact), lifecycle status display. For youth < 18 years old, enforce guardian binding (currentGuardianId required)
- [ ] T016 [US1] Implement `js/archive-code.js`: Generate QR code using qrcode.js (codeUrl format: `{origin}/archive/{youthId}?token={HMAC-SHA256}`, HMAC with random secret), save ArchiveCode via Storage.saveArchiveCode (auto-revoke previous codes), QR image display, card print layout (name + QR code + "AI懂我 全生涯数字档案码" text), `window.print()` for physical card printing. Include archive code re-generation flow (mark old revoked, create new)
- [ ] T017 [US1] Wire US1 pages into app.js router: add `#register`, `#login`, `#profile`, `#archive-code` routes, integrate auth.js/profile.js/archive-code.js render functions, add navigation guard (redirect to login if not authenticated)

**Checkpoint**: MVP complete — User can register as youth/parent, create profile, generate and print archive code QR. Validate via SC-001 (profile creation in 3 minutes without training).

---

## Phase 4: User Story 2 - 多角色记录采集 (Priority: P1)

**Goal**: 家长、老师、照护者、志愿者各自针对同一心青年录入不同类型的记录，自动标注角色和时间戳

**Independent Test**: 用 4 种角色分别登录，针对同一心青年录入不同记录，验证记录均带角色时间戳且按角色分类展示

### Implementation for User Story 2

- [ ] T018 [P] [US2] Create `css/records.css` with record entry form styles: module selector (6 modules as tabs), record type dropdown (observation/intervention/assessment/daily_care/isp_plan/activity_log/mood_check/wish/chatbot_captured), text area, tag input, visibility level selector, role badge display
- [ ] T019 [US2] Implement `js/records.js` — Record creation flow: record entry form with module selector (maps to 6 module enums), recordType dropdown, content.text input, content.tags (auto-suggest from existing tags), visibilityLevel selector (full/safety_only/private with role-based defaults), submit via Storage.addRecord with auto-generated UUID and recordedAt timestamp, record list display grouped by module with role badge and timestamp. Include permission checks (Permissions.canWrite(module)) before showing write forms, filter records by Permissions.checkRecordVisibility()
- [ ] T020 [US2] Implement role-based record scope in `js/permissions.js` integration: parent can write all modules, teacher can write communicationGuide/emotionBehavior/workSupport/careMedical, caregiver can write careMedical only, volunteer can write relationshipMap only. Enforce scope restrictions in records.js form (disable non-writable modules)
- [ ] T021 [US2] Implement duplicate event handling: when same event recorded by multiple roles, keep as independent RecordEntry objects with distinct recorderRole and recorderId, display side-by-side in record list with "同日记录" grouping indicator
- [ ] T022 [US2] Wire US2 pages into app.js router: add `#records` route, integrate records.js render functions, add module-level tab navigation within records page

**Checkpoint**: Multi-role recording functional — validate via SC-003 (100% correct role/timestamp annotation, no cross-role leakage). Parent can authorize teacher/caregiver/volunteer and they can write within scope.

---

## Phase 5: User Story 3 - 3 分钟速读卡生成 (Priority: P1)

**Goal**: 从档案自动提取关键信息生成可打印的 A4 单页速读卡——"投射光束"

**Independent Test**: 为已有多条记录的心青年生成速读卡，验证关键信息提取准确、一页内可打印、新接手者能说出 3 条以上注意事项

### Implementation for User Story 3

- [ ] T023 [P] [US3] Create `css/quickcard.css` with quickcard styles: A4-optimized layout (210mm × 297mm ratio), print media query (@media print { body * { display: none } .quickcard-container { display: block } }), section dividers, red-line warning styling (⚠ icon + red border), mini chart area for mood trend
- [ ] T024 [US3] Implement `js/quickcard.js` per contracts/quickcard-interface.md: QuickCard.generate(youthId) with extraction algorithm — communication methods from modules.communicationGuide.preferredMethods (max 5), behavior red lines from modules.emotionBehavior.behaviorRedLines sorted by severity (max 5, supplement from recent observation records if < 3), emergency contacts from emergencyContacts, recent mood trend from emotionBehavior.emotionTrend (last 7 days), recent alerts from allergies + recent medications + daily_care records with '异常'/'注意' tags. Permission-aware: volunteer/caregiver see safety_only level only
- [ ] T025 [US3] Implement QuickCard.render(data, container): DOM rendering with A4 layout (header: name/age/gender, section 1: communication methods, section 2: behavior red lines with severity icons, section 3: emergency contacts, section 4: recent mood mini-chart using Chart.js line chart, section 5: recent alerts list, footer: generatedAt + archiveCodeId)
- [ ] T026 [US3] Implement QuickCard.print(container): trigger window.print() with CSS print rules isolating quickcard container. Implement QuickCard.exportPDF(container): html2pdf.js integration with A4 format, filename pattern `速读卡_{name}_{date}.pdf`
- [ ] T027 [US3] Wire US3 pages into app.js router: add `#quickcard` route, add "生成速读卡" button on profile page, integrate quickcard.js render/print/export functions

**Checkpoint**: Quickcard functional — validate via SC-002 (new caregiver can state 3+ red lines and 1 communication method after 5-min read) and SC-005 component (generation < 3s for 1000+ records profile).

---

## Phase 6: User Story 4 - 角色权限与数据生命周期 (Priority: P2)

**Goal**: 6 种角色的权限差异化管理、授权管理、权限自动回收、监护权转移

**Independent Test**: 模拟机构老师服务期满、家长监护权转移、志愿者活动结束三种场景，验证权限自动回收和数据保留

### Implementation for User Story 4

- [ ] T028 [US4] Implement access grant management UI in `js/permissions.js`: parent/grantor can view current grants for a youth, create new grant (select grantee from registered accounts, select role, set validUntil), revoke existing grant with reason. Render grant list with status badges (active/expired/revoked/pending_approval)
- [ ] T029 [US4] Implement permission expiry automation: on AppState.init() and AppState.selectYouth(), call Permissions.checkExpired() to auto-mark expired grants, update UI to show expired status, prevent expired users from accessing data
- [ ] T030 [US4] Implement guardianship transfer UI: parent can initiate transfer (select new guardian from registered parent accounts, provide proof description), review status display (pending/approved/rejected), effective date display. On approval: update YouthProfile.currentGuardianId, revoke old parent's manage:grants, grant new parent full permissions
- [ ] T031 [US4] Implement lifecycle status transitions in `js/profile.js`: support status changes (created→active, active→institution_change, active→deceased, deceased→anonymized). For deceased: trigger anonymization flow (remove all PII from profile, move to AnonymizedResearchData with aggregate stats). Status change requires confirmation dialog
- [ ] T032 [US4] Add permission-aware UI guards across all pages: hide write buttons for non-writable modules, show "权限不足" message for restricted views, redirect unauthorized access attempts to dashboard

**Checkpoint**: Permission lifecycle functional — validate via SC-007 (expiry within 24h) and SC-008 (guardianship transfer within 3 days).

---

## Phase 7: User Story 5 - 记录时间轴与分类检索 (Priority: P2)

**Goal**: 所有角色的记录按时间倒序汇聚成时间轴，支持按角色、模块、时间范围筛选

**Independent Test**: 为有多角色记录的心青年查看时间轴，验证按角色/模块/时间筛选均准确

### Implementation for User Story 5

- [ ] T033 [P] [US5] Create `css/timeline.css` with timeline styles: vertical timeline with left-aligned date markers, role color-coded badges (parent=blue, teacher=green, caregiver=orange, volunteer=purple), filter bar (role dropdown, module dropdown, date range picker), virtual scroll container for performance
- [ ] T034 [US5] Implement `js/timeline.js`: fetch records via Storage.getRecords(youthId) (already sorted by recordedAt desc), render timeline with role badges and module tags, filter controls (role multi-select, module multi-select, date range), virtual scroll for 1000+ records (render only visible items in viewport + buffer), apply Permissions.checkRecordVisibility() to each record for access control. Include record count display and "无匹配记录" empty state
- [ ] T035 [US5] Wire US5 pages into app.js router: add `#timeline` route, add "时间轴" tab in profile navigation, integrate timeline.js render and filter functions

**Checkpoint**: Timeline functional — validate via SC-009 (1000+ records load in < 2s with virtual scroll).

---

## Phase 8: User Story 7 - 对话式信息采集 (Priority: P2)

**Goal**: AI 引导式对话提问，实时将回答分类归档到对应模块——降低录入门槛

**Independent Test**: 用家长角色发起对话采集，回答 5 个问题，验证信息被正确分类到对应模块

### Implementation for User Story 7

- [ ] T036 [P] [US7] Create `css/chatbot.css` with chatbot styles: chat bubble layout (user right, AI left), typing indicator animation, real-time classification panel on right side (split view on desktop, toggle on mobile), module category pills showing classification results
- [ ] T037 [US7] Implement `js/chatbot.js` — keyword-based classification engine per research.md decision 5: predefined question templates per module (sleep/diet/emotion → careMedical; mood/frustration/happy → emotionBehavior; work/baking/task → workSupport; friends/places/wishes → lifePreferences; expression difficulty/habits → communicationGuide), keyword matching rules with Chinese keyword dictionary, real-time classification display panel showing matched module + confidence. Chat flow: opening question → user response → classify → next question (max 10 rounds). On confirm: batch create RecordEntry objects via Storage.addRecord with recordType 'chatbot_captured' and recorderRole from AppState.currentUser
- [ ] T038 [US7] Wire US7 pages into app.js router: add `#chat` route, add "对话采集" button on records page, integrate chatbot.js chat UI and classification panel

**Checkpoint**: Chatbot functional — validate via SC-006 (5 rounds classify 3+ modules with ≥90% accuracy).

---

## Phase 9: User Story 6 - 政府宏观趋势看板 (Priority: P3)

**Goal**: 政府角色查看脱敏聚合的宏观趋势看板——"照亮群体"

**Independent Test**: 用政府角色登录，验证看板仅显示聚合数据，无法触达个体档案

### Implementation for User Story 6

- [ ] T039 [P] [US6] Create `css/government.css` with government dashboard styles: card grid layout for stat panels, Chart.js chart containers (bar chart for age distribution, pie chart for service needs, horizontal bar for resource gaps), muted professional color scheme, "数据安全" badge
- [ ] T040 [US6] Implement `js/government.js`: aggregate statistics via local iteration of all profiles/records (age distribution: group by decade, service needs: count records tagged with '需求', resource gaps: compare supply vs demand indicators), render dashboard with Chart.js charts, enforce zero-individual-contact rule (no youthId displayed anywhere, no clickable drill-down, error message "个体档案受数据主权保护"), generate monthly report summary (new profiles count, age distribution, top 3 needs, resource suggestions)
- [ ] T041 [US6] Wire US6 pages into app.js router: add `#government` route, restrict to government role only (other roles see "权限不足"), integrate government.js dashboard rendering

**Checkpoint**: Government dashboard functional — validate via SC-005 (100+ profiles aggregate in < 5s) and FR-014 (zero individual data leakage, penetration-test verified).

---

## Phase 10: User Story - 数据可视化 (Priority: P2, from FR-015)

**Goal**: 情绪曲线、行为趋势、能力评估雷达图

**Independent Test**: 查看有心青年的情绪曲线和雷达图，验证数据准确渲染

### Implementation for Data Visualization

- [ ] T042 [P] Create `css/charts.css` with chart page styles: chart container cards, time period selector, chart type tabs (line/bar/radar), responsive grid
- [ ] T043 Implement `js/charts.js`: emotion trend line chart (Chart.js line, data from emotionBehavior.emotionTrend, x-axis: date, y-axis: mood score mapping great=5, good=4, neutral=3, low=2, crisis=1), capability assessment radar chart (Chart.js radar, 5 dimensions: socialInteraction/selfCare/workSkills/communityAccess/communication, scale 1-5 from workSupport.capabilityAssessment), behavior trend bar chart (intervention effectiveness summary). All charts read from currentYouth via AppState, respect Permissions.canRead()
- [ ] T044 Wire charts into app.js router: add `#charts` route, add "数据可视化" tab in profile navigation

**Checkpoint**: Charts functional — emotion curve, radar chart, and behavior trends render accurately.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: UI 文案审核、无障碍、整体优化

- [ ] T045 [P] WCAG 2.1 AA audit: ensure all interactive elements have visible focus indicators, all images have alt text, form inputs have associated labels, color contrast meets 4.5:1 ratio, keyboard navigation works for all core flows (Tab through login → profile → records → quickcard)
- [ ] T046 [P] UI copy review: scan all UI text for labeling/discriminatory language (no "自闭症" as label, use "心青年"; no "残障" in UI, use appropriate terms per Constitution IV). Verify emoji usage is respectful. Ensure consent/authorization prompts are clear
- [ ] T047 [P] Error handling polish: add user-friendly error messages for all Storage operations (quota exceeded, corrupted data), network error handling for CDN-loaded libraries, graceful degradation if Chart.js/html2pdf.js fails to load
- [ ] T048 Validate against quickstart.md: run through all 8 development steps, verify each step produces expected output, test with fictional data (小雨, 小明), confirm all Constitution compliance checklist items pass
- [ ] T049 Performance optimization: lazy-load Chart.js and html2pdf.js (only when charts/quickcard page is accessed), debounce search/filter inputs in timeline, cache QR code image data in ArchiveCode.qrImageData to avoid regeneration

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **User Stories (Phase 3-10)**: All depend on Phase 2 completion
  - US1 (Phase 3) must complete first — it creates the profile that all other stories reference
  - US2 (Phase 4) can start after US1 — needs profiles to record against
  - US3 (Phase 5) can start after US2 — needs records to extract quickcard data
  - US4 (Phase 6) can start after US2 — needs records and grants to manage
  - US5 (Phase 7) can start after US2 — needs records to display in timeline
  - US7 (Phase 8) can start after US2 — needs records module to save chatbot output
  - US6 (Phase 9) can start after US1 — only needs profiles for aggregation (independent of records)
  - Charts (Phase 10) can start after US2 — needs emotion/capability data
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL
    ↓
Phase 3: US1 (档案创建) ← MVP 🎯
    ↓
Phase 4: US2 (多角色记录) ← CORE
   ↙     ↘     ↘
Phase 5:US3   Phase 7:US7   Phase 6:US4
(速读卡)      (对话采集)     (权限管理)
   ↘     ↙
Phase 10: Charts (数据可视化)

Phase 9: US6 (政府看板) ← independent, only needs US1
    ↓
Phase 11: Polish
```

### Within Each User Story

- CSS files can be created in parallel with each other [P]
- Core logic (JS) depends on CSS being available
- Router wiring (app.js) depends on all JS modules being ready
- Story complete before moving to next priority

### Parallel Opportunities

- T002, T003, T004, T005, T006: All setup CSS/HTML/lib tasks can run in parallel
- T012, T013: US1 CSS tasks can run in parallel
- T018: US2 CSS can run in parallel with US2 JS
- T023: US3 CSS can run in parallel with US3 JS
- T033: US5 CSS can run in parallel with US5 JS
- T036: US7 CSS can run in parallel with US7 JS
- T039: US6 CSS can run in parallel with US6 JS
- T042: Charts CSS can run in parallel with Charts JS
- T045, T046, T047, T049: All polish tasks can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch CSS tasks together:
Task: "T012 [P] [US1] Create css/auth.css"
Task: "T013 [P] [US1] Create css/profile.css"

# Then sequentially (each depends on previous):
Task: "T014 [US1] Implement js/auth.js"
Task: "T015 [US1] Implement js/profile.js"
Task: "T016 [US1] Implement js/archive-code.js"
Task: "T017 [US1] Wire US1 pages into app.js router"
```

## Parallel Example: Post-US2 (maximum parallelism)

```bash
# These can all run simultaneously after US2 is complete:
Task: "T023 [P] [US3] Create css/quickcard.css" + "T024 [US3] Implement js/quickcard.js"
Task: "T033 [P] [US5] Create css/timeline.css" + "T034 [US5] Implement js/timeline.js"
Task: "T036 [P] [US7] Create css/chatbot.css" + "T037 [US7] Implement js/chatbot.js"
Task: "T039 [P] [US6] Create css/government.css" + "T040 [US6] Implement js/government.js"
Task: "T042 [P] Create css/charts.css" + "T043 Implement js/charts.js"
Task: "T028-T032 [US4] Implement permission management UI"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T006)
2. Complete Phase 2: Foundational (T007-T011)
3. Complete Phase 3: User Story 1 (T012-T017)
4. **STOP and VALIDATE**: 注册心青年、创建档案、生成并打印档案码
5. Deploy/demo if ready — **灯塔已点亮**

### Core Delivery (US1 + US2 + US3)

1. MVP (above)
2. Complete Phase 4: US2 — 多角色记录采集 → **灯塔开始蓄光**
3. Complete Phase 5: US3 — 速读卡生成 → **灯塔投射光束**
4. **STOP and VALIDATE**: 4 种角色录入记录，生成速读卡，新接手者 5 分钟知道怎么相处
5. This is the **minimum useful product** for the care scenario

### Full Delivery (All Stories)

1. Core Delivery (above)
2. Phase 6: US4 (权限生命周期) → Phase 7: US5 (时间轴) → Phase 8: US7 (对话采集)
3. Phase 9: US6 (政府看板) → Phase 10: Charts (可视化)
4. Phase 11: Polish (无障碍、文案审核、性能优化)
5. **Final VALIDATE**: Run all 10 success criteria from spec.md

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Use fictional test data only (小雨, 小明) — never real person info
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- All tasks reference concrete file paths per plan.md project structure
- Total: 49 tasks across 11 phases, 7 user stories
