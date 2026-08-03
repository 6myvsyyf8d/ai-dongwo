/**
 * constants.js - 全局常量唯一定义源
 * 角色、生命周期状态、页面标题的集中定义
 * 加载顺序：在 utils.js 之后、modules.js 之前
 * 所有模块应复用此处定义，禁止在业务代码中重复硬编码
 */
window.Constants = {
  /**
   * 6 种角色定义（含 label / icon / desc）
   * 与 Auth.ROLES 保持一致，Auth.ROLES 引用此处的值
   */
  ROLES: [
    { value: 'youth', label: '心青年', icon: '🌻', desc: '心青年本人，可记录心情与愿望' },
    { value: 'parent', label: '家长', icon: '👨‍👩‍👧', desc: '家长/监护人，全档案读写与授权管理' },
    { value: 'teacher', label: '老师', icon: '📚', desc: '机构老师，ISP/行为干预/能力评估读写' },
    { value: 'caregiver', label: '影子老师', icon: '🤝', desc: '影子老师，一对一陪伴支持与护理记录' },
    { value: 'government', label: '政府', icon: '🏛️', desc: '政府角色，仅查看宏观趋势看板' },
    { value: 'admin', label: '管理员', icon: '🛡️', desc: '系统管理员，管理用户与全局授权' }
  ],

  /**
   * 角色标签映射（value → label），供只需标签的场景快速查询
   */
  ROLE_LABELS: {
    youth: '心青年',
    parent: '家长',
    teacher: '老师',
    caregiver: '影子老师',
    government: '政府',
    admin: '管理员'
  },

  FAMILY_RELATIONS: {
    father: '父亲',
    mother: '母亲',
    grandfather: '祖父',
    grandmother: '祖母',
    brother: '兄弟',
    sister: '姐妹',
    other_guardian: '其他监护人'
  },

  FAMILY_RELATION_LABELS: ['father', 'mother', 'grandfather', 'grandmother', 'brother', 'sister', 'other_guardian'],

  /**
   * 档案生命周期状态标签
   * 唯一来源：profile.js 与 government.js 均复用此定义
   */
  LIFECYCLE_LABELS: {
    created: '已创建',
    active: '使用中',
    institution_change: '机构变更中',
    guardian_change: '监护转移中',
    supervised: '政府监管中',
    deceased: '已去世',
    anonymized: '已脱敏'
  },

  /**
   * 页面标题映射（page route → 中文标题）
   * app.js 占位符渲染复用此定义
   */
  PAGE_TITLES: {
    dashboard: '主页',
    login: '登录',
    register: '注册',
    profile: '档案详情',
    'archive-code': '档案码',
    records: '记录采集',
    timeline: '时间轴',
    quickcard: '速读卡',
    chat: '对话采集',
    charts: '数据可视化',
    analytics: '数据分析',
    government: '政府看板',
    management: '管理',
    join: '加入申请',
    approvals: '申请审批',
    welcome: '欢迎',
    grants: '授权管理'
  },

  /**
   * 底部导航项（导航短名 + 图标）
   */
  NAV_ITEMS: [
    { page: 'dashboard', icon: '💬', label: 'AI聊聊' },
    { page: 'records', icon: '📋', label: '任务' },
    { page: 'profile', icon: 'icon-profile', label: '档案' },
    { page: 'analytics', icon: 'icon-analytics', label: '分析' },
    { page: 'management', icon: 'icon-management', label: '管理' }
  ],

  /**
   * 管理员专属底部导航
   */
  ADMIN_NAV_ITEMS: [
    { page: 'admin', icon: '🛡️', label: '管理' },
    { page: 'dashboard', icon: '🏠', label: '主页' }
  ],

  /**
   * 记录矩阵 — 模块×类型有效组合
   * key 为模块 key，value 为该模块支持的记录类型 value 数组
   * 仅列出的组合可点击，未列出的组合在矩阵中置灰
   */
  RECORD_MATRIX: {
    emotionBehavior: ['observation', 'daily_care', 'incident', 'preference'],
    communicationGuide: ['observation', 'daily_care', 'incident', 'achievement', 'preference'],
    careMedical: ['observation', 'daily_care', 'incident', 'medical'],
    workSupport: ['observation', 'daily_care', 'incident', 'achievement', 'preference']
  },

  /**
   * 模块快捷标签池 — 按模块动态渲染
   */
  MODULE_TAGS: {
    emotionBehavior: ['平静', '愉悦', '低落', '焦虑', '兴奋', '易怒', '配合', '抗拒'],
    communicationGuide: ['主动表达', '被动回应', '清晰', '模糊', '肢体语言', '辅助沟通'],
    careMedical: ['按时服药', '拒绝服药', '睡眠良好', '睡眠不佳', '食欲正常', '身体不适'],
    workSupport: ['独立完成', '需要提示', '需要协助', '专注', '分心', '完成质量高', '速度正常']
  },

  /**
   * 默认可见性配置 — 角色可见的页面和档案模块
   * 管理员可在管理页调整，存储在 ai_dongwo_visibility_config
   */
  DEFAULT_VISIBILITY_CONFIG: {
    pages: {
      parent:     ['dashboard', 'records', 'profile', 'quickcard', 'management', 'analytics', 'archive-code', 'permissions', 'chat'],
      teacher:    ['dashboard', 'records', 'profile', 'quickcard', 'management', 'analytics', 'teacher-workbench', 'archive-code', 'permissions', 'chat'],
      caregiver:  ['dashboard', 'records', 'profile', 'quickcard', 'management', 'analytics', 'archive-code', 'permissions', 'chat'],
      youth:      ['dashboard', 'profile', 'youth-chat', 'permissions'],
      government: ['government'],
      admin:      ['admin', 'dashboard']
    },
    modules: {
      parent:     ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport'],
      teacher:    ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport'],
      caregiver:  ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport'],
      youth:      ['communicationGuide', 'careMedical'],
      government: [],
      admin:      ['communicationGuide', 'emotionBehavior', 'careMedical', 'workSupport']
    }
  }
};
