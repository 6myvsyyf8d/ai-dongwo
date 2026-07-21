/**
 * ============================================================
 * AI懂我 - 心智障碍者动态可视化支持档案
 * 小雨虚拟案例原型 v2.0 - 多角色协同记录系统
 * 主应用脚本 app.js
 * ============================================================
 * 功能模块：
 *   1. 数据定义（小雨案例数据）
 *   2. 数据层（DataStore - localStorage持久化）
 *   3. 角色系统（多角色协同）
 *   4. 路由系统（Hash路由SPA切换）
 *   5. 页面渲染函数（各模块DOM渲染）
 *   6. 速读卡弹窗（多版本切换 & 打印）
 *   7. 隐私分级（角色权限控制）
 *   8. 对话式采集（AI与家长对话采集信息）
 *   9. 记录系统（添加、查看、筛选记录）
 *   10. 初始化（DOMContentLoaded启动）
 * ============================================================
 */

(function () {
  'use strict';

  /* ==========================================================
   * 一、数据定义 —— 小雨案例全部数据
   * ========================================================== */

  /** 小雨基本信息 */
  const basicInfo = {
    name: '小雨',
    age: 24,
    gender: '男',
    intro: '喜欢烘焙、对公交车路线了如指掌的安静男孩',
    communication: '短句为主 · 需要耐心等待'
  };

  /** 喜欢的事物 */
  const likesList = [
    { icon: '🍪', title: '烘焙', desc: '能独立做曲奇和杯子蛋糕，过程很专注' },
    { icon: '🚌', title: '公交车', desc: '对本市公交线路非常熟悉，能说出每条线路经过哪些站' },
    { icon: '🎹', title: '弹琴', desc: '在机构学了几个月电子琴，能弹简单旋律' },
    { icon: '🐱', title: '动物', desc: '特别喜欢猫，看到猫会主动靠近' }
  ];

  /** 不喜欢的事物 */
  const dislikesList = [
    { icon: '🔄', title: '突然改变计划', desc: '会感到不安和焦虑' },
    { icon: '🔊', title: '很吵的环境', desc: '商场、装修声让他不适' },
    { icon: '⏰', title: '被催促"快点"', desc: '会增加焦虑感' },
    { icon: '🦐', title: '海鲜（过敏）', desc: '虾、蟹、贝类——严禁食用' },
    { icon: '🚫', title: '被不打招呼碰身体', desc: '需要先沟通再接触' }
  ];

  /** 沟通说明书 */
  const communicationGuide = {
    best: [
      '短句、慢一点、一次说一件事',
      '给他反应时间，不要催',
      '用他熟悉的事物举例（公交车、烘焙）',
      '提前告诉他接下来要做什么'
    ],
    caution: [
      '语速稍慢，给他反应时间',
      '重要的事提前说、重复确认',
      '用"先...然后..."说流程',
      '用熟悉的例子打比方'
    ],
    avoid: [
      '一次说很多件事',
      '语速太快、很着急',
      '反问句、讽刺、开玩笑',
      '说"你怎么连这个都不懂"',
      '焦虑时追问"你到底怎么了"'
    ]
  };

  /** 情绪与行为支持 */
  const emotionSupport = {
    triggers: [
      '环境太吵、人太多',
      '计划突然改变',
      '被催促"快点"',
      '被不打招呼碰',
      '做事被打断'
    ],
    warnings: [
      '说话开始重复',
      '捂耳朵、抓头发',
      '来回踱步',
      '突然不说话',
      '找借口要离开'
    ],
    soothing: [
      '带到安静的地方',
      '给 5 分钟独处，不要追问',
      '用简单的选择帮他恢复控制感："你想喝水还是坐着？"',
      '不要试图在焦虑中跟他讲道理',
      '恢复后自然过渡，不要过度关注'
    ],
    crisis: [
      '如果出现自伤或攻击行为',
      '立即确保环境安全',
      '通知负责人和紧急联系人',
      '记录事件经过'
    ]
  };

  /** 照护与医疗提醒 */
  const careInfo = {
    allergy: { items: '虾、蟹、贝类', level: '严禁接触' },
    medicine: '无',
    checkup: '年度体检',
    special: '对嘈杂环境敏感',
    sleep: '晚上10点前入睡'
  };

  /** 工作支持 */
  const workInfo = {
    canDo: ['包装', '清洁', '按步骤完成任务'],
    needSupport: ['理解新任务指令', '应对变化'],
    avoid: ['不要安排需要快速反应的工作']
  };

  /** 日常作息时间轴 */
  const dailyRoutine = [
    { time: '08:30', title: '起床洗漱', activity: '自己刷牙洗脸，穿好衣服', support: '提醒时间即可，不需催促', risk: 'green', reminder: '' },
    { time: '09:00', title: '早餐', activity: '喜欢吃面包和牛奶', support: '提前摆好餐具', risk: 'green', reminder: '注意过敏：不能有海鲜成分' },
    { time: '09:30', title: '自由时间', activity: '看书、拼图或听音乐', support: '提供安静的空间', risk: 'green', reminder: '' },
    { time: '10:00', title: '机构活动', activity: '手工课/音乐课/生活技能训练', support: '提前说明今天做什么', risk: 'green', reminder: '提前一天告知行程安排' },
    { time: '11:30', title: '午餐', activity: '在机构或回家吃午饭', support: '避免突然更换菜单', risk: 'yellow', reminder: '检查食物有无海鲜成分' },
    { time: '12:30', title: '午休', activity: '安静休息或听轻音乐', support: '保持环境安静', risk: 'green', reminder: '' },
    { time: '13:30', title: '下午活动', activity: '烘焙练习/社区散步/电子琴', support: '鼓励参与但允许不参加', risk: 'yellow', reminder: '外出时避开嘈杂场所' },
    { time: '15:00', title: '自由时间', activity: '看公交车线路图、画画', support: '不强求社交互动', risk: 'green', reminder: '' },
    { time: '16:00', title: '支持性就业准备', activity: '模拟工作场景练习', support: '用步骤卡片辅助理解', risk: 'yellow', reminder: '新任务需要提前讲解' },
    { time: '17:30', title: '晚餐', activity: '和家人一起吃饭', support: '饭桌上不追问他今天做了什么', risk: 'green', reminder: '' },
    { time: '18:30', title: '晚间放松', activity: '看电视、听音乐或散步', support: '尊重他的选择', risk: 'green', reminder: '' },
    { time: '20:00', title: '洗漱准备', activity: '洗澡、准备睡觉', support: '提前10分钟提醒', risk: 'green', reminder: '水温要适中' },
    { time: '20:30', title: '睡前安静时间', activity: '听轻音乐或翻翻喜欢的书', support: '调暗灯光', risk: 'green', reminder: '' },
    { time: '21:00', title: '入睡', activity: '关灯睡觉', support: '保持房间安静', risk: 'green', reminder: '' },
    { time: '21:30', title: '夜班照护', activity: '家长确认入睡', support: '注意有无异常', risk: 'red', reminder: '夜间如情绪波动及时安抚' }
  ];

  /** 关系地图 */
  const relationsInfo = {
    core: [
      { name: '妈妈', role: '法定支持人', emoji: '👩' },
      { name: '爸爸', role: '法定支持人', emoji: '👨' },
      { name: '李老师', role: '机构老师', emoji: '👩‍🏫' }
    ],
    daily: [
      { name: '同事小王', role: '工作伙伴', emoji: '👷' },
      { name: '邻居阿姨', role: '邻居', emoji: '👵' }
    ],
    avoid: [
      '太热情、说话太快的陌生人',
      '一上来就想抱他、摸他头的人',
      '人多嘈杂的聚会',
      '推销、募捐、强迫说话的场景'
    ]
  };

  /** 速读卡版本配置 */
  const quickCardVersions = {
    standard: {
      label: '标准版',
      target: '家长/法定支持人',
      sections: [
        { title: '关于小雨', type: 'blue', items: ['24岁，安静男孩', '喜欢烘焙、公交车、弹琴、猫', '沟通：短句为主，需要耐心等待'] },
        { title: '怎样沟通', type: 'green', items: ['短句、慢一点、一次说一件事', '给他反应时间，不要催', '可以聊公交车或烘焙', '提前告诉他接下来要做什么'] },
        { title: '绝对不要做', type: 'red', items: ['不要突然拍他肩膀、碰他', '不要催他"快点"', '不要给他吃海鲜', '不要一次说很多件事'] },
        { title: '焦虑时怎么办', type: 'yellow', items: ['看到捂耳朵、来回走就是信号', '带到安静地方，给5分钟独处', '不要追问"你怎么了"', '用简单选择恢复控制感'] },
        { title: '紧急联系人', type: 'blue', items: ['妈妈 138-xxxx-xxxx', '爸爸 139-xxxx-xxxx', '李老师（机构） 010-xxxx-xxxx'] }
      ]
    },
    teacher: {
      label: '教师版',
      target: '机构老师',
      sections: [
        { title: '小雨在课堂', type: 'blue', items: ['需要提前说明课程安排', '喜欢有步骤的任务', '能专注做手工和音乐'] },
        { title: '安全红线', type: 'red', items: ['食物严格排除海鲜成分', '情绪波动时不要追问', '环境噪音过大时及时调整'] },
        { title: '教学建议', type: 'green', items: ['用"先...然后..."说明流程', '新任务需要步骤卡片辅助', '允许他按自己的节奏完成'] },
        { title: '预警信号', type: 'yellow', items: ['说话重复、捂耳朵、来回踱步', '突然沉默、找借口离开'] }
      ]
    },
    volunteer: {
      label: '志愿者版',
      target: '新接触小雨的志愿者',
      sections: [
        { title: '认识小雨', type: 'blue', items: ['24岁，安静的男孩', '喜欢猫、音乐、烘焙'] },
        { title: '最重要的三条', type: 'red', items: ['不碰海鲜（他过敏）', '不要催他"快点"', '不要不打招呼碰他'] },
        { title: '和他相处', type: 'green', items: ['说话慢一点、一次说一件事', '给他反应时间', '安静陪伴就好'] },
        { title: '如果他紧张', type: 'yellow', items: ['不要追问"怎么了"', '保持安静，给他空间', '告诉附近的老师或家长'] }
      ]
    },
    institution: {
      label: '机构概览版',
      target: '机构管理人员',
      sections: [
        { title: '学员概况', type: 'blue', items: ['姓名：小雨，24岁', '沟通方式：短句、需要反应时间', '支持需求：理解指令、应对变化'] },
        { title: '医疗与安全', type: 'red', items: ['海鲜过敏（严禁接触）', '嘈杂环境敏感', '夜间照护需确认情绪稳定'] },
        { title: '就业方向', type: 'green', items: ['适合：包装、清洁、步骤型任务', '需要：指令分步说明', '避免：快速反应类工作'] },
        { title: '应急联系人', type: 'yellow', items: ['妈妈（法定支持人）', '爸爸（法定支持人）', '李老师（机构负责老师）'] }
      ]
    }
  };

  /** 隐私分级配置
   *  A = 仅家长可见
   *  B = 家长 + 机构 + 老师
   *  C = 家长 + 机构 + 老师 + 志愿者
   *  D = 所有人可见（含外部演示）
   */
  const privacyLevels = {
    self:      ['A', 'B', 'C', 'D'],
    parent:    ['A', 'B', 'C', 'D'],
    teacher:   ['B', 'C', 'D'],
    caregiver: ['B', 'C', 'D'],
    volunteer: ['C', 'D']
  };

  /** 角色名称映射（中文） */
  const roleLabels = {
    self: '心青年本人',
    parent: '家长',
    teacher: '老师',
    caregiver: '护理员',
    volunteer: '志愿者'
  };

  /** 对话式采集预设脚本 */
  const chatScript = [
    {
      step: 0,
      aiMessage: '您好！我是"AI懂我"档案助手。我会通过几个简单的问题帮您建立支持档案。我们先从基本信息开始吧！',
      options: ['好的，开始吧', '我先了解一下流程'],
      userReply: null
    },
    {
      step: 1,
      aiMessage: '请告诉我，您要为谁建立支持档案？他/她的名字是什么？',
      options: ['我叫小雨，24岁，男性', '我叫小明，20岁，女性'],
      userReply: null
    },
    {
      step: 2,
      aiMessage: '好的！{name}平时最喜欢做什么呢？可以举几个例子。',
      options: ['喜欢烘焙、公交车、弹琴、猫', '喜欢画画、拼图、听音乐'],
      userReply: null
    },
    {
      step: 3,
      aiMessage: '那有什么事情是{name}特别不喜欢或者会让他/她不舒服的？',
      options: ['突然改变计划、很吵的环境、被催促', '人多的时候、强光、某些声音'],
      userReply: null
    },
    {
      step: 4,
      aiMessage: '非常重要的信息：{name}有没有食物过敏或需要特别注意的医疗事项？',
      options: ['海鲜过敏（虾、蟹、贝类）——严禁接触', '没有过敏，但有癫痫需要服药'],
      userReply: null
    },
    {
      step: 5,
      aiMessage: '和{name}沟通时，什么方式最有效？有什么需要特别注意的吗？',
      options: ['短句、慢一点、一次说一件事，给反应时间', '用图片辅助理解，避免复杂指令'],
      userReply: null
    },
    {
      step: 6,
      aiMessage: '{name}在什么情况下容易情绪波动？情绪波动时有什么表现？',
      options: ['环境太吵、计划改变、被催促时会焦虑', '被批评、做不好事情时会沮丧'],
      userReply: null
    },
    {
      step: 7,
      aiMessage: '最后一个问题：{name}身边有哪些重要的照顾者或支持者？',
      options: ['爸爸妈妈（法定支持人），李老师（机构老师）', '妈妈和外婆，社区社工小刘'],
      userReply: null
    },
    {
      step: 8,
      aiMessage: '太好了！我已经收集了所有关键信息。正在为您生成"AI懂我"支持档案...\n\n档案已经生成完毕！您可以在首页查看小雨的完整支持档案，也可以打开速读卡分享给老师或志愿者。',
      options: [],
      userReply: null
    }
  ];

  /* ==========================================================
   * 二、角色系统配置
   * ========================================================== */

  /** 多角色配置 - 定义各角色的权限和信息 */
  const ROLES = {
    self: { label: '心青年本人', name: '小雨', avatar: '👦', color: '#4A90D9',
      canAdd: ['mood', 'note'],
      description: '记录自己的心情和感受' },
    parent: { label: '家长/照护人', name: '妈妈', avatar: '👩', color: '#52C41A',
      canAdd: ['care', 'communication', 'emotion', 'note'],
      description: '记录日常照护和家庭情况' },
    teacher: { label: '机构老师', name: '李老师', avatar: '👩‍🏫', color: '#FAAD14',
      canAdd: ['activity', 'communication', 'emotion', 'note'],
      description: '记录教学和活动情况' },
    caregiver: { label: '护理员', name: '张阿姨', avatar: '👵', color: '#722ED1',
      canAdd: ['care', 'communication', 'emotion', 'note'],
      description: '记录日常护理和健康情况' },
    volunteer: { label: '志愿者', name: '小王', avatar: '👷', color: '#13C2C2',
      canAdd: ['accompany', 'emotion', 'note'],
      description: '记录陪伴和观察情况' }
  };

  /** 记录类型配置 - 定义各记录类型的表单字段 */
  const RECORD_TYPES = {
    mood: { label: '心情记录', icon: '💭', color: '#4A90D9',
      fields: ['mood', 'content'], description: '记录今天的心情' },
    care: { label: '照护记录', icon: '🏥', color: '#52C41A',
      fields: ['title', 'content'], description: '记录饮食、睡眠、健康等照护情况' },
    activity: { label: '活动记录', icon: '🎯', color: '#FAAD14',
      fields: ['title', 'content'], description: '记录参加的课程、活动、训练' },
    communication: { label: '沟通观察', icon: '💬', color: '#722ED1',
      fields: ['content'], description: '记录沟通中的观察发现' },
    emotion: { label: '情绪事件', icon: '😊', color: '#F5222D',
      fields: ['emotion_type', 'content'], description: '记录情绪波动的触发和应对' },
    accompany: { label: '陪伴记录', icon: '🤝', color: '#13C2C2',
      fields: ['content'], description: '记录陪伴过程中的观察' },
    note: { label: '一般备注', icon: '📝', color: '#999999',
      fields: ['title', 'content'], description: '添加其他需要记录的备注' }
  };

  /** 心情选项 */
  const MOOD_OPTIONS = [
    { value: 'happy', label: '开心', emoji: '😄' },
    { value: 'calm', label: '平静', emoji: '😌' },
    { value: 'anxious', label: '焦虑', emoji: '😰' },
    { value: 'sad', label: '难过', emoji: '😢' },
    { value: 'excited', label: '兴奋', emoji: '🤩' }
  ];

  /** 情绪类型选项 */
  const EMOTION_OPTIONS = [
    { value: '开心', emoji: '😊' },
    { value: '平静', emoji: '😌' },
    { value: '焦虑', emoji: '😰' },
    { value: '生气', emoji: '😠' },
    { value: '难过', emoji: '😢' }
  ];

  /* ==========================================================
   * 三、数据层（DataStore - localStorage持久化）
   * ========================================================== */

  const STORAGE_KEY = 'ai_dongwo_data';
  const DATA_VERSION = 5; // 数据版本，修改此值可强制重新初始化

  /** 生成唯一ID */
  function generateUUID() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /** 生成用户ID */
  function generateUserId() {
    return 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  /** 获取当前日期字符串（YYYY-MM-DD） */
  function getTodayString() {
    var d = new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  /** 获取当前时间字符串（HH:MM） */
  function getNowTimeString() {
    var d = new Date();
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return hours + ':' + minutes;
  }

  /** 格式化日期显示 */
  function formatDateDisplay(dateStr) {
    var today = getTodayString();
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yestStr = yesterday.getFullYear() + '-' + String(yesterday.getMonth() + 1).padStart(2, '0') + '-' + String(yesterday.getDate()).padStart(2, '0');

    if (dateStr === today) return '今天';
    if (dateStr === yestStr) return '昨天';
    return dateStr;
  }

  /** 生成示例用户数据 */
  function generateSampleUsers() {
    return [
      { id: 'u_sample_self', name: '小雨', role: 'self', pin: '1111', avatar: '👦', createdAt: getTodayString() },
      { id: 'u_sample_parent', name: '妈妈', role: 'parent', pin: '2222', avatar: '👩', createdAt: getTodayString() },
      { id: 'u_sample_teacher', name: '李老师', role: 'teacher', pin: '3333', avatar: '👩‍🏫', createdAt: getTodayString() },
      { id: 'u_sample_caregiver', name: '张阿姨', role: 'caregiver', pin: '4444', avatar: '👵', createdAt: getTodayString() },
      { id: 'u_sample_volunteer', name: '小王', role: 'volunteer', pin: '5555', avatar: '👷', createdAt: getTodayString() }
    ];
  }

  /** 生成示例记录数据 */
  function generateSampleRecords() {
    var records = [];
    var authors = {
      self: { name: '小雨', role: 'self', id: 'u_sample_self', avatar: '👦' },
      parent: { name: '妈妈', role: 'parent', id: 'u_sample_parent', avatar: '👩' },
      teacher: { name: '李老师', role: 'teacher', id: 'u_sample_teacher', avatar: '👩‍🏫' },
      caregiver: { name: '张阿姨', role: 'caregiver', id: 'u_sample_caregiver', avatar: '👵' },
      volunteer: { name: '小王', role: 'volunteer', id: 'u_sample_volunteer', avatar: '👷' }
    };

    function dateStr(offset) {
      var d = new Date();
      d.setDate(d.getDate() + offset);
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function timeStr(h, m) {
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    }

    function addRecord(type, data) {
      records.push(Object.assign({ id: generateUUID(), type: type, date: dateStr(0), time: timeStr(9, 0) }, data));
    }

    // === 近30天心情记录（每天1条，共30条）===
    var moodData = [
      { d: 0, m: 'happy', c: '今天做曲奇很成功，特别开心！' },
      { d: -1, m: 'calm', c: '今天状态很平静，像往常一样跟着流程走。' },
      { d: -2, m: 'happy', c: '看到了一只橘猫，开心地笑了。' },
      { d: -3, m: 'anxious', c: '外面突然打雷，有点害怕，捂了一会儿耳朵。' },
      { d: -4, m: 'calm', c: '今天和平常一样，没什么特别的事。' },
      { d: -5, m: 'excited', c: '周末要去公园，从早上就开始兴奋了！' },
      { d: -6, m: 'happy', c: '学会了新的烘焙配方，成就感满满。' },
      { d: -7, m: 'calm', c: '下午电子琴练习很顺利，弹得很流畅。' },
      { d: -8, m: 'anxious', c: '今天机构来了新老师，有些不适应。' },
      { d: -9, m: 'happy', c: '收到了志愿者哥哥送的公交车模型，超级开心！' },
      { d: -10, m: 'calm', c: '今天一切正常，按时完成了所有活动。' },
      { d: -11, m: 'sad', c: '今天有点想家，下午不太想参加活动。' },
      { d: -12, m: 'happy', c: '妈妈来探望了，还带了喜欢的面包。' },
      { d: -13, m: 'excited', c: '明天有外出活动，今晚有点睡不着。' },
      { d: -14, m: 'calm', c: '今天状态不错，完成了所有任务。' },
      { d: -15, m: 'anxious', c: '午餐的菜单临时换了，有点紧张。' },
      { d: -16, m: 'happy', c: '今天在公园里看到了很多公交车，特别满足。' },
      { d: -17, m: 'calm', c: '今天很安静，画画的时候特别专注。' },
      { d: -18, m: 'happy', c: '和同学们一起做了蛋糕，分享的时候很开心。' },
      { d: -19, m: 'anxious', c: '今天下雨了，不能去户外，有点烦躁。' },
      { d: -20, m: 'calm', c: '今天在室内活动，整理了之前的画作。' },
      { d: -21, m: 'happy', c: '学会了新的电子琴曲子，弹给妈妈听。' },
      { d: -22, m: 'calm', c: '今天没什么特别的，但很安心。' },
      { d: -23, m: 'excited', c: '得知下周有烘焙比赛，开始期待了！' },
      { d: -24, m: 'happy', c: '今天做的小饼干得到了老师表扬。' },
      { d: -25, m: 'calm', c: '今天一切按部就班，很顺利。' },
      { d: -26, m: 'anxious', c: '今天机构人多，有点不适应，去安静角落待了一会儿。' },
      { d: -27, m: 'happy', c: '和志愿者小王一起去了新的公园，看到了很多猫。' },
      { d: -28, m: 'calm', c: '今天在机构完成了所有的日常活动。' },
      { d: -29, m: 'happy', c: '收到了生日礼物，是一个新的电子琴曲谱集。' }
    ];

    moodData.forEach(function(item) {
      addRecord('mood', {
        mood: item.m, content: item.c,
        author: authors.self.name, authorRole: authors.self.role,
        authorId: authors.self.id, authorAvatar: authors.self.avatar,
        date: dateStr(item.d), time: timeStr(9 + Math.floor(Math.random() * 6), Math.floor(Math.random() * 60))
      });
    });

    // === 情绪事件（12条）===
    var emotionData = [
      { d: -1, t: '焦虑', c: '下午机构突然换了活动教室，有些不安，来回踱步。提前熟悉环境后逐渐平稳。', a: 'caregiver' },
      { d: -3, t: '恐惧', c: '外面打雷声音很大，出现捂耳朵、蜷缩的反应。播放轻音乐后慢慢放松。', a: 'parent' },
      { d: -5, t: '兴奋', c: '得知周末要去公园，一整天都处于高度兴奋状态，话比平时多。', a: 'teacher' },
      { d: -8, t: '焦虑', c: '机构来了新老师，不愿意配合活动，躲在角落。后来妈妈电话安抚后好转。', a: 'caregiver' },
      { d: -11, t: '难过', c: '想念妈妈，下午情绪低落，不愿意参加集体活动。给他看了妈妈照片后好一些。', a: 'teacher' },
      { d: -15, t: '焦虑', c: '午餐菜单临时更换，反复确认新菜品成分，确认没有海鲜后才肯吃。', a: 'parent' },
      { d: -19, t: '烦躁', c: '下雨天不能户外活动，在教室内来回走动，敲打桌子。转移注意力到电子琴后平静。', a: 'teacher' },
      { d: -21, t: '开心', c: '弹新曲子给妈妈听，得到夸奖后开心地笑了，还主动要求再弹一首。', a: 'parent' },
      { d: -23, t: '兴奋', c: '得知有烘焙比赛，一晚上都在念叨要做饼干，很晚才睡着。', a: 'parent' },
      { d: -26, t: '焦虑', c: '今天机构人多嘈杂，出现捂耳朵行为。带他到安静房间待了15分钟后恢复。', a: 'caregiver' },
      { d: -27, t: '开心', c: '去新公园看到了很多流浪猫，主动走近观察，心情特别好。', a: 'volunteer' },
      { d: -29, t: '开心', c: '收到电子琴曲谱集礼物，迫不及待地翻看了每一页。', a: 'parent' }
    ];

    emotionData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('emotion', {
        emotion_type: item.t, content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(14 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60))
      });
    });

    // === 活动记录（8条）===
    var activityData = [
      { d: 0, t: '烘焙课表现', c: '主动帮忙分发材料，做了一个杯子蛋糕，装饰得很漂亮。', a: 'teacher' },
      { d: -2, t: '社区散步', c: '在社区里散步40分钟，对路过的公交车很感兴趣，能准确说出线路号。', a: 'volunteer' },
      { d: -5, t: '电子琴练习', c: '练习了新曲子《小星星》，手指协调性有进步，能完整弹奏。', a: 'teacher' },
      { d: -7, t: '绘画活动', c: '画了一幅公交车主题的画，用了蓝色和黄色，配色很好看。', a: 'teacher' },
      { d: -12, t: '烘焙课', c: '做了巧克力曲奇，学会了控制烤箱温度，成品不错。', a: 'teacher' },
      { d: -16, t: '公园观察', c: '在公园观察公交车进出站，能说出大部分线路的终点站。', a: 'volunteer' },
      { d: -21, t: '音乐分享', c: '给妈妈弹了新学的曲子，还尝试即兴改编了几个小节。', a: 'parent' },
      { d: -24, t: '烘焙作品', c: '独立完成了小饼干的制作，从配料到出炉全程参与。', a: 'teacher' }
    ];

    activityData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('activity', {
        title: item.t, content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(10 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60))
      });
    });

    // === 照护记录（5条）===
    var careData = [
      { d: 0, t: '早餐情况', c: '吃了面包和牛奶，食欲不错。提醒午餐不能有海鲜。', a: 'parent' },
      { d: -4, t: '午餐观察', c: '午餐吃得比平时少，可能和上午情绪紧张有关。检查了菜品确认无海鲜。', a: 'caregiver' },
      { d: -10, t: '睡眠记录', c: '昨晚入睡晚了约20分钟，夜间没有醒，早上精神状态正常。', a: 'parent' },
      { d: -17, t: '身体检查', c: '体温正常，没有感冒症状。指甲有点长，已修剪。', a: 'caregiver' },
      { d: -22, t: '饮食记录', c: '三餐正常，下午加餐吃了水果。饮水量足够。', a: 'parent' }
    ];

    careData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('care', {
        title: item.t, content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(7 + Math.floor(Math.random() * 3), Math.floor(Math.random() * 60))
      });
    });

    // === 沟通记录（4条）===
    var commData = [
      { d: 0, c: '用"先...然后..."的方式讲解新任务，理解得很快。对公交车相关的比喻反应特别好。', a: 'teacher' },
      { d: -6, c: '今天尝试用图片卡片辅助沟通，对"下一步做什么"的理解明显提升。', a: 'teacher' },
      { d: -14, c: '给他两个选择时（A或B），能较快做出决定。直接问"你想做什么"时反而需要更长时间。', a: 'teacher' },
      { d: -20, c: '下雨天不能外出时，用画图的方式解释原因，他比语言解释更能接受。', a: 'caregiver' }
    ];

    commData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('communication', {
        content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(10, Math.floor(Math.random() * 60))
      });
    });

    // === 陪伴记录（3条）===
    var accompData = [
      { d: -1, c: '陪小雨去公园散步，对公交车经过很感兴趣，能准确说出线路号。', a: 'volunteer' },
      { d: -9, c: '一起拼公交车模型，小雨很专注，能按步骤完成，还主动帮忙整理零件。', a: 'volunteer' },
      { d: -27, c: '去新公园看到了很多流浪猫，小雨主动走近观察，还轻声跟猫说话。', a: 'volunteer' }
    ];

    accompData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('accompany', {
        content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(15, Math.floor(Math.random() * 60))
      });
    });

    // === 备注（4条）===
    var noteData = [
      { d: -1, t: '睡眠质量', c: '昨晚入睡晚了约20分钟，可能和白天情绪稍紧张有关。夜间没有醒。', a: 'parent' },
      { d: -7, t: '药物记录', c: '按时服药，没有不良反应。', a: 'parent' },
      { d: -14, t: '体检预约', c: '已预约8月15日的年度体检，需要带身份证和医保卡。', a: 'parent' },
      { d: -25, t: '天气变化', c: '近期多雨，注意室内活动安排，避免情绪因不能外出而波动。', a: 'teacher' }
    ];

    noteData.forEach(function(item) {
      var au = authors[item.a];
      addRecord('note', {
        title: item.t, content: item.c,
        author: au.name, authorRole: au.role, authorId: au.id, authorAvatar: au.avatar,
        date: dateStr(item.d), time: timeStr(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60))
      });
    });

    return records;
  }

  /** 生成示例任务数据 */
  function generateSampleTasks() {
    return [
      { id: 'task_1', title: '起床洗漱', icon: '🪥', category: 'daily', time: '08:30', difficulty: 'easy', supportTip: '提醒时间即可，不需催促', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_2', title: '吃早餐', icon: '🍞', category: 'daily', time: '09:00', difficulty: 'easy', supportTip: '检查食物无海鲜成分', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_3', title: '机构活动', icon: '🎨', category: 'therapy', time: '10:00', difficulty: 'medium', supportTip: '提前说明今天做什么活动', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_4', title: '午餐', icon: '🍱', category: 'daily', time: '11:30', difficulty: 'easy', supportTip: '避免突然更换菜单', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_5', title: '午休', icon: '😴', category: 'daily', time: '12:30', difficulty: 'easy', supportTip: '保持环境安静', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_6', title: '烘焙练习', icon: '🍪', category: 'work', time: '14:00', difficulty: 'medium', supportTip: '鼓励参与但允许不参加', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_7', title: '社区散步', icon: '🚶', category: 'social', time: '15:30', difficulty: 'easy', supportTip: '避开嘈杂场所', isActive: true, createdAt: getTodayString(), checkins: [] },
      { id: 'task_8', title: '电子琴练习', icon: '🎹', category: 'therapy', time: '16:00', difficulty: 'medium', supportTip: '按步骤练习，不要催促', isActive: true, createdAt: getTodayString(), checkins: [] }
    ];
  }

  /** 生成示例日程数据 */
  function generateSampleEvents() {
    var today = getTodayString();
    var parts = today.split('-');
    var y = parseInt(parts[0]);
    var m = parseInt(parts[1]);
    var d = parseInt(parts[2]);
    function dateStr(offset) {
      var dt = new Date(y, m - 1, d + offset);
      return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
    }
    // 获取本月第一天
    var firstOfMonth = new Date(y, m - 1, 1);
    // 获取今天是一号后的第几天
    var dayOffset = d - 1;

    var events = [];

    // === 每日重复事件 ===
    // 服药提醒（每天都有）
    for (var i = 0; i <= dayOffset + 7; i++) {
      events.push({
        id: 'evt_med_' + i, title: '服药提醒', type: 'reminder', icon: '💊',
        date: dateStr(-dayOffset + i), time: '21:00', description: '每日睡前服药',
        recurring: 'daily', priority: 'high', color: '#722ED1',
        author: '妈妈', authorRole: 'parent', createdAt: today
      });
    }

    // === 每周重复事件 ===
    // 志愿者陪伴（每周五，找本周五和上周五）
    function getFriday(offset) {
      var dt = new Date(y, m - 1, d);
      var day = dt.getDay(); // 0=日
      var diff = 5 - day + offset * 7;
      var friday = new Date(y, m - 1, d + diff);
      return friday.getFullYear() + '-' + String(friday.getMonth() + 1).padStart(2, '0') + '-' + String(friday.getDate()).padStart(2, '0');
    }
    events.push({ id: 'evt_vol_1', title: '志愿者陪伴', type: 'activity', icon: '🤝', date: getFriday(0), time: '15:00', endTime: '16:30', description: '志愿者小王下午来陪伴散步', recurring: 'weekly', priority: 'low', color: '#13C2C2', author: '妈妈', authorRole: 'parent', createdAt: today });
    events.push({ id: 'evt_vol_2', title: '志愿者陪伴', type: 'activity', icon: '🤝', date: getFriday(-1), time: '15:00', endTime: '16:30', description: '志愿者小王下午来陪伴散步', recurring: 'weekly', priority: 'low', color: '#13C2C2', author: '妈妈', authorRole: 'parent', createdAt: today });
    if (dayOffset >= 7) {
      events.push({ id: 'evt_vol_3', title: '志愿者陪伴', type: 'activity', icon: '🤝', date: getFriday(-2), time: '15:00', endTime: '16:30', description: '志愿者小王下午来陪伴散步', recurring: 'weekly', priority: 'low', color: '#13C2C2', author: '妈妈', authorRole: 'parent', createdAt: today });
    }

    // === 本月内散布的单次事件（从月初到今天+未来几天）===
    var monthEvents = [
      { offset: -dayOffset + 1, title: '机构晨检', type: 'medical', icon: '🏥', time: '08:00', endTime: '08:30', desc: '月初健康检查，量体温、称体重', priority: 'medium', color: '#F5222D' },
      { offset: -dayOffset + 2, title: '烘焙课', type: 'activity', icon: '🍪', time: '10:00', endTime: '11:30', desc: '学习制作曲奇饼干', priority: 'low', color: '#FAAD14' },
      { offset: -dayOffset + 3, title: '电子琴课', type: 'activity', icon: '🎹', time: '14:00', endTime: '15:00', desc: '练习《小星星》完整弹奏', priority: 'low', color: '#13C2C2' },
      { offset: -dayOffset + 4, title: '社区适应训练', type: 'activity', icon: '🚶', time: '09:30', endTime: '11:00', desc: '去超市购物练习，学习认价格标签', priority: 'medium', color: '#4A90D9' },
      { offset: -dayOffset + 5, title: '绘画课', type: 'activity', icon: '🎨', time: '10:00', endTime: '11:30', desc: '画公交车主题的水彩画', priority: 'low', color: '#FAAD14' },
      { offset: -dayOffset + 6, title: 'IEP季度评估', type: 'meeting', icon: '📋', time: '10:00', endTime: '11:30', desc: 'Individualized Education Program 季度评估会议', priority: 'high', color: '#4A90D9' },
      { offset: -dayOffset + 7, title: '家长交流会', type: 'meeting', icon: '👩‍👩‍👦', time: '14:00', endTime: '15:30', desc: '机构家长交流会，分享照护经验', priority: 'medium', color: '#4A90D9' },
      { offset: -dayOffset + 8, title: '感统训练', type: 'activity', icon: '🧘', time: '10:00', endTime: '11:00', desc: '感觉统合训练，平衡木和触觉练习', priority: 'medium', color: '#52C41A' },
      { offset: -dayOffset + 9, title: '烘焙课', type: 'activity', icon: '🍪', time: '10:00', endTime: '11:30', desc: '学习制作小蛋糕', priority: 'low', color: '#FAAD14' },
      { offset: -dayOffset + 10, title: '户外安全演练', type: 'activity', icon: '⚠️', time: '14:00', endTime: '15:00', desc: '学习过马路、识别红绿灯', priority: 'high', color: '#F5222D' },
      { offset: -dayOffset + 11, title: '音乐课', type: 'activity', icon: '🎵', time: '10:00', endTime: '11:00', desc: '学习节奏拍打和简单合唱', priority: 'low', color: '#722ED1' },
      { offset: -dayOffset + 12, title: '体育活动', type: 'activity', icon: '⚽', time: '15:00', endTime: '16:00', desc: '机构运动会，参加接力跑和投球', priority: 'medium', color: '#52C41A' },
      { offset: -dayOffset + 14, title: '口腔检查', type: 'medical', icon: '🦷', time: '09:00', endTime: '10:00', desc: '社区医院口腔检查', priority: 'medium', color: '#F5222D' },
      { offset: -dayOffset + 15, title: '感统训练', type: 'activity', icon: '🧘', time: '10:00', endTime: '11:00', desc: '触觉脱敏训练，接触不同材质', priority: 'medium', color: '#52C41A' },
      { offset: -dayOffset + 16, title: '社交技能课', type: 'activity', icon: '🗣️', time: '14:00', endTime: '15:00', desc: '学习打招呼和自我介绍', priority: 'medium', color: '#4A90D9' },
      { offset: -dayOffset + 17, title: '烘焙课', type: 'activity', icon: '🍪', time: '10:00', endTime: '11:30', desc: '学习制作面包', priority: 'low', color: '#FAAD14' },
      { offset: -dayOffset + 18, title: '电子琴课', type: 'activity', icon: '🎹', time: '14:00', endTime: '15:00', desc: '学习《小星星》变奏', priority: 'low', color: '#13C2C2' },
      { offset: -dayOffset + 19, title: '心理咨询', type: 'medical', icon: '🧠', time: '10:00', endTime: '11:00', desc: '月度心理咨询评估', priority: 'high', color: '#722ED1' },
      { offset: -dayOffset + 20, title: '社区散步', type: 'activity', icon: '🚶', time: '15:00', endTime: '16:30', desc: '去公园散步，观察流浪猫', priority: 'low', color: '#13C2C2' },
      { offset: -dayOffset + 21, title: '烘焙课结业展示', type: 'activity', icon: '🏆', time: '14:00', endTime: '16:00', desc: '机构烘焙课程结业展示，家长可以参加', priority: 'high', color: '#FAAD14' },
      { offset: -dayOffset + 22, title: '家长面谈', type: 'meeting', icon: '👩', time: '10:00', endTime: '11:00', desc: '与李老师一对一面谈，了解本月进展', priority: 'medium', color: '#4A90D9' },
      { offset: -dayOffset + 23, title: '感统训练', type: 'activity', icon: '🧘', time: '10:00', endTime: '11:00', desc: '大运动协调训练', priority: 'medium', color: '#52C41A' },
      { offset: -dayOffset + 25, title: '机构开放日', type: 'activity', icon: '🏫', time: '09:00', endTime: '12:00', desc: '机构开放日，展示学员作品', priority: 'medium', color: '#4A90D9' },
      { offset: -dayOffset + 27, title: '支持性就业评估', type: 'meeting', icon: '💼', time: '10:00', endTime: '11:30', desc: '评估支持性就业进展和能力', priority: 'high', color: '#4A90D9' }
    ];

    // 只保留在当月范围内的，不超过未来10天
    monthEvents.forEach(function(e, idx) {
      var evtDate = dateStr(e.offset);
      // 检查日期在本月范围内且不超过今天+10天
      if (e.offset >= -dayOffset && e.offset <= 10) {
        events.push({
          id: 'evt_m_' + idx, title: e.title, type: e.type, icon: e.icon,
          date: evtDate, time: e.time, endTime: e.endTime || '',
          description: e.desc, recurring: 'none', priority: e.priority,
          color: e.color,
          author: e.priority === 'high' ? '妈妈' : '李老师',
          authorRole: e.priority === 'high' ? 'parent' : 'teacher',
          createdAt: today
        });
      }
    });

    // === 重要的未来事件 ===
    events.push({ id: 'evt_checkup', title: '年度体检', type: 'medical', icon: '🏥', date: dateStr(5), time: '09:00', endTime: '11:00', description: '市残联年度体检，需带身份证和医保卡', recurring: 'yearly', priority: 'high', color: '#F5222D', author: '妈妈', authorRole: 'parent', createdAt: today });
    events.push({ id: 'evt_iep', title: 'IEP会议', type: 'meeting', icon: '📋', date: dateStr(3), time: '10:00', endTime: '11:30', description: 'Individualized Education Program 季度评估会议', recurring: 'none', priority: 'high', color: '#4A90D9', author: '李老师', authorRole: 'teacher', createdAt: today });

    return events;
  }

  /** DataStore - 封装所有localStorage操作 */
  const DataStore = {
    /** 初始化数据（如果不存在则创建默认数据） */
    init: function () {
      var data = this.load();
      var needReset = false;

      if (!data) {
        data = {
          version: DATA_VERSION,
          currentUser: null,
          users: [],
          records: []
        };
        needReset = true;
      }

      // 如果版本不一致，重置数据并重新生成示例
      if (data.version !== DATA_VERSION) {
        data.version = DATA_VERSION;
        data.records = [];
        data.users = [];
        needReset = true;
      }

      // 确保 users 字段存在
      if (!data.users) {
        data.users = [];
        needReset = true;
      }

      // 如果没有任何用户，生成示例用户
      if (data.users.length === 0) {
        data.users = generateSampleUsers();
        needReset = true;
      }

      // 如果没有任何记录或记录明显不完整，生成示例数据
      if (!data.records || data.records.length < 5) {
        data.records = generateSampleRecords();
        needReset = true;
      }

      // 初始化任务数据
      if (!data.tasks || data.tasks.length === 0) {
        data.tasks = generateSampleTasks();
        needReset = true;
      }

      // 初始化日程数据
      if (!data.events || data.events.length === 0) {
        data.events = generateSampleEvents();
        needReset = true;
      }

      if (needReset) {
        this.save(data);
      }
      return data;
    },

    /** 加载数据 */
    load: function () {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        console.error('DataStore加载失败:', e);
        return null;
      }
    },

    /** 保存数据 */
    save: function (data) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) {
        console.error('DataStore保存失败:', e);
      }
    },

    /** 获取所有记录 */
    getRecords: function () {
      var data = this.load();
      return data && data.records ? data.records : [];
    },

    /** 添加记录 */
    addRecord: function (record) {
      var data = this.load();
      if (!data) {
        data = { version: 1, currentUser: null, records: [] };
      }
      if (!data.records) data.records = [];

      var newRecord = Object.assign({}, record, {
        id: generateUUID(),
        date: record.date || getTodayString(),
        time: record.time || getNowTimeString()
      });

      data.records.unshift(newRecord);
      this.save(data);
      return newRecord;
    },

    /** 删除记录 */
    deleteRecord: function (id) {
      var data = this.load();
      if (!data || !data.records) return false;
      data.records = data.records.filter(function (r) { return r.id !== id; });
      this.save(data);
      return true;
    },

    /** 获取当前用户 */
    getCurrentUser: function () {
      var data = this.load();
      return data ? data.currentUser : null;
    },

    /** 设置当前用户 */
    setCurrentUser: function (user) {
      var data = this.load();
      if (!data) {
        data = { version: DATA_VERSION, currentUser: user, users: [], records: [] };
      } else {
        data.currentUser = user;
      }
      this.save(data);
    },

    /** 获取所有用户 */
    getAllUsers: function () {
      var data = this.load();
      return data && data.users ? data.users : [];
    },

    /** 注册新用户 */
    registerUser: function (name, role, pin) {
      var data = this.load();
      if (!data) {
        data = { version: DATA_VERSION, currentUser: null, users: [], records: [] };
      }
      if (!data.users) data.users = [];

      // 检查是否已有同名用户，如果是则尝试用PIN码登录
      var existing = data.users.find(function (u) {
        return u.name === name && u.role === role;
      });
      if (existing) {
        if (existing.pin === pin) {
          // PIN码匹配，直接登录
          return { success: true, user: existing, isNew: false };
        } else {
          return { success: false, message: '该角色下已存在同名用户，PIN码不匹配，请重试或联系管理员' };
        }
      }

      var roleConfig = ROLES[role];
      var newUser = {
        id: generateUserId(),
        name: name,
        role: role,
        pin: pin,
        avatar: roleConfig ? roleConfig.avatar : '👤',
        createdAt: getTodayString()
      };

      data.users.push(newUser);
      this.save(data);
      return { success: true, user: newUser, isNew: true };
    },

    /** 通过用户名和PIN码查找用户 */
    findUserByNameAndPin: function (name, pin) {
      var data = this.load();
      if (!data || !data.users) return null;
      return data.users.find(function (u) {
        return u.name === name && u.pin === pin;
      }) || null;
    },

    /** 通过ID查找用户 */
    findUserById: function (id) {
      var data = this.load();
      if (!data || !data.users) return null;
      return data.users.find(function (u) {
        return u.id === id;
      }) || null;
    },

    /** 获取所有任务 */
    getTasks: function() {
      var data = this.load();
      return data && data.tasks ? data.tasks : [];
    },

    /** 更新任务打卡 */
    updateTaskCheckin: function(taskId, date, status, note) {
      var data = this.load();
      if (!data || !data.tasks) return false;
      var task = data.tasks.find(function(t) { return t.id === taskId; });
      if (!task) return false;
      var existing = task.checkins.find(function(c) { return c.date === date; });
      if (existing) {
        existing.status = status;
        existing.time = new Date().toTimeString().slice(0,5);
        if (note !== undefined) existing.note = note;
      } else {
        task.checkins.push({ date: date, time: new Date().toTimeString().slice(0,5), status: status, note: note || '' });
      }
      this.save(data);
      return true;
    },

    /** 添加新任务 */
    addTask: function(task) {
      var data = this.load();
      if (!data.tasks) data.tasks = [];
      var newTask = Object.assign({}, task, { id: 'task_' + generateUUID(), createdAt: getTodayString(), checkins: [] });
      data.tasks.push(newTask);
      this.save(data);
      return newTask;
    },

    /** 切换任务激活状态 */
    toggleTaskActive: function(taskId) {
      var data = this.load();
      if (!data || !data.tasks) return;
      var task = data.tasks.find(function(t) { return t.id === taskId; });
      if (task) { task.isActive = !task.isActive; this.save(data); }
    },

    /** 删除任务 */
    deleteTask: function(taskId) {
      var data = this.load();
      if (!data || !data.tasks) return;
      data.tasks = data.tasks.filter(function(t) { return t.id !== taskId; });
      this.save(data);
    },

    /** 获取所有日程事件 */
    getEvents: function() {
      var data = this.load();
      return data && data.events ? data.events : [];
    },

    /** 添加日程事件 */
    addEvent: function(event) {
      var data = this.load();
      if (!data.events) data.events = [];
      var newEvent = Object.assign({}, event, { id: 'evt_' + generateUUID(), createdAt: getTodayString() });
      data.events.push(newEvent);
      this.save(data);
      return newEvent;
    },

    /** 删除日程事件 */
    deleteEvent: function(eventId) {
      var data = this.load();
      if (!data || !data.events) return;
      data.events = data.events.filter(function(e) { return e.id !== eventId; });
      this.save(data);
    },

    /** 获取指定日期的事件 */
    getEventsByDate: function(dateStr) {
      return this.getEvents().filter(function(e) { return e.date === dateStr; });
    }
  };

  /* ==========================================================
   * 四、应用状态管理
   * ========================================================== */

  /** 全局应用状态 */
  let appState = {
    currentUser: null,
    currentPage: 'home',
    currentRole: 'parent',
    currentQuickCardVersion: 'standard',
    chatState: {
      currentStep: 0,
      messages: [],
      categories: [],
      profileName: '小雨'
    }
  };

  /** 当前路由页面（兼容旧代码） */
  let currentPage = 'home';

  /** 当前角色（兼容旧代码） */
  let currentRole = 'parent';

  /** 当前速读卡版本 */
  let currentQuickCardVersion = 'standard';

  /** 对话状态 */
  let chatState = {
    currentStep: 0,
    messages: [],
    categories: [],
    profileName: '小雨'
  };

  /** 添加记录弹窗状态 */
  let addRecordState = {
    selectedType: null
  };

  /* ==========================================================
   * 五、路由系统（Hash路由）
   * ========================================================== */

  /**
   * 页面ID与Hash的映射
   */
  const routeMap = {
    'home': 'home',
    'life': 'life',
    'communication': 'communication',
    'emotion': 'emotion',
    'care': 'care',
    'work': 'work',
    'relations': 'relations',
    'timeline': 'timeline',
    'collect': 'collect',
    'login': 'login',
    'profile': 'profile',
    'charts': 'charts',
    'tasks': 'tasks',
    'calendar': 'calendar'
  };

  /**
   * 初始化路由系统
   * 监听 hashchange 事件，实现SPA页面切换
   */
  function initRouter() {
    window.addEventListener('hashchange', handleRouteChange);

    // 首次加载时根据当前hash渲染页面
    var hash = window.location.hash.replace('#', '') || 'home';
    // 如果没有登录且不是登录页面，重定向到登录
    var user = DataStore.getCurrentUser() || appState.currentUser;
    if (!user && hash !== 'login') {
      hash = 'login';
      window.location.hash = 'login';
      return;
    }
    navigateTo(hash);
  }

  /**
   * 处理路由变化
   */
  function handleRouteChange() {
    var hash = window.location.hash.replace('#', '') || 'home';
    var user = DataStore.getCurrentUser() || appState.currentUser;
    if (!user && hash !== 'login') {
      window.location.hash = 'login';
      return;
    }
    navigateTo(hash);
  }

  /**
   * 导航到指定页面
   * @param {string} pageName - 页面名称（如 'home', 'life' 等）
   */
  function navigateTo(pageName) {
    // 如果页面不存在则回到首页
    if (!routeMap[pageName]) {
      pageName = 'home';
    }

    // 隐藏所有页面section
    var sections = document.querySelectorAll('.page-section');
    sections.forEach(function (section) {
      section.classList.remove('active');
    });

    // 显示目标页面
    var targetSection = document.getElementById(pageName);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    currentPage = pageName;
    appState.currentPage = pageName;

    // 滚动到页面顶部
    window.scrollTo(0, 0);

    // 根据页面类型调用对应渲染函数
    renderPage(pageName);

    // 应用当前角色的隐私设置
    applyPrivacy(currentRole);
  }

  /**
   * 根据页面名称调用对应的渲染函数
   * @param {string} pageName - 页面名称
   */
  function renderPage(pageName) {
    switch (pageName) {
      case 'home':
        renderHome();
        break;
      case 'life':
        renderLife();
        break;
      case 'communication':
        renderCommunication();
        break;
      case 'emotion':
        renderEmotion();
        break;
      case 'care':
        renderCare();
        break;
      case 'work':
        renderWork();
        break;
      case 'relations':
        renderRelations();
        break;
      case 'timeline':
        renderTimeline();
        break;
      case 'collect':
        renderCollectPage();
        break;
      case 'login':
        renderRoleSelect();
        break;
      case 'profile':
        renderProfile();
        break;
      case 'charts': renderCharts(); break;
      case 'tasks': renderTasks(); break;
      case 'calendar': renderCalendar(); break;
    }
  }

  /* ==========================================================
   * 六、角色选择页面
   * ========================================================== */

  /**
   * 渲染登录/注册页面
   * 根据是否有已注册用户，决定默认显示登录还是注册视图
   */
  function renderRoleSelect() {
    var users = DataStore.getAllUsers();
    var showLogin = users.length > 0;

    // 显示/隐藏对应视图
    var loginView = document.getElementById('login-view');
    var regStep1 = document.getElementById('register-step1');
    var regStep2 = document.getElementById('register-step2');

    if (loginView) loginView.style.display = showLogin ? 'block' : 'none';
    if (regStep1) regStep1.style.display = showLogin ? 'none' : 'block';
    if (regStep2) regStep2.style.display = 'none';

    // 填充登录下拉菜单
    populateLoginSelect();

    // 绑定角色选择卡片点击事件（注册步骤1）
    var gridEl = document.getElementById('role-select-grid');
    if (gridEl) {
      gridEl.querySelectorAll('.role-select-card').forEach(function (card) {
        if (card.dataset.bound === 'true') return;
        card.dataset.bound = 'true';

        card.addEventListener('click', function () {
          var selectedRole = this.getAttribute('data-role');
          startRegisterStep2(selectedRole);
        });

        // 悬停效果
        card.addEventListener('mouseenter', function () {
          var r = ROLES[this.getAttribute('data-role')];
          if (r) {
            this.style.borderColor = r.color;
            this.style.transform = 'translateY(-4px)';
            this.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
          }
        });
        card.addEventListener('mouseleave', function () {
          this.style.borderColor = 'transparent';
          this.style.transform = 'translateY(0)';
          this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        });
      });
    }
  }

  /**
   * 填充登录下拉菜单
   */
  function populateLoginSelect() {
    var select = document.getElementById('login-name-select');
    if (!select) return;

    var users = DataStore.getAllUsers();
    // 清空现有选项（保留第一个 placeholder）
    select.innerHTML = '<option value="">-- 选择已有账号 --</option>';

    users.forEach(function (u) {
      var roleLabel = ROLES[u.role] ? ROLES[u.role].label : u.role;
      var opt = document.createElement('option');
      opt.value = u.name;
      opt.setAttribute('data-pin', u.pin);
      opt.textContent = u.name + '（' + roleLabel + '）';
      select.appendChild(opt);
    });

    // 绑定选择事件（避免重复绑定）
    if (!select.dataset.bound) {
      select.dataset.bound = 'true';
      select.addEventListener('change', function () {
        var selected = this.options[this.selectedIndex];
        var pin = selected.getAttribute('data-pin');
        var name = this.value;

        if (name && pin) {
          document.getElementById('login-pin').value = pin;
          var hint = document.getElementById('login-pin-hint');
          if (hint) hint.style.display = 'block';
        } else {
          document.getElementById('login-pin').value = '';
          var hint = document.getElementById('login-pin-hint');
          if (hint) hint.style.display = 'none';
        }
      });
    }
  }

  /**
   * 切换登录姓名输入方式（下拉/手动输入）
   */
  function toggleNameInputMode() {
    var select = document.getElementById('login-name-select');
    var input = document.getElementById('login-name');
    var link = document.getElementById('btn-toggle-name-input');
    var hint = document.getElementById('login-pin-hint');

    if (select.style.display === 'none') {
      // 切换回下拉模式
      select.style.display = '';
      input.style.display = 'none';
      link.textContent = '手动输入姓名';
      // 清空手动输入的值
      input.value = '';
    } else {
      // 切换到手动输入模式
      select.style.display = 'none';
      input.style.display = '';
      link.textContent = '从下拉菜单选择';
      // 清空PIN码和提示
      document.getElementById('login-pin').value = '';
      if (hint) hint.style.display = 'none';
    }
  }

  /**
   * 进入注册步骤2：设置姓名和PIN码
   * @param {string} roleKey - 选择的角色键名
   */
  function startRegisterStep2(roleKey) {
    var role = ROLES[roleKey];
    if (!role) return;

    regRole = roleKey; // 暂存选择的角色

    // 更新显示
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('register-step1').style.display = 'none';
    document.getElementById('register-step2').style.display = 'block';

    document.getElementById('register-role-avatar').textContent = role.avatar;
    document.getElementById('register-role-label').textContent = role.label;

    // 清空输入框
    document.getElementById('register-name').value = '';
    document.getElementById('register-pin').value = '';
    document.getElementById('register-pin-confirm').value = '';
    document.getElementById('register-name').focus();
  }

  /** 暂存注册选择的角色 */
  var regRole = null;

  /**
   * 执行注册
   */
  function doRegister() {
    if (!regRole) {
      showToast('请先选择角色');
      return;
    }

    var name = document.getElementById('register-name').value.trim();
    var pin = document.getElementById('register-pin').value;
    var pinConfirm = document.getElementById('register-pin-confirm').value;

    if (!name) {
      showToast('请输入您的姓名');
      return;
    }
    if (!pin || pin.length < 4 || pin.length > 6) {
      showToast('PIN码需要4-6位数字');
      return;
    }
    if (!/^\d+$/.test(pin)) {
      showToast('PIN码只能包含数字');
      return;
    }
    if (pin !== pinConfirm) {
      showToast('两次PIN码输入不一致');
      return;
    }

    var result = DataStore.registerUser(name, regRole, pin);
    if (!result.success) {
      showToast(result.message);
      return;
    }

    // 注册或登录成功
    var user = result.user;
    DataStore.setCurrentUser(user);
    appState.currentUser = user;
    currentRole = user.role;
    appState.currentRole = user.role;

    if (result.isNew) {
      showToast('注册成功！欢迎 ' + name);
    } else {
      showToast('登录成功！欢迎 ' + name);
    }
    updateNavBar();
    window.location.hash = 'home';
  }

  /**
   * 执行登录
   */
  function doLogin() {
    // 优先从下拉菜单获取姓名，其次从手动输入框获取
    var select = document.getElementById('login-name-select');
    var input = document.getElementById('login-name');
    var name = '';
    if (select && select.style.display !== 'none' && select.value) {
      name = select.value;
    } else if (input) {
      name = input.value.trim();
    }
    var pin = document.getElementById('login-pin').value;

    if (!name) {
      showToast('请选择或输入您的姓名');
      return;
    }
    if (!pin) {
      showToast('请输入PIN码');
      return;
    }

    var user = DataStore.findUserByNameAndPin(name, pin);
    if (!user) {
      showToast('姓名或PIN码错误，请重试');
      return;
    }

    DataStore.setCurrentUser(user);
    appState.currentUser = user;
    currentRole = user.role;
    appState.currentRole = user.role;

    showToast('登录成功！欢迎 ' + name);
    updateNavBar();
    window.location.hash = 'home';
  }

  /**
   * 显示登录视图
   */
  function showLoginView() {
    document.getElementById('login-view').style.display = 'block';
    document.getElementById('register-step1').style.display = 'none';
    document.getElementById('register-step2').style.display = 'none';
    // 重置为下拉模式
    var select = document.getElementById('login-name-select');
    var input = document.getElementById('login-name');
    if (select) { select.style.display = ''; select.selectedIndex = 0; }
    if (input) { input.style.display = 'none'; input.value = ''; }
    var toggleLink = document.getElementById('btn-toggle-name-input');
    if (toggleLink) toggleLink.textContent = '手动输入姓名';
    // 清空PIN码
    document.getElementById('login-pin').value = '';
    var hint = document.getElementById('login-pin-hint');
    if (hint) hint.style.display = 'none';
    // 刷新下拉菜单（可能有新注册的用户）
    populateLoginSelect();
  }

  /**
   * 显示注册步骤1
   */
  function showRegisterStep1() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('register-step1').style.display = 'block';
    document.getElementById('register-step2').style.display = 'none';
  }

  /**
   * 更新导航栏显示用户信息
   */
  function updateNavBar() {
    var user = DataStore.getCurrentUser() || appState.currentUser;
    var userInfo = document.getElementById('nav-user-info');
    if (!userInfo) return;

    if (user) {
      userInfo.style.display = 'flex';
      document.getElementById('nav-user-avatar').textContent = user.avatar || '👤';
      document.getElementById('nav-user-name').textContent = user.name || '用户';
      var roleLabel = ROLES[user.role] ? ROLES[user.role].label : user.role;
      var roleColor = ROLES[user.role] ? ROLES[user.role].color : '#4A90D9';
      var badge = document.getElementById('nav-user-role-badge');
      badge.textContent = roleLabel;
      badge.style.background = roleColor;
    } else {
      userInfo.style.display = 'none';
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    DataStore.setCurrentUser(null);
    appState.currentUser = null;
    currentRole = 'parent';
    appState.currentRole = 'parent';
    updateNavBar();
    window.location.hash = 'login';
  }

  /* ==========================================================
   * 七、个人中心页面
   * ========================================================== */

  /**
   * 渲染个人中心页面
   */
  function renderProfile() {
    var profileSection = document.getElementById('profile');
    if (!profileSection) {
      profileSection = document.createElement('section');
      profileSection.id = 'profile';
      profileSection.className = 'page-section';
      document.querySelector('.main-content').appendChild(profileSection);
    }

    var user = DataStore.getCurrentUser() || appState.currentUser;
    var role = user ? ROLES[user.role] : null;

    var html = '';
    html += '<div class="page-header">';
    html += '  <button class="back-btn">←</button>';
    html += '  <span class="page-title">个人中心</span>';
    html += '</div>';
    html += '<div class="container" style="padding:24px;">';

    if (user && role) {
      // 当前角色信息卡片
      html += '<div style="background:#fff;border-radius:16px;padding:24px;text-align:center;margin-bottom:24px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">';
      html += '  <div style="font-size:3.5rem;margin-bottom:12px;">' + (user.avatar || role.avatar) + '</div>';
      html += '  <div style="font-size:1.25rem;font-weight:600;color:#333;margin-bottom:4px;">' + user.name + '</div>';
      html += '  <div style="display:inline-block;padding:4px 12px;border-radius:20px;font-size:0.85rem;color:#fff;background:' + role.color + ';margin-bottom:8px;">' + role.label + '</div>';
      html += '  <p style="color:#666;font-size:0.9rem;">' + role.description + '</p>';
      html += '  <p style="color:#aaa;font-size:0.78rem;margin-top:8px;">账号ID: ' + user.id + ' | 注册于 ' + (user.createdAt || '今天') + '</p>';
      html += '</div>';

      // 可记录类型
      html += '<h2 class="section-title">您可以记录的内容</h2>';
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px;">';
      role.canAdd.forEach(function (typeKey) {
        var type = RECORD_TYPES[typeKey];
        if (type) {
          html += '<div style="background:#fff;border-radius:12px;padding:16px;text-align:center;border-left:4px solid ' + type.color + ';box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
          html += '  <div style="font-size:1.5rem;margin-bottom:4px;">' + type.icon + '</div>';
          html += '  <div style="font-size:0.85rem;color:#555;">' + type.label + '</div>';
          html += '</div>';
        }
      });
      html += '</div>';

      // 数据统计
      var records = DataStore.getRecords();
      var myRecords = records.filter(function (r) { return r.authorId === user.id; });
      html += '<h2 class="section-title">我的记录统计</h2>';
      html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px;">';
      html += '  <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
      html += '    <div style="font-size:1.5rem;font-weight:700;color:#4A90D9;">' + myRecords.length + '</div>';
      html += '    <div style="font-size:0.8rem;color:#888;">我的记录</div>';
      html += '  </div>';
      html += '  <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
      html += '    <div style="font-size:1.5rem;font-weight:700;color:#52C41A;">' + records.length + '</div>';
      html += '    <div style="font-size:0.8rem;color:#888;">全部记录</div>';
      html += '  </div>';
      html += '  <div style="background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
      html += '    <div style="font-size:1.5rem;font-weight:700;color:#FAAD14;">' + Object.keys(ROLES).length + '</div>';
      html += '    <div style="font-size:0.8rem;color:#888;">参与角色</div>';
      html += '  </div>';
      html += '</div>';

      // 更多功能入口
      html += '<h2 class="section-title">更多功能</h2>';
      var moreCards = [
        { hash: 'life', icon: '💚', title: '我喜欢的生活', desc: '喜好、日常、作息' },
        { hash: 'communication', icon: '💬', title: '沟通说明书', desc: '怎么说、注意什么' },
        { hash: 'emotion', icon: '🌈', title: '情绪与行为', desc: '触发、预警、安抚' },
        { hash: 'care', icon: '🩺', title: '照护与医疗', desc: '过敏、用药、体检' },
        { hash: 'work', icon: '💼', title: '工作支持', desc: '能做什么、需要什么' },
        { hash: 'relations', icon: '👥', title: '关系地图', desc: '核心圈、日常圈' },
        { hash: 'collect', icon: '🤖', title: '对话采集', desc: 'AI帮您建立档案' }
      ];
      html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">';
      moreCards.forEach(function (card) {
        html += '<div class="profile-more-card" data-navigate="' + card.hash + '" style="background:#fff;border-radius:12px;padding:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.04);cursor:pointer;transition:all 0.2s;">';
        html += '  <div style="font-size:1.5rem;margin-bottom:6px;">' + card.icon + '</div>';
        html += '  <div style="font-weight:600;font-size:0.9rem;color:#333;margin-bottom:2px;">' + card.title + '</div>';
        html += '  <div style="font-size:0.78rem;color:#999;">' + card.desc + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // 操作按钮
    html += '<div style="display:flex;flex-direction:column;gap:12px;">';
    html += '  <button id="btn-logout" style="padding:14px 24px;border-radius:12px;border:1px solid #ddd;background:#fff;color:#666;font-size:1rem;cursor:pointer;transition:all 0.2s;">🚪 退出登录</button>';
    html += '</div>';

    html += '</div>';

    profileSection.innerHTML = html;

    // 绑定退出按钮事件
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function () {
        logout();
      });
    }

    // 绑定"更多功能"卡片点击事件
    profileSection.querySelectorAll('.profile-more-card').forEach(function(card) {
      card.addEventListener('click', function () {
        var target = this.getAttribute('data-navigate');
        if (target === 'collect') {
          navigateTo('collect');
        } else {
          window.location.hash = target;
        }
      });
      // hover 效果
      card.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-3px)';
        this.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      });
      card.addEventListener('mouseleave', function () {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
      });
    });
  }

  /* ==========================================================
   * 八、页面渲染函数（各模块DOM渲染）
   * ========================================================== */

  /**
   * 渲染首页
   * 在现有静态结构基础上，添加最新动态区域和FAB按钮
   */
  function renderHome() {
    var user = DataStore.getCurrentUser() || appState.currentUser;

    // 渲染Hero区域的基本信息
    var heroNameEl = document.getElementById('hero-name');
    var heroAgeEl = document.getElementById('hero-age');
    var heroIntroEl = document.getElementById('hero-intro');
    var heroTagsEl = document.getElementById('hero-tags');
    var alertBannerEl = document.getElementById('alert-banner');
    var cardGridEl = document.getElementById('card-grid');

    if (heroNameEl) heroNameEl.textContent = basicInfo.name;
    if (heroAgeEl) heroAgeEl.textContent = basicInfo.age + '岁 · ' + basicInfo.gender;
    if (heroIntroEl) heroIntroEl.textContent = basicInfo.intro;

    // 渲染标签
    if (heroTagsEl) {
      var tagsHTML = '';
      var tagTexts = ['烘焙达人', '公交活地图', '安静男孩', '弹琴中', '爱心满满'];
      tagTexts.forEach(function (t) {
        tagsHTML += '<span class="tag">' + t + '</span>';
      });
      heroTagsEl.innerHTML = tagsHTML;
    }

    // 渲染今日重点提醒
    if (alertBannerEl) {
      var alertHTML = '<div class="alert-item danger">🚫 严禁海鲜（虾、蟹、贝类）</div>';
      alertHTML += '<div class="alert-item warning">⏰ 下午15:00 支持性就业练习</div>';
      alertHTML += '<div class="alert-item info">📋 今日活动已提前告知</div>';
      alertBannerEl.innerHTML = alertHTML;
    }

    // 渲染导航卡片（首页只保留4个核心入口）
    if (cardGridEl) {
      var cards = [
        { hash: 'tasks', icon: '✅', title: '每日任务', desc: '打卡清单、完成进度' },
        { hash: 'calendar', icon: '📆', title: '日程日历', desc: '重要事项、日历提醒' },
        { hash: 'timeline', icon: '📅', title: '动态档案', desc: '记录时间轴' },
        { hash: 'charts', icon: '📊', title: '数据可视化', desc: '心情趋势、统计图表' }
      ];
      var gridHTML = '';
      cards.forEach(function (card) {
        gridHTML += '<div class="nav-card" data-navigate="' + card.hash + '">';
        gridHTML += '  <span class="card-icon">' + card.icon + '</span>';
        gridHTML += '  <div class="card-title">' + card.title + '</div>';
        gridHTML += '  <div class="card-desc">' + card.desc + '</div>';
        gridHTML += '</div>';
      });
      cardGridEl.innerHTML = gridHTML;

      // 绑定卡片点击事件
      cardGridEl.querySelectorAll('.nav-card').forEach(function (card) {
        card.addEventListener('click', function () {
          var target = this.getAttribute('data-navigate');
          if (target === 'collect') {
            navigateTo('collect');
          } else {
            window.location.hash = target;
          }
        });
      });
    }

    // 渲染欢迎语（根据当前角色）
    renderWelcomeBanner(user);

    // 渲染最新动态区域
    renderLatestActivity(user);

    // 渲染添加记录浮动按钮
    renderFAB();
  }

  /**
   * 渲染欢迎语横幅
   */
  function renderWelcomeBanner(user) {
    var existingBanner = document.getElementById('welcome-banner');
    if (existingBanner) existingBanner.remove();

    var heroSection = document.querySelector('.hero-section') || document.getElementById('hero');
    if (!heroSection) return;

    var roleName = user ? (ROLES[user.role] ? ROLES[user.role].label : '访客') : '访客';
    var avatar = user ? (user.avatar || '👤') : '👤';
    var welcomeText = user ? ('欢迎回来，' + (user.name || '用户') + '！') : '欢迎使用AI懂我';
    var subText = user ? ('您当前以「' + roleName + '」身份登录，可以为小雨添加记录。') : '请登录后开始记录。';

    var banner = document.createElement('div');
    banner.id = 'welcome-banner';
    banner.style.cssText = 'background:rgba(255,255,255,0.9);border-radius:8px;padding:8px 16px;margin:0 24px 8px;display:flex;align-items:center;gap:8px;box-shadow:0 1px 3px rgba(0,0,0,0.04);font-size:0.82rem;';
    banner.innerHTML =
      '<div style="font-size:1.2rem;">' + avatar + '</div>' +
      '<div style="flex:1;color:#666;">' +
      '  <span style="font-weight:600;color:#333;">' + welcomeText + '</span> ' + subText +
      '</div>' +
      '<a href="#profile" style="color:#4A90D9;text-decoration:none;white-space:nowrap;font-size:0.8rem;">个人中心 →</a>';

    heroSection.parentNode.insertBefore(banner, heroSection.nextSibling);
  }

  /**
   * 渲染最新动态区域
   */
  function renderLatestActivity(user) {
    var existingActivity = document.getElementById('latest-activity');
    if (existingActivity) existingActivity.remove();

    var mainContent = document.querySelector('.main-content');
    var cardGridEl = document.getElementById('card-grid');
    if (!cardGridEl || !mainContent) return;

    var records = DataStore.getRecords();
    var latestRecords = records.slice(0, 5);

    var activitySection = document.createElement('div');
    activitySection.id = 'latest-activity';
    activitySection.style.cssText = 'padding:0 24px;margin-bottom:24px;';

    var html = '';
    html += '<h2 style="font-size:1rem;color:#333;margin:12px 0 10px;display:flex;align-items:center;gap:8px;">';
    html += '  <span>📰</span>最新动态';
    html += '  <a href="#timeline" style="margin-left:auto;font-size:0.82rem;color:#4A90D9;text-decoration:none;">查看全部 →</a>';
    html += '</h2>';

    if (latestRecords.length === 0) {
      html += '<div style="background:#fff;border-radius:12px;padding:24px;text-align:center;color:#999;font-size:0.9rem;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
      html += '  <div style="font-size:2rem;margin-bottom:8px;">📝</div>';
      html += '  还没有记录，点击右下角的 + 按钮添加第一条记录吧！';
      html += '</div>';
    } else {
      html += '<div style="display:flex;flex-direction:column;gap:10px;">';
      latestRecords.forEach(function (record) {
        html += renderRecordCard(record, true);
      });
      html += '</div>';
    }

    activitySection.innerHTML = html;
    cardGridEl.parentNode.insertBefore(activitySection, cardGridEl.nextSibling);
  }

  /**
   * 渲染单条记录卡片
   * @param {Object} record - 记录对象
   * @param {boolean} isCompact - 是否紧凑模式
   */
  function renderRecordCard(record, isCompact) {
    var typeInfo = RECORD_TYPES[record.type] || { label: '记录', icon: '📝', color: '#999' };
    var roleInfo = ROLES[record.authorRole] || { color: '#999', avatar: '👤' };
    var dateDisplay = formatDateDisplay(record.date);
    var moodEmoji = '';

    if (record.type === 'mood' && record.mood) {
      var moodOpt = MOOD_OPTIONS.find(function (m) { return m.value === record.mood; });
      if (moodOpt) moodEmoji = moodOpt.emoji + ' ';
    }

    var html = '';
    if (isCompact) {
      html += '<div style="background:#fff;border-radius:12px;padding:14px 16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);border-left:3px solid ' + roleInfo.color + ';display:flex;align-items:flex-start;gap:10px;">';
      html += '  <div style="font-size:1.6rem;flex-shrink:0;">' + (record.authorAvatar || roleInfo.avatar) + '</div>';
      html += '  <div style="flex:1;min-width:0;">';
      html += '    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">';
      html += '      <span style="font-weight:600;color:#333;font-size:0.9rem;">' + record.author + '</span>';
      html += '      <span style="font-size:0.75rem;color:#fff;background:' + roleInfo.color + ';padding:1px 6px;border-radius:10px;">' + (ROLES[record.authorRole] ? ROLES[record.authorRole].label : record.authorRole) + '</span>';
      html += '      <span style="font-size:0.75rem;color:#aaa;margin-left:auto;white-space:nowrap;">' + dateDisplay + ' ' + record.time + '</span>';
      html += '    </div>';
      html += '    <div style="font-size:0.8rem;color:#888;margin-bottom:2px;">' + typeInfo.icon + ' ' + typeInfo.label + '</div>';
      html += '    <div style="font-size:0.88rem;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + moodEmoji + (record.title ? record.title + ' · ' : '') + record.content + '</div>';
      html += '  </div>';
      html += '</div>';
    } else {
      // 完整模式（时间轴用）
      html += '<div class="dynamic-record-card" style="background:#fff;border-radius:12px;padding:16px;margin-bottom:12px;box-shadow:0 1px 6px rgba(0,0,0,0.06);border-left:4px solid ' + roleInfo.color + ';">';
      html += '  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">';
      html += '    <span style="font-size:1.5rem;">' + (record.authorAvatar || roleInfo.avatar) + '</span>';
      html += '    <span style="font-weight:600;color:#333;">' + record.author + '</span>';
      html += '    <span style="font-size:0.75rem;color:#fff;background:' + roleInfo.color + ';padding:2px 8px;border-radius:10px;">' + (ROLES[record.authorRole] ? ROLES[record.authorRole].label : record.authorRole) + '</span>';
      html += '    <span style="font-size:0.8rem;color:#aaa;margin-left:auto;">' + dateDisplay + ' ' + record.time + '</span>';
      html += '  </div>';
      html += '  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">';
      html += '    <span style="font-size:0.8rem;padding:2px 8px;border-radius:6px;background:' + typeInfo.color + '15;color:' + typeInfo.color + ';">' + typeInfo.icon + ' ' + typeInfo.label + '</span>';
      if (record.mood) {
        var mOpt = MOOD_OPTIONS.find(function (m) { return m.value === record.mood; });
        if (mOpt) {
          html += '    <span style="font-size:0.8rem;padding:2px 8px;border-radius:6px;background:#f0f0f0;color:#666;">' + mOpt.emoji + ' ' + mOpt.label + '</span>';
        }
      }
      html += '  </div>';
      if (record.title) {
        html += '  <div style="font-weight:600;color:#333;margin-bottom:4px;font-size:0.95rem;">' + record.title + '</div>';
      }
      html += '  <div style="color:#555;font-size:0.9rem;line-height:1.5;">' + record.content + '</div>';
      html += '</div>';
    }

    return html;
  }

  /**
   * 渲染浮动添加按钮（FAB）
   */
  function renderFAB() {
    var existingFab = document.getElementById('fab-add-record');
    if (existingFab) existingFab.remove();

    var fab = document.createElement('button');
    fab.id = 'fab-add-record';
    fab.textContent = '+';
    fab.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#4A90D9;color:#fff;font-size:28px;border:none;box-shadow:0 4px 12px rgba(74,144,217,0.4);cursor:pointer;z-index:100;display:flex;align-items:center;justify-content:center;transition:all 0.3s;';
    fab.addEventListener('mouseenter', function () {
      this.style.transform = 'scale(1.1)';
      this.style.boxShadow = '0 6px 20px rgba(74,144,217,0.5)';
    });
    fab.addEventListener('mouseleave', function () {
      this.style.transform = 'scale(1)';
      this.style.boxShadow = '0 4px 12px rgba(74,144,217,0.4)';
    });
    fab.addEventListener('click', function () {
      openAddRecordModal();
    });

    document.body.appendChild(fab);
  }

  /* ==========================================================
   * 九、添加记录功能
   * ========================================================== */

  /**
   * 打开添加记录弹窗
   */
  function openAddRecordModal() {
    var user = DataStore.getCurrentUser() || appState.currentUser;
    if (!user) {
      alert('请先选择角色登录');
      window.location.hash = 'login';
      return;
    }

    var role = ROLES[user.role];
    if (!role || !role.canAdd || role.canAdd.length === 0) {
      alert('当前角色暂无添加记录的权限');
      return;
    }

    var overlay = document.getElementById('add-record-modal');
    if (!overlay) {
      overlay = createAddRecordModal();
    }
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 重置状态并渲染第一步
    addRecordState.selectedType = null;
    renderAddRecordStep1(user, role);
  }

  /**
   * 关闭添加记录弹窗
   */
  function closeAddRecordModal() {
    var overlay = document.getElementById('add-record-modal');
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
    addRecordState.selectedType = null;
  }

  /**
   * 创建添加记录弹窗DOM结构
   */
  function createAddRecordModal() {
    var overlay = document.createElement('div');
    overlay.id = 'add-record-modal';
    overlay.className = 'modal-overlay';
    // 不设置内联 display，让 CSS class 控制显示/隐藏

    overlay.innerHTML =
      '<div class="modal-content" style="background:#fff;border-radius:16px;max-width:560px;width:90%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">' +
      '  <div class="modal-header" style="padding:16px 20px;border-bottom:1px solid #eee;display:flex;align-items:center;justify-content:space-between;">' +
      '    <span class="modal-title" style="font-size:1.1rem;font-weight:600;color:#333;">添加记录</span>' +
      '    <button class="modal-close" id="add-record-close-btn" style="background:none;border:none;font-size:1.5rem;color:#999;cursor:pointer;">&times;</button>' +
      '  </div>' +
      '  <div id="add-record-body" class="modal-body" style="padding:20px;overflow-y:auto;flex:1;"></div>' +
      '  <div class="modal-footer" style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;">' +
      '    <button class="btn btn-ghost" id="btn-cancel-record" style="padding:8px 16px;border:1px solid #ddd;background:#fff;color:#666;border-radius:8px;cursor:pointer;">取消</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(overlay);

    // 绑定关闭按钮
    document.getElementById('add-record-close-btn').addEventListener('click', closeAddRecordModal);
    document.getElementById('btn-cancel-record').addEventListener('click', closeAddRecordModal);

    // 点击遮罩层关闭
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAddRecordModal();
    });

    return overlay;
  }

  /**
   * 渲染添加记录第一步 - 选择记录类型
   */
  function renderAddRecordStep1(user, role) {
    var bodyEl = document.getElementById('add-record-body');
    if (!bodyEl) return;

    var html = '';
    // 显示当前角色信息
    html += '<div style="background:#f5f7fa;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">';
    html += '  <span style="font-size:1.5rem;">' + user.avatar + '</span>';
    html += '  <div>';
    html += '    <div style="font-size:0.9rem;color:#333;">我是谁：<strong>' + user.name + '</strong>（' + role.label + '）</div>';
    html += '    <div style="font-size:0.8rem;color:#888;">请选择要添加的记录类型</div>';
    html += '  </div>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;">';
    role.canAdd.forEach(function (typeKey) {
      var type = RECORD_TYPES[typeKey];
      if (!type) return;
      html += '<div class="record-type-card" data-type="' + typeKey + '" style="background:#fff;border:2px solid #eee;border-radius:12px;padding:16px;text-align:center;cursor:pointer;transition:all 0.2s;">';
      html += '  <div style="font-size:2rem;margin-bottom:6px;">' + type.icon + '</div>';
      html += '  <div style="font-weight:600;color:#333;font-size:0.9rem;margin-bottom:2px;">' + type.label + '</div>';
      html += '  <div style="font-size:0.75rem;color:#888;">' + type.description + '</div>';
      html += '</div>';
    });
    html += '</div>';

    bodyEl.innerHTML = html;

    // 绑定类型选择事件
    bodyEl.querySelectorAll('.record-type-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var type = this.getAttribute('data-type');
        addRecordState.selectedType = type;
        renderAddRecordStep2(user, role, type);
      });
      card.addEventListener('mouseenter', function () {
        var t = RECORD_TYPES[this.getAttribute('data-type')];
        this.style.borderColor = t.color;
        this.style.transform = 'translateY(-2px)';
      });
      card.addEventListener('mouseleave', function () {
        this.style.borderColor = '#eee';
        this.style.transform = 'translateY(0)';
      });
    });
  }

  /**
   * 渲染添加记录第二步 - 填写表单
   */
  function renderAddRecordStep2(user, role, typeKey) {
    var bodyEl = document.getElementById('add-record-body');
    if (!bodyEl) return;

    var type = RECORD_TYPES[typeKey];
    if (!type) return;

    var html = '';
    // 当前角色信息 + 返回按钮
    html += '<div style="background:#f5f7fa;border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">';
    html += '  <span style="font-size:1.5rem;">' + user.avatar + '</span>';
    html += '  <div style="flex:1;">';
    html += '    <div style="font-size:0.9rem;color:#333;">我是谁：<strong>' + user.name + '</strong>（' + role.label + '）</div>';
    html += '    <div style="font-size:0.8rem;color:#888;">正在添加：' + type.icon + ' ' + type.label + '</div>';
    html += '  </div>';
    html += '  <button id="btn-back-to-types" style="background:none;border:none;color:#4A90D9;cursor:pointer;font-size:0.85rem;">← 返回</button>';
    html += '</div>';

    html += '<form id="add-record-form">';

    // 根据字段配置渲染表单
    type.fields.forEach(function (field) {
      switch (field) {
        case 'title':
          html += '<div style="margin-bottom:14px;">';
          html += '  <label style="display:block;font-size:0.85rem;color:#555;margin-bottom:4px;font-weight:500;">标题</label>';
          html += '  <input type="text" name="title" placeholder="请输入标题" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;" required>';
          html += '</div>';
          break;

        case 'content':
          html += '<div style="margin-bottom:14px;">';
          html += '  <label style="display:block;font-size:0.85rem;color:#555;margin-bottom:4px;font-weight:500;">内容</label>';
          html += '  <textarea name="content" placeholder="请详细描述..." rows="4" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;resize:vertical;" required></textarea>';
          html += '</div>';
          break;

        case 'mood':
          html += '<div style="margin-bottom:14px;">';
          html += '  <label style="display:block;font-size:0.85rem;color:#555;margin-bottom:8px;font-weight:500;">今天的心情</label>';
          html += '  <div style="display:flex;gap:8px;flex-wrap:wrap;">';
          MOOD_OPTIONS.forEach(function (mood) {
            html += '    <label class="mood-option" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 14px;border:2px solid #eee;border-radius:10px;transition:all 0.2s;background:#fff;">';
            html += '      <input type="radio" name="mood" value="' + mood.value + '" style="display:none;">';
            html += '      <span style="font-size:1.5rem;">' + mood.emoji + '</span>';
            html += '      <span style="font-size:0.75rem;color:#555;">' + mood.label + '</span>';
            html += '    </label>';
          });
          html += '  </div>';
          html += '</div>';
          break;

        case 'emotion_type':
          html += '<div style="margin-bottom:14px;">';
          html += '  <label style="display:block;font-size:0.85rem;color:#555;margin-bottom:8px;font-weight:500;">情绪类型</label>';
          html += '  <div style="display:flex;gap:8px;flex-wrap:wrap;">';
          EMOTION_OPTIONS.forEach(function (emotion) {
            html += '    <label class="emotion-option" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 14px;border:2px solid #eee;border-radius:10px;transition:all 0.2s;background:#fff;">';
            html += '      <input type="radio" name="emotion_type" value="' + emotion.value + '" style="display:none;">';
            html += '      <span style="font-size:1.5rem;">' + emotion.emoji + '</span>';
            html += '      <span style="font-size:0.75rem;color:#555;">' + emotion.value + '</span>';
            html += '    </label>';
          });
          html += '  </div>';
          html += '</div>';

          // 情绪事件额外字段：触发原因和应对方式
          html += '<div style="margin-bottom:14px;">';
          html += '  <label style="display:block;font-size:0.85rem;color:#555;margin-bottom:4px;font-weight:500;">触发原因 / 具体情况</label>';
          html += '  <textarea name="content" placeholder="描述情绪事件的触发原因、经过和应对方式..." rows="4" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:0.9rem;box-sizing:border-box;resize:vertical;" required></textarea>';
          html += '</div>';
          break;
      }
    });

    html += '</form>';

    bodyEl.innerHTML = html;

    // 更新底部按钮
    var footer = document.querySelector('#add-record-modal .modal-footer');
    if (footer) {
      footer.innerHTML =
        '<button class="btn btn-ghost" id="btn-cancel-record" style="padding:8px 16px;border:1px solid #ddd;background:#fff;color:#666;border-radius:8px;cursor:pointer;">取消</button>' +
        '<button class="btn btn-primary" id="btn-save-record" style="padding:8px 20px;border:none;background:' + type.color + ';color:#fff;border-radius:8px;cursor:pointer;font-weight:500;">保存记录</button>';

      document.getElementById('btn-cancel-record').addEventListener('click', closeAddRecordModal);
      document.getElementById('btn-save-record').addEventListener('click', saveRecord);
    }

    // 绑定返回按钮
    var backBtn = document.getElementById('btn-back-to-types');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        renderAddRecordStep1(user, role);
        // 恢复底部按钮
        var ft = document.querySelector('#add-record-modal .modal-footer');
        if (ft) {
          ft.innerHTML = '<button class="btn btn-ghost" id="btn-cancel-record" style="padding:8px 16px;border:1px solid #ddd;background:#fff;color:#666;border-radius:8px;cursor:pointer;">取消</button>';
          document.getElementById('btn-cancel-record').addEventListener('click', closeAddRecordModal);
        }
      });
    }

    // 绑定心情/情绪选项点击样式
    bodyEl.querySelectorAll('.mood-option, .emotion-option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        var name = this.querySelector('input').name;
        bodyEl.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
          input.parentElement.style.borderColor = '#eee';
          input.parentElement.style.background = '#fff';
        });
        this.style.borderColor = '#4A90D9';
        this.style.background = '#f0f7ff';
        this.querySelector('input').checked = true;
      });
    });
  }

  /**
   * 保存记录
   */
  function saveRecord() {
    var form = document.getElementById('add-record-form');
    if (!form) return;

    var user = DataStore.getCurrentUser() || appState.currentUser;
    var type = addRecordState.selectedType;
    if (!user || !type) return;

    var formData = new FormData(form);
    var record = {
      type: type,
      content: formData.get('content') || ''
    };

    if (formData.get('title')) record.title = formData.get('title');
    if (formData.get('mood')) record.mood = formData.get('mood');
    if (formData.get('emotion_type')) record.emotion_type = formData.get('emotion_type');

    // 验证必填
    var typeInfo = RECORD_TYPES[type];
    if (typeInfo.fields.indexOf('content') !== -1 && !record.content.trim()) {
      alert('请填写内容');
      return;
    }
    if (typeInfo.fields.indexOf('title') !== -1 && !record.title) {
      alert('请填写标题');
      return;
    }
    if (type === 'mood' && !record.mood) {
      alert('请选择心情');
      return;
    }

    // 添加作者信息
    record.author = user.name;
    record.authorRole = user.role;
    record.authorAvatar = (user.avatar || (ROLES[user.role] ? ROLES[user.role].avatar : '👤'));
    record.authorId = user.id;

    // 保存
    DataStore.addRecord(record);

    // 关闭弹窗
    closeAddRecordModal();

    // 刷新首页最新动态
    if (currentPage === 'home') {
      renderLatestActivity(user);
    }

    // 如果时间轴页面是活跃的，也刷新它
    if (currentPage === 'timeline') {
      renderTimeline();
    }

    // 显示成功提示
    showToast('✅ 记录添加成功！');
  }

  /**
   * 显示轻量提示
   */
  function showToast(message) {
    var existing = document.getElementById('app-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 20px;border-radius:20px;font-size:0.9rem;z-index:2000;animation:fadeInDown 0.3s ease;';

    // 添加简单动画
    var style = document.createElement('style');
    style.textContent = '@keyframes fadeInDown{from{opacity:0;transform:translateX(-50%) translateY(-10px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}';
    document.head.appendChild(style);

    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function () {
        toast.remove();
      }, 300);
    }, 2000);
  }

  /* ==========================================================
   * 十、"我喜欢的生活"页面渲染
   * ========================================================== */

  /**
   * 渲染"我喜欢的生活"页面 - 双列卡片（喜欢 & 不喜欢）
   */
  function renderLife() {
    var contentArea = document.getElementById('life-content');
    if (!contentArea) return;

    var html = '';

    // 喜欢的事物
    html += '<h2 class="section-title">💚 喜欢的事物</h2>';
    html += '<div class="two-col" style="margin-bottom:32px;">';
    likesList.forEach(function (item) {
      html += '<div class="content-card green">';
      html += '  <div style="font-size:2rem;margin-bottom:8px;">' + item.icon + '</div>';
      html += '  <div style="font-weight:600;font-size:1rem;margin-bottom:4px;">' + item.title + '</div>';
      html += '  <div style="font-size:0.88rem;color:#666;">' + item.desc + '</div>';
      html += '</div>';
    });
    html += '</div>';

    // 不喜欢的事物
    html += '<h2 class="section-title">🙅 不喜欢的事物</h2>';
    html += '<div class="two-col">';
    dislikesList.forEach(function (item) {
      html += '<div class="content-card red">';
      html += '  <div style="font-size:2rem;margin-bottom:8px;">' + item.icon + '</div>';
      html += '  <div style="font-weight:600;font-size:1rem;margin-bottom:4px;">' + item.title + '</div>';
      html += '  <div style="font-size:0.88rem;color:#666;">' + item.desc + '</div>';
      html += '</div>';
    });
    html += '</div>';

    contentArea.innerHTML = html;
  }

  /* ==========================================================
   * 十一、沟通说明书页面渲染
   * ========================================================== */

  /**
   * 渲染沟通说明书页面 - 三段式卡片
   */
  function renderCommunication() {
    var contentArea = document.getElementById('communication-content');
    if (!contentArea) return;

    var html = '';

    // 推荐做法（绿色）
    html += '<h2 class="section-title">✅ 这样和他沟通最有效</h2>';
    html += '<div class="content-card green">';
    html += '  <div class="card-section-title">✅ 推荐做法</div>';
    html += '  <ul class="card-list">';
    communicationGuide.best.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '  </ul>';
    html += '</div>';

    // 注意事项（黄色）
    html += '<h2 class="section-title">⚠️ 需要注意</h2>';
    html += '<div class="content-card yellow">';
    html += '  <div class="card-section-title">⚠️ 注意事项</div>';
    html += '  <ul class="card-list">';
    communicationGuide.caution.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '  </ul>';
    html += '</div>';

    // 避免做法（红色）
    html += '<h2 class="section-title">🚫 一定不要这样做</h2>';
    html += '<div class="content-card red">';
    html += '  <div class="card-section-title">🚫 避免做法</div>';
    html += '  <ul class="card-list">';
    communicationGuide.avoid.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '  </ul>';
    html += '</div>';

    contentArea.innerHTML = html;
  }

  /* ==========================================================
   * 十二、情绪与行为支持页面渲染
   * ========================================================== */

  /**
   * 渲染情绪与行为支持页面 - 流程图 + 彩色卡片
   */
  function renderEmotion() {
    var contentArea = document.getElementById('emotion-content');
    if (!contentArea) return;

    var html = '';

    // 流程图：触发 → 预警 → 安抚 → 危机
    html += '<h2 class="section-title">情绪支持流程</h2>';
    html += '<div class="flow-indicator">';
    html += '  <div class="flow-step red" data-flow="triggers">😰 触发因素</div>';
    html += '  <span class="flow-arrow">→</span>';
    html += '  <div class="flow-step yellow" data-flow="warnings">⚠️ 预警信号</div>';
    html += '  <span class="flow-arrow">→</span>';
    html += '  <div class="flow-step green" data-flow="soothing">💚 安抚策略</div>';
    html += '  <span class="flow-arrow">→</span>';
    html += '  <div class="flow-step red" data-flow="crisis">🆘 危机处理</div>';
    html += '</div>';

    // 触发因素
    html += '<div id="flow-triggers" class="flow-detail">';
    html += '  <div class="content-card red">';
    html += '    <div class="card-section-title">😰 触发因素</div>';
    html += '    <p style="font-size:0.88rem;color:#666;margin-bottom:8px;">以下情况可能引起小雨情绪波动：</p>';
    html += '    <ul class="card-list">';
    emotionSupport.triggers.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    // 预警信号
    html += '<div id="flow-warnings" class="flow-detail" style="display:none;">';
    html += '  <div class="content-card yellow">';
    html += '    <div class="card-section-title">⚠️ 预警信号</div>';
    html += '    <p style="font-size:0.88rem;color:#666;margin-bottom:8px;">当出现以下表现时，说明小雨可能正在变得焦虑：</p>';
    html += '    <ul class="card-list">';
    emotionSupport.warnings.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    // 安抚策略
    html += '<div id="flow-soothing" class="flow-detail" style="display:none;">';
    html += '  <div class="content-card green">';
    html += '    <div class="card-section-title">💚 安抚策略</div>';
    html += '    <p style="font-size:0.88rem;color:#666;margin-bottom:8px;">发现焦虑迹象时，请尝试以下方法：</p>';
    html += '    <ul class="card-list">';
    emotionSupport.soothing.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    // 危机处理
    html += '<div id="flow-crisis" class="flow-detail" style="display:none;">';
    html += '  <div class="content-card red">';
    html += '    <div class="card-section-title">🆘 危机处理</div>';
    html += '    <p style="font-size:0.88rem;color:#666;margin-bottom:8px;">紧急情况处理步骤：</p>';
    html += '    <ul class="card-list">';
    emotionSupport.crisis.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    contentArea.innerHTML = html;

    // 绑定流程步骤点击事件
    contentArea.querySelectorAll('.flow-step').forEach(function (step) {
      step.addEventListener('click', function () {
        // 移除所有active
        contentArea.querySelectorAll('.flow-step').forEach(function (s) {
          s.classList.remove('active');
        });
        this.classList.add('active');

        // 显示对应的详情面板
        var flowTarget = this.getAttribute('data-flow');
        contentArea.querySelectorAll('.flow-detail').forEach(function (d) {
          d.style.display = 'none';
        });
        var detailEl = document.getElementById('flow-' + flowTarget);
        if (detailEl) {
          detailEl.style.display = 'block';
        }
      });
    });

    // 默认选中第一个流程步骤
    var firstStep = contentArea.querySelector('.flow-step');
    if (firstStep) {
      firstStep.classList.add('active');
    }
  }

  /* ==========================================================
   * 十三、照护与医疗提醒页面渲染
   * ========================================================== */

  /**
   * 渲染照护与医疗提醒页面
   */
  function renderCare() {
    var contentArea = document.getElementById('care-content');
    if (!contentArea) return;

    var html = '';

    // 过敏警告（置顶醒目）
    html += '<div class="allergy-warning" data-privacy="C">';
    html += '  <div class="allergy-icon">🚨</div>';
    html += '  <div class="allergy-text">严重过敏警告</div>';
    html += '  <div class="allergy-detail">' + careInfo.allergy.items + ' — ' + careInfo.allergy.level + '</div>';
    html += '</div>';

    // 照护信息卡片
    html += '<div class="privacy-grid">';

    // 过敏详情
    html += '<div class="privacy-item" data-privacy="C">';
    html += '  <div class="privacy-label">过敏食物</div>';
    html += '  <div class="privacy-value" style="color:#F5222D;font-weight:700;">' + careInfo.allergy.items + '</div>';
    html += '</div>';

    // 过敏等级
    html += '<div class="privacy-item" data-privacy="C">';
    html += '  <div class="privacy-label">过敏等级</div>';
    html += '  <div class="privacy-value" style="color:#F5222D;font-weight:700;">' + careInfo.allergy.level + '</div>';
    html += '</div>';

    // 用药
    html += '<div class="privacy-item" data-privacy="B">';
    html += '  <div class="privacy-label">日常用药</div>';
    html += '  <div class="privacy-value">' + careInfo.medicine + '</div>';
    html += '</div>';

    // 体检
    html += '<div class="privacy-item" data-privacy="B">';
    html += '  <div class="privacy-label">体检安排</div>';
    html += '  <div class="privacy-value">' + careInfo.checkup + '</div>';
    html += '</div>';

    // 特殊事项
    html += '<div class="privacy-item" data-privacy="B">';
    html += '  <div class="privacy-label">特别注意事项</div>';
    html += '  <div class="privacy-value">' + careInfo.special + '</div>';
    html += '</div>';

    // 睡眠
    html += '<div class="privacy-item" data-privacy="C">';
    html += '  <div class="privacy-label">作息要求</div>';
    html += '  <div class="privacy-value">' + careInfo.sleep + '</div>';
    html += '</div>';

    html += '</div>';

    contentArea.innerHTML = html;
  }

  /* ==========================================================
   * 十四、工作支持页面渲染
   * ========================================================== */

  /**
   * 渲染工作支持页面 - 三栏布局
   */
  function renderWork() {
    var contentArea = document.getElementById('work-content');
    if (!contentArea) return;

    var html = '';

    html += '<div class="three-col">';

    // 能做的
    html += '<div>';
    html += '  <div class="content-card green">';
    html += '    <div class="card-section-title">✅ 能做的</div>';
    html += '    <ul class="card-list">';
    workInfo.canDo.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    // 需要支持的
    html += '<div>';
    html += '  <div class="content-card yellow">';
    html += '    <div class="card-section-title">⚠️ 需要支持的</div>';
    html += '    <ul class="card-list">';
    workInfo.needSupport.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    // 避免的
    html += '<div>';
    html += '  <div class="content-card red">';
    html += '    <div class="card-section-title">🚫 避免安排</div>';
    html += '    <ul class="card-list">';
    workInfo.avoid.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '    </ul>';
    html += '  </div>';
    html += '</div>';

    html += '</div>';

    contentArea.innerHTML = html;
  }

  /* ==========================================================
   * 十五、关系地图页面渲染
   * ========================================================== */

  /**
   * 渲染关系地图页面
   */
  function renderRelations() {
    var contentArea = document.getElementById('relations-content');
    if (!contentArea) return;

    var html = '';

    // 关系地图可视化（CSS圆圈定位）
    html += '<h2 class="section-title">关系地图</h2>';
    html += '<div class="relation-map">';

    // 最外层 - 避免圈
    html += '<div class="relation-circle avoid"></div>';
    // 中间层 - 日常圈
    html += '<div class="relation-circle daily"></div>';
    // 内层 - 核心圈
    html += '<div class="relation-circle core"></div>';

    // 中心 - 小雨
    html += '<div class="relation-center">小雨</div>';

    // 核心圈人物 - 按圆环位置分布
    var coreAngles = [90, 210, 330]; // 三个核心人物的角度
    var coreRadius = 25; // 核心圈半径百分比
    relationsInfo.core.forEach(function (person, idx) {
      var angle = coreAngles[idx] || 90;
      var x = 50 + coreRadius * Math.cos(angle * Math.PI / 180);
      var y = 50 + coreRadius * Math.sin(angle * Math.PI / 180);
      html += '<div class="relation-person core-person" style="left:' + x + '%;top:' + y + '%;" title="' + person.name + ' - ' + person.role + '">';
      html += '  <div class="person-avatar">' + person.emoji + '</div>';
      html += '  <div class="person-name">' + person.name + '</div>';
      html += '</div>';
    });

    // 日常圈人物
    var dailyAngles = [45, 315];
    var dailyRadius = 37;
    relationsInfo.daily.forEach(function (person, idx) {
      var angle = dailyAngles[idx] || 45;
      var x = 50 + dailyRadius * Math.cos(angle * Math.PI / 180);
      var y = 50 + dailyRadius * Math.sin(angle * Math.PI / 180);
      html += '<div class="relation-person daily-person" style="left:' + x + '%;top:' + y + '%;" title="' + person.name + ' - ' + person.role + '">';
      html += '  <div class="person-avatar">' + person.emoji + '</div>';
      html += '  <div class="person-name">' + person.name + '</div>';
      html += '</div>';
    });

    html += '</div>';

    // 关系图例
    html += '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:24px;flex-wrap:wrap;">';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.85rem;"><span style="width:12px;height:12px;border-radius:50%;background:#4A90D9;display:inline-block;"></span> 核心圈</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.85rem;"><span style="width:12px;height:12px;border-radius:50%;background:#52C41A;display:inline-block;"></span> 日常圈</div>';
    html += '<div style="display:flex;align-items:center;gap:6px;font-size:0.85rem;"><span style="width:12px;height:12px;border-radius:50%;background:#999;display:inline-block;"></span> 避免接触</div>';
    html += '</div>';

    // 详细列表
    html += '<div class="container" style="padding:0 24px;">';

    // 核心圈列表
    html += '<h2 class="section-title">核心支持圈</h2>';
    html += '<div class="content-card blue" style="margin-bottom:24px;">';
    html += '<ul class="card-list">';
    relationsInfo.core.forEach(function (person) {
      html += '<li>' + person.emoji + ' <strong>' + person.name + '</strong> — ' + person.role + '</li>';
    });
    html += '</ul>';
    html += '</div>';

    // 日常圈列表
    html += '<h2 class="section-title">日常接触圈</h2>';
    html += '<div class="content-card green" style="margin-bottom:24px;">';
    html += '<ul class="card-list">';
    relationsInfo.daily.forEach(function (person) {
      html += '<li>' + person.emoji + ' <strong>' + person.name + '</strong> — ' + person.role + '</li>';
    });
    html += '</ul>';
    html += '</div>';

    // 避免场景
    html += '<h2 class="section-title">避免的场景与接触</h2>';
    html += '<div class="content-card red">';
    html += '<ul class="card-list">';
    relationsInfo.avoid.forEach(function (item) {
      html += '<li>' + item + '</li>';
    });
    html += '</ul>';
    html += '</div>';

    html += '</div>';

    contentArea.innerHTML = html;
  }

  /* ==========================================================
   * 十六、动态记录时间轴页面渲染（改造后）
   * ========================================================== */

  /** 时间轴筛选状态 */
  let timelineFilters = {
    role: 'all',
    type: 'all'
  };

  /**
   * 渲染时间轴页面 - 动态记录 + 静态作息参考
   */
  /**
   * 构建照护档案HTML（整合所有关键照护信息）
   */
  function buildCareProfile() {
    var html = '';

    // 标题
    html += '<h2 style="font-size:1.1rem;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:8px;">';
    html += '  <span>🧡</span>照护档案';
    html += '  <span style="font-size:0.78rem;color:#999;font-weight:400;margin-left:auto;">快速了解小雨</span>';
    html += '</h2>';

    // === 安全提醒卡片（红色警告，最醒目）===
    html += '<div style="background:linear-gradient(135deg,#FFF1F0 0%,#FFE8E6 100%);border:1.5px solid #F5222D;border-radius:12px;padding:16px;margin-bottom:16px;">';
    html += '  <div style="font-size:0.95rem;font-weight:700;color:#F5222D;margin-bottom:8px;">🚫 安全红线</div>';
    html += '  <div style="display:flex;gap:8px;flex-wrap:wrap;">';
    html += '    <span style="background:#fff;color:#F5222D;padding:4px 12px;border-radius:6px;font-size:0.82rem;font-weight:500;">🦐 严禁海鲜（虾、蟹、贝类）</span>';
    html += '    <span style="background:#fff;color:#F5222D;padding:4px 12px;border-radius:6px;font-size:0.82rem;font-weight:500;">🤚 不要不打招呼碰他</span>';
    html += '    <span style="background:#fff;color:#F5222D;padding:4px 12px;border-radius:6px;font-size:0.82rem;font-weight:500;">⏰ 不要催他"快点"</span>';
    html += '    <span style="background:#fff;color:#F5222D;padding:4px 12px;border-radius:6px;font-size:0.82rem;font-weight:500;">📋 不要一次说很多件事</span>';
    html += '  </div>';
    html += '</div>';

    // === 基本信息卡片 ===
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">';
    // 喜好
    html += '<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="font-size:0.9rem;font-weight:600;color:#52C41A;margin-bottom:8px;">💚 喜欢的事物</div>';
    likesList.forEach(function (item) {
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.82rem;color:#555;">';
      html += '<span style="font-size:1rem;">' + item.icon + '</span>';
      html += '<span><strong>' + item.title + '</strong> · ' + item.desc + '</span>';
      html += '</div>';
    });
    html += '</div>';
    // 不喜欢
    html += '<div style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="font-size:0.9rem;font-weight:600;color:#F5222D;margin-bottom:8px;">⚠️ 需要注意</div>';
    dislikesList.forEach(function (item) {
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:0.82rem;color:#555;">';
      html += '<span style="font-size:1rem;">' + item.icon + '</span>';
      html += '<span><strong>' + item.title + '</strong> · ' + item.desc + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    // === 沟通指南 ===
    html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="font-size:0.9rem;font-weight:600;color:#4A90D9;margin-bottom:10px;">💬 沟通指南</div>';
    html += '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    // 推荐方式
    html += '    <div>';
    html += '      <div style="font-size:0.8rem;color:#52C41A;font-weight:600;margin-bottom:4px;">✅ 推荐这样做</div>';
    communicationGuide.best.forEach(function (t) {
      html += '<div style="font-size:0.8rem;color:#555;margin-bottom:3px;padding-left:12px;position:relative;">';
      html += '<span style="position:absolute;left:0;color:#52C41A;">·</span>' + t + '</div>';
    });
    html += '    </div>';
    // 避免方式
    html += '    <div>';
    html += '      <div style="font-size:0.8rem;color:#F5222D;font-weight:600;margin-bottom:4px;">❌ 避免这样做</div>';
    communicationGuide.avoid.forEach(function (t) {
      html += '<div style="font-size:0.8rem;color:#555;margin-bottom:3px;padding-left:12px;position:relative;">';
      html += '<span style="position:absolute;left:0;color:#F5222D;">·</span>' + t + '</div>';
    });
    html += '    </div>';
    html += '  </div>';
    html += '</div>';

    // === 情绪支持 ===
    html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="font-size:0.9rem;font-weight:600;color:#FAAD14;margin-bottom:10px;">🌈 情绪与行为支持</div>';
    html += '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
    // 触发因素
    html += '    <div style="background:#FFF7E6;border-radius:8px;padding:10px;">';
    html += '      <div style="font-size:0.78rem;color:#FAAD14;font-weight:600;margin-bottom:4px;">⚡ 触发因素</div>';
    emotionSupport.triggers.forEach(function (t) {
      html += '<div style="font-size:0.78rem;color:#666;margin-bottom:2px;">· ' + t + '</div>';
    });
    html += '    </div>';
    // 预警信号
    html += '    <div style="background:#FFF1F0;border-radius:8px;padding:10px;">';
    html += '      <div style="font-size:0.78rem;color:#F5222D;font-weight:600;margin-bottom:4px;">👀 预警信号</div>';
    emotionSupport.warnings.forEach(function (t) {
      html += '<div style="font-size:0.78rem;color:#666;margin-bottom:2px;">· ' + t + '</div>';
    });
    html += '    </div>';
    html += '  </div>';
    // 安抚策略
    html += '  <div style="background:#F0F9FF;border-radius:8px;padding:10px;margin-top:8px;">';
    html += '    <div style="font-size:0.78rem;color:#4A90D9;font-weight:600;margin-bottom:4px;">💚 安抚策略</div>';
    emotionSupport.soothing.forEach(function (t) {
      html += '<div style="font-size:0.78rem;color:#555;margin-bottom:2px;">· ' + t + '</div>';
    });
    html += '  </div>';
    html += '</div>';

    // === 医疗与照护信息 ===
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">';
    html += '  <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
    html += '    <div style="font-size:0.7rem;color:#999;">过敏</div>';
    html += '    <div style="font-size:0.82rem;font-weight:600;color:#F5222D;margin-top:2px;">虾蟹贝类</div>';
    html += '  </div>';
    html += '  <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
    html += '    <div style="font-size:0.7rem;color:#999;">用药</div>';
    html += '    <div style="font-size:0.82rem;font-weight:600;color:#722ED1;margin-top:2px;">每日睡前</div>';
    html += '  </div>';
    html += '  <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
    html += '    <div style="font-size:0.7rem;color:#999;">睡眠</div>';
    html += '    <div style="font-size:0.82rem;font-weight:600;color:#4A90D9;margin-top:2px;">22:00前</div>';
    html += '  </div>';
    html += '  <div style="background:#fff;border-radius:8px;padding:10px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);">';
    html += '    <div style="font-size:0.7rem;color:#999;">体检</div>';
    html += '    <div style="font-size:0.82rem;font-weight:600;color:#52C41A;margin-top:2px;">年度一次</div>';
    html += '  </div>';
    html += '</div>';

    // === 紧急联系人 ===
    html += '<div style="background:linear-gradient(135deg,#E8F4FD 0%,#F0F9FF 100%);border-radius:12px;padding:16px;margin-bottom:20px;">';
    html += '  <div style="font-size:0.9rem;font-weight:600;color:#4A90D9;margin-bottom:8px;">📞 紧急联系人</div>';
    html += '  <div style="display:flex;gap:12px;flex-wrap:wrap;">';
    relationsInfo.core.forEach(function (p) {
      html += '<div style="background:#fff;border-radius:8px;padding:8px 14px;display:flex;align-items:center;gap:6px;">';
      html += '<span style="font-size:1.1rem;">' + p.emoji + '</span>';
      html += '<div>';
      html += '<div style="font-size:0.82rem;font-weight:600;color:#333;">' + p.name + '</div>';
      html += '<div style="font-size:0.72rem;color:#999;">' + p.role + '</div>';
      html += '</div></div>';
    });
    html += '  </div>';
    html += '</div>';

    return html;
  }

  function renderTimeline() {
    var contentArea = document.getElementById('timeline-content');
    if (!contentArea) return;

    var html = '';

    // 页面标题和筛选器
    html += '<div class="page-header">';
    html += '  <button class="back-btn">←</button>';
    html += '  <span class="page-title">动态档案 · 时间轴</span>';
    html += '</div>';
    html += '<div class="container" style="padding:24px;">';

    // === 照护档案区域（置顶）===
    html += buildCareProfile();

    // 筛选区域
    html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="font-size:0.85rem;color:#666;margin-bottom:8px;font-weight:500;">🔍 筛选记录</div>';
    html += '  <div style="display:flex;gap:12px;flex-wrap:wrap;">';

    // 角色筛选
    html += '    <div style="display:flex;align-items:center;gap:6px;">';
    html += '      <label style="font-size:0.8rem;color:#888;white-space:nowrap;">角色：</label>';
    html += '      <select id="filter-role" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;background:#fff;">';
    html += '        <option value="all">全部角色</option>';
    Object.keys(ROLES).forEach(function (rKey) {
      var r = ROLES[rKey];
      html += '        <option value="' + rKey + '"' + (timelineFilters.role === rKey ? ' selected' : '') + '>' + r.label + '</option>';
    });
    html += '      </select>';
    html += '    </div>';

    // 类型筛选
    html += '    <div style="display:flex;align-items:center;gap:6px;">';
    html += '      <label style="font-size:0.8rem;color:#888;white-space:nowrap;">类型：</label>';
    html += '      <select id="filter-type" style="padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:0.85rem;background:#fff;">';
    html += '        <option value="all">全部类型</option>';
    Object.keys(RECORD_TYPES).forEach(function (tKey) {
      var t = RECORD_TYPES[tKey];
      html += '        <option value="' + tKey + '"' + (timelineFilters.type === tKey ? ' selected' : '') + '>' + t.icon + ' ' + t.label + '</option>';
    });
    html += '      </select>';
    html += '    </div>';

    html += '  </div>';
    html += '</div>';

    // 动态记录区域
    html += '<h2 style="font-size:1.1rem;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:8px;">';
    html += '  <span>📋</span>协同记录';
    html += '</h2>';

    var records = DataStore.getRecords();
    // 应用筛选
    var filteredRecords = records.filter(function (r) {
      if (timelineFilters.role !== 'all' && r.authorRole !== timelineFilters.role) return false;
      if (timelineFilters.type !== 'all' && r.type !== timelineFilters.type) return false;
      return true;
    });

    if (filteredRecords.length === 0) {
      html += '<div style="background:#fff;border-radius:12px;padding:32px;text-align:center;color:#999;font-size:0.9rem;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
      html += '  <div style="font-size:2rem;margin-bottom:8px;">📭</div>';
      html += '  暂无符合条件的记录';
      html += '</div>';
    } else {
      html += '<div style="margin-bottom:24px;">';
      filteredRecords.forEach(function (record) {
        html += renderRecordCard(record, false);
      });
      html += '</div>';
    }

    // 静态作息参考卡片
    html += '<h2 style="font-size:1.1rem;color:#333;margin-bottom:12px;display:flex;align-items:center;gap:8px;">';
    html += '  <span>📅</span>参考日程';
    html += '</h2>';

    html += '<div style="background:#fff;border-radius:12px;padding:16px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
    html += '  <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">';
    html += '    <span class="risk-badge green">安全</span>';
    html += '    <span class="risk-badge yellow">注意</span>';
    html += '    <span class="risk-badge red">重点关注</span>';
    html += '  </div>';

    html += '  <div class="timeline">';
    dailyRoutine.forEach(function (item, idx) {
      var riskLabel = item.risk === 'green' ? '安全' : (item.risk === 'yellow' ? '注意' : '重点');
      html += '    <div class="timeline-item">';
      html += '      <div class="timeline-dot ' + item.risk + '"></div>';
      html += '      <div class="timeline-card" data-timeline-idx="' + idx + '">';
      html += '        <div class="tl-header">';
      html += '          <span class="tl-time">' + item.time + '</span>';
      html += '          <span class="risk-badge ' + item.risk + '">' + riskLabel + '</span>';
      html += '        </div>';
      html += '        <div class="tl-title">' + item.title + '</div>';
      html += '        <div class="tl-body">' + item.activity + '</div>';
      html += '        <div class="tl-detail">';
      html += '          <p><strong>支持方式：</strong>' + item.support + '</p>';
      if (item.reminder) {
        html += '          <p style="color:#F5222D;margin-top:4px;"><strong>提醒：</strong>' + item.reminder + '</p>';
      }
      html += '        </div>';
      html += '      </div>';
      html += '    </div>';
    });
    html += '  </div>';
    html += '</div>';

    html += '</div>';

    contentArea.innerHTML = html;

    // 绑定筛选事件
    var roleFilter = document.getElementById('filter-role');
    var typeFilter = document.getElementById('filter-type');

    if (roleFilter) {
      roleFilter.addEventListener('change', function () {
        timelineFilters.role = this.value;
        renderTimeline();
      });
    }
    if (typeFilter) {
      typeFilter.addEventListener('change', function () {
        timelineFilters.type = this.value;
        renderTimeline();
      });
    }

    // 绑定时间轴卡片点击展开/收起
    contentArea.querySelectorAll('.timeline-card').forEach(function (card) {
      card.addEventListener('click', function () {
        this.classList.toggle('expanded');
      });
    });
  }

  /* ==========================================================
   * 十七、对话式采集页面渲染
   * ========================================================== */

  /**
   * 渲染对话式采集页面
   */
  function renderCollectPage() {
    var collectSection = document.getElementById('collect');
    if (!collectSection) {
      // 如果没有collect section，动态创建
      var mainContent = document.querySelector('.main-content');
      var section = document.createElement('section');
      section.id = 'collect';
      section.className = 'page-section';
      section.innerHTML = buildCollectHTML();
      mainContent.appendChild(section);
    } else if (!collectSection.querySelector('.chat-layout')) {
      collectSection.innerHTML = buildCollectHTML();
    }

    // 重置对话状态
    chatState = {
      currentStep: 0,
      messages: [],
      categories: [],
      profileName: '小雨'
    };
    appState.chatState = chatState;

    // 发送第一条AI消息
    setTimeout(function () {
      startChatConversation();
    }, 300);
  }

  /**
   * 构建对话采集页面的HTML结构
   */
  function buildCollectHTML() {
    var html = '';
    html += '<div class="page-header">';
    html += '  <button class="back-btn" onclick="window.location.hash=\'home\'">←</button>';
    html += '  <span class="page-title">对话式信息采集</span>';
    html += '</div>';
    html += '<div class="container" style="padding:24px;">';
    html += '  <div class="chat-layout">';
    // 左侧：对话面板
    html += '    <div class="chat-panel">';
    html += '      <div class="chat-panel-header">🤖 AI懂我 · 对话采集</div>';
    html += '      <div class="chat-messages" id="chat-messages"></div>';
    html += '      <div id="chat-options-area" class="chat-input-area" style="flex-direction:column;align-items:stretch;"></div>';
    html += '    </div>';
    // 右侧：AI归类面板
    html += '    <div class="categorize-panel">';
    html += '      <div class="chat-panel" style="height:100%;">';
    html += '        <div class="chat-panel-header">📋 AI 实时归类</div>';
    html += '        <div class="chat-messages" id="categorize-list" style="padding:16px;">';
    html += '          <div class="empty-state">';
    html += '            <div class="empty-icon">📋</div>';
    html += '            <div class="empty-text">对话开始后，AI将实时归类采集到的信息</div>';
    html += '          </div>';
    html += '        </div>';
    html += '      </div>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  /* ==========================================================
   * 十八、速读卡弹窗
   * ========================================================== */

  /**
   * 打开速读卡弹窗
   */
  function openQuickCard() {
    var overlay = document.getElementById('quick-card-modal');
    if (!overlay) {
      overlay = createQuickCardModal();
    }
    overlay.classList.add('active');

    // 渲染当前版本的速读卡内容
    renderQuickCardContent(currentQuickCardVersion);

    // 阻止body滚动
    document.body.style.overflow = 'hidden';
  }

  /**
   * 关闭速读卡弹窗
   */
  function closeQuickCard() {
    var overlay = document.getElementById('quick-card-modal');
    if (overlay) {
      overlay.classList.remove('active');
    }
    document.body.style.overflow = '';
  }

  /**
   * 创建速读卡弹窗DOM结构
   */
  function createQuickCardModal() {
    var overlay = document.createElement('div');
    overlay.id = 'quick-card-modal';
    overlay.className = 'modal-overlay';

    overlay.innerHTML =
      '<div class="modal-content">' +
      '  <div class="modal-header">' +
      '    <span class="modal-title">📋 速读卡</span>' +
      '    <button class="modal-close" id="modal-close-btn">&times;</button>' +
      '  </div>' +
      '  <div class="modal-body">' +
      '    <div class="version-tabs" id="version-tabs"></div>' +
      '    <div id="quick-card-body"></div>' +
      '  </div>' +
      '  <div class="modal-footer">' +
      '    <button class="btn btn-outline" id="btn-print-card">🖨️ 打印</button>' +
      '    <button class="btn btn-ghost" id="btn-close-modal">关闭</button>' +
      '  </div>' +
      '</div>';

    document.body.appendChild(overlay);

    // 绑定关闭按钮
    document.getElementById('modal-close-btn').addEventListener('click', closeQuickCard);
    document.getElementById('btn-close-modal').addEventListener('click', closeQuickCard);

    // 点击遮罩层关闭
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeQuickCard();
    });

    // 绑定打印按钮
    document.getElementById('btn-print-card').addEventListener('click', printQuickCard);

    // 渲染版本切换标签
    renderVersionTabs();

    return overlay;
  }

  /**
   * 渲染版本切换标签
   */
  function renderVersionTabs() {
    var tabsContainer = document.getElementById('version-tabs');
    if (!tabsContainer) return;

    var html = '';
    var keys = Object.keys(quickCardVersions);
    keys.forEach(function (key) {
      var version = quickCardVersions[key];
      var activeClass = (key === currentQuickCardVersion) ? ' active' : '';
      html += '<button class="version-tab' + activeClass + '" data-version="' + key + '">' + version.label + '</button>';
    });
    tabsContainer.innerHTML = html;

    // 绑定版本切换事件
    tabsContainer.querySelectorAll('.version-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var versionName = this.getAttribute('data-version');
        switchVersion(versionName);
      });
    });
  }

  /**
   * 切换速读卡版本
   * @param {string} versionName - 版本名称（standard/teacher/volunteer/institution）
   */
  function switchVersion(versionName) {
    currentQuickCardVersion = versionName;
    appState.currentQuickCardVersion = versionName;

    // 更新标签激活状态
    var tabs = document.querySelectorAll('.version-tab');
    tabs.forEach(function (tab) {
      tab.classList.remove('active');
      if (tab.getAttribute('data-version') === versionName) {
        tab.classList.add('active');
      }
    });

    // 重新渲染内容
    renderQuickCardContent(versionName);
  }

  /**
   * 渲染速读卡内容
   * @param {string} versionName - 版本名称
   */
  function renderQuickCardContent(versionName) {
    var bodyEl = document.getElementById('quick-card-body');
    if (!bodyEl) return;

    var version = quickCardVersions[versionName];
    if (!version) return;

    var html = '';
    html += '<div class="quick-card">';
    html += '  <div class="quick-card-header">' + basicInfo.name + '的速读卡 · ' + version.label + '</div>';

    version.sections.forEach(function (section) {
      html += '<div class="quick-card-section">';
      html += '  <div class="section-label ' + section.type + '">● ' + section.title + '</div>';
      html += '  <ul>';
      section.items.forEach(function (item) {
        html += '<li>' + item + '</li>';
      });
      html += '  </ul>';
      html += '</div>';
    });

    html += '<div class="quick-card-section" style="text-align:center;font-size:0.8rem;color:#999;padding:12px;">';
    html += '适用对象：' + version.target + ' | 生成时间：' + new Date().toLocaleDateString('zh-CN');
    html += '</div>';

    html += '</div>';

    bodyEl.innerHTML = html;
  }

  /**
   * 打印速读卡
   */
  function printQuickCard() {
    window.print();
  }

  /* ==========================================================
   * 十九、隐私分级
   * ========================================================== */

  /** 显示Toast通知 */
  function showToast(message) {
    var toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'app-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  /**
   * 切换角色视角（仅影响隐私显示级别）
   * 如果用户已登录且点击了不同的角色，提示需要退出重新登录才能以新身份记录
   * @param {string} roleName - 角色名称
   */
  function switchRole(roleName) {
    var user = DataStore.getCurrentUser() || appState.currentUser;

    // 如果用户已登录，提示退出重新登录
    if (user && user.role !== roleName) {
      var roleLabel = ROLES[roleName] ? ROLES[roleName].label : roleName;
      if (confirm('要切换到「' + roleLabel + '」吗？需要先退出当前账号。')) {
        logout();
      }
      return;
    }

    currentRole = roleName;
    appState.currentRole = roleName;
    applyPrivacy(roleName);
  }

  /**
   * 根据角色权限应用隐私设置
   * 使用 data-privacy 属性标记的元素将被显示或隐藏
   * @param {string} roleName - 角色名称
   */
  function applyPrivacy(roleName) {
    var allowedLevels = privacyLevels[roleName];
    if (!allowedLevels) return;

    // 获取所有带隐私标记的元素
    var privacyElements = document.querySelectorAll('[data-privacy]');
    privacyElements.forEach(function (el) {
      var level = el.getAttribute('data-privacy');
      if (allowedLevels.indexOf(level) !== -1) {
        // 当前角色可见此级别
        el.classList.remove('hidden-info');
        el.style.display = '';
        // 移除blur效果
        if (el.classList.contains('privacy-item')) {
          el.classList.remove('hidden-info');
        }
      } else {
        // 当前角色不可见此级别
        if (el.classList.contains('privacy-item')) {
          el.classList.add('hidden-info');
        } else {
          el.style.display = 'none';
        }
      }
    });
  }

  /* ==========================================================
   * 二十、对话式采集
   * ========================================================== */

  /**
   * 导航到对话采集页面
   */
  function navigateToCollect() {
    // 设置hash以支持返回按钮（hash相同时不会触发hashchange导致循环）
    if (window.location.hash !== '#collect') {
      window.location.hash = 'collect';
    }

    var collectSection = document.getElementById('collect');
    if (!collectSection) {
      // 在 main-content 中创建 collect section
      var mainContent = document.querySelector('.main-content');
      var section = document.createElement('section');
      section.id = 'collect';
      section.className = 'page-section';
      section.innerHTML = buildCollectHTML();
      mainContent.appendChild(section);
    } else if (!collectSection.querySelector('.chat-layout')) {
      collectSection.innerHTML = buildCollectHTML();
    }

    // 隐藏所有页面，显示collect
    document.querySelectorAll('.page-section').forEach(function (s) {
      s.classList.remove('active');
    });
    collectSection.classList.add('active');
    currentPage = 'collect';
    appState.currentPage = 'collect';
    window.scrollTo(0, 0);

    // 重置对话状态
    chatState = {
      currentStep: 0,
      messages: [],
      categories: [],
      profileName: '小雨'
    };
    appState.chatState = chatState;

    // 开始对话
    setTimeout(function () {
      startChatConversation();
    }, 300);
  }

  /**
   * 开始对话流程
   */
  function startChatConversation() {
    var messagesEl = document.getElementById('chat-messages');
    var optionsArea = document.getElementById('chat-options-area');
    var categorizeList = document.getElementById('categorize-list');

    if (messagesEl) messagesEl.innerHTML = '';
    if (optionsArea) optionsArea.innerHTML = '';

    // 发送第一条AI消息
    sendNextAIMessage();
  }

  /**
   * 发送下一条AI消息
   */
  function sendNextAIMessage() {
    var stepData = chatScript[chatState.currentStep];
    if (!stepData) return;

    // 替换占位符
    var messageText = stepData.aiMessage.replace(/\{name\}/g, chatState.profileName);

    // 添加AI消息气泡
    addMessage('ai', messageText);

    // 显示用户可选选项
    if (stepData.options.length > 0) {
      showOptions(stepData.options);
    }
  }

  /**
   * 添加消息气泡到对话面板
   * @param {string} role - 角色（'ai' 或 'user'）
   * @param {string} text - 消息文本
   */
  function addMessage(role, text) {
    var messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble ' + role;

    var prefix = (role === 'ai') ? '🤖 ' : '👤 ';
    bubble.textContent = prefix + text;

    messagesEl.appendChild(bubble);

    // 滚动到底部
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // 保存到消息历史
    chatState.messages.push({ role: role, text: text });
    appState.chatState = chatState;
  }

  /**
   * 显示预设选项按钮
   * @param {Array} options - 选项文本数组
   */
  function showOptions(options) {
    var optionsArea = document.getElementById('chat-options-area');
    if (!optionsArea) return;

    optionsArea.innerHTML = '';

    var container = document.createElement('div');
    container.className = 'chat-options';

    options.forEach(function (optionText) {
      var btn = document.createElement('button');
      btn.className = 'chat-option-btn';
      btn.textContent = optionText;

      btn.addEventListener('click', function () {
        handleUserSelection(optionText);
        // 清空选项
        container.innerHTML = '';
        optionsArea.innerHTML = '<p style="font-size:0.82rem;color:#999;text-align:center;padding:4px;">AI正在思考...</p>';
      });

      container.appendChild(btn);
    });

    optionsArea.appendChild(container);
  }

  /**
   * 处理用户选择
   * @param {string} selectedText - 用户选择的文本
   */
  function handleUserSelection(selectedText) {
    // 添加用户消息
    addMessage('user', selectedText);

    // AI归类（根据步骤归类到对应类别）
    categorizeMessage(chatState.currentStep, selectedText);

    // 前进到下一步
    chatState.currentStep++;
    appState.chatState = chatState;

    // 如果还有下一步，继续对话
    setTimeout(function () {
      var optionsArea = document.getElementById('chat-options-area');
      if (optionsArea) optionsArea.innerHTML = '';

      if (chatState.currentStep < chatScript.length) {
        sendNextAIMessage();
      }
    }, 800);
  }

  /**
   * AI归类 - 将用户回复归类到对应类别
   * @param {number} step - 当前步骤
   * @param {string} text - 用户回复文本
   */
  function categorizeMessage(step, text) {
    var categorizeList = document.getElementById('categorize-list');
    if (!categorizeList) return;

    // 清除初始的空状态提示
    var emptyState = categorizeList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // 根据步骤确定归类标签
    var labelMap = {
      0: '基本信息',
      1: '基本信息',
      2: '兴趣爱好',
      3: '不喜欢的事物',
      4: '医疗安全',
      5: '沟通方式',
      6: '情绪行为',
      7: '支持网络'
    };

    var label = labelMap[step] || '其他信息';

    // 提取关键信息
    var summaryText = text.replace(/我叫|我喜欢|他喜欢|她喜欢|没有|不要/g, '').trim();

    // 添加归类卡片
    var catItem = document.createElement('div');
    catItem.className = 'categorize-item';
    catItem.innerHTML =
      '<div class="cat-label">📁 ' + label + '</div>' +
      '<div class="cat-content">' + summaryText + '</div>';

    categorizeList.appendChild(catItem);

    // 保存归类
    chatState.categories.push({ label: label, content: summaryText });
    appState.chatState = chatState;

    // 滚动到底部
    categorizeList.scrollTop = categorizeList.scrollHeight;
  }

  /* ==========================================================
   * 二十一、工具函数
   * ========================================================== */

  /**
   * 根据风险等级获取中文标签
   * @param {string} risk - 风险等级（green/yellow/red）
   * @returns {string} 中文标签
   */
  function getRiskLabel(risk) {
    var map = {
      green: '安全',
      yellow: '注意',
      red: '重点'
    };
    return map[risk] || risk;
  }

  /* ==========================================================
   * 二十二、事件绑定与初始化
   * ========================================================== */

  /**
   * 绑定全局事件监听器
   */
  function bindGlobalEvents() {
    // 登录按钮
    var loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
      loginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doLogin();
      });
    }

    // 登录PIN码输入框回车触发登录
    var loginPin = document.getElementById('login-pin');
    if (loginPin) {
      loginPin.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          doLogin();
        }
      });
    }

    // 去注册按钮
    var showRegBtn = document.getElementById('btn-show-register');
    if (showRegBtn) {
      showRegBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showRegisterStep1();
      });
    }

    // 切换姓名输入方式（下拉/手动）
    var toggleNameBtn = document.getElementById('btn-toggle-name-input');
    if (toggleNameBtn) {
      toggleNameBtn.addEventListener('click', function (e) {
        e.preventDefault();
        toggleNameInputMode();
      });
    }

    // 去登录按钮
    var showLoginBtn = document.getElementById('btn-show-login');
    if (showLoginBtn) {
      showLoginBtn.addEventListener('click', function (e) {
        e.preventDefault();
        showLoginView();
      });
    }

    // 注册按钮
    var regBtn = document.getElementById('btn-register');
    if (regBtn) {
      regBtn.addEventListener('click', function (e) {
        e.preventDefault();
        doRegister();
      });
    }

    // 注册PIN码确认框回车触发注册
    var regPinConfirm = document.getElementById('register-pin-confirm');
    if (regPinConfirm) {
      regPinConfirm.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          doRegister();
        }
      });
    }

    // 返回选择角色按钮
    var backToRoleBtn = document.getElementById('btn-back-to-role');
    if (backToRoleBtn) {
      backToRoleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('login-view').style.display = 'none';
        document.getElementById('register-step2').style.display = 'none';
        document.getElementById('register-step1').style.display = 'block';
      });
    }

    // 退出登录按钮
    var navLogoutBtn = document.getElementById('btn-nav-logout');
    if (navLogoutBtn) {
      navLogoutBtn.addEventListener('click', function () {
        logout();
      });
    }

    // Esc键关闭弹窗
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeQuickCard();
        closeAddRecordModal();
      }
    });

    // 为所有 back-btn 绑定返回首页事件（使用事件委托，支持点击文字返回）
    document.addEventListener('click', function (e) {
      var backBtn = e.target.closest('.back-btn');
      if (backBtn) {
        window.location.hash = 'home';
      }
    });

    // 事件委托：速读卡和对话采集按钮、弹窗关闭按钮
    document.addEventListener('click', function (e) {
      if (e.target.id === 'btn-quick-card' || e.target.closest('#btn-quick-card')) {
        openQuickCard();
      }
      if (e.target.id === 'btn-collect' || e.target.closest('#btn-collect')) {
        navigateToCollect();
      }
      // 速读卡弹窗关闭按钮
      if (e.target.id === 'modal-close-btn' || e.target.id === 'btn-close-modal' || e.target.closest('#modal-close-btn') || e.target.closest('#btn-close-modal')) {
        closeQuickCard();
      }
      // 点击弹窗遮罩层关闭
      if (e.target.id === 'quick-card-modal') {
        closeQuickCard();
      }
    });
  }

  /**
   * 应用初始化 - DOMContentLoaded 时执行
   */
  function initApp() {
    // 初始化数据存储
    DataStore.init();

    // 加载当前用户
    var user = DataStore.getCurrentUser();
    if (user) {
      appState.currentUser = user;
      appState.currentRole = user.role;
      currentRole = user.role;
    }

    // 更新导航栏
    updateNavBar();

    // 绑定全局事件
    bindGlobalEvents();

    // 初始化路由系统
    initRouter();

    // 应用当前角色的隐私设置
    applyPrivacy(currentRole);

    console.log('AI懂我 - PIN码账号系统已初始化');
  }

  /* ==========================================================
   * 二十七、每日任务页面
   * ========================================================== */
  function renderTasks() {
    var contentArea = document.getElementById('tasks-content');
    if (!contentArea) return;

    var tasks = DataStore.getTasks();
    var today = getTodayString();
    var activeTasks = tasks.filter(function(t) { return t.isActive; });
    activeTasks.sort(function(a,b) { return (a.time||'99:99').localeCompare(b.time||'99:99'); });

    // 统计今日完成情况
    var completedCount = 0;
    var totalCount = activeTasks.length;
    activeTasks.forEach(function(t) {
      var todayCheck = t.checkins.find(function(c) { return c.date === today && c.status === 'done'; });
      if (todayCheck) completedCount++;
    });
    var percentage = totalCount > 0 ? Math.round(completedCount / totalCount * 100) : 0;

    var html = '';
    // 进度卡片
    html += '<div class="task-progress-card">';
    html += '  <div class="task-progress-circle" style="--progress: ' + percentage + '%;">';
    html += '    <div class="task-progress-text">' + percentage + '%</div>';
    html += '  </div>';
    html += '  <div class="task-progress-info">';
    html += '    <div style="font-size:1.1rem;font-weight:700;">今日进度</div>';
    html += '    <div style="font-size:0.9rem;color:#666;">已完成 ' + completedCount + ' / ' + totalCount + ' 项</div>';
    html += '    <div style="font-size:0.8rem;color:#999;">' + today + '</div>';
    html += '  </div>';
    html += '</div>';

    // 任务列表
    html += '<div class="task-list">';
    activeTasks.forEach(function(task) {
      var todayCheck = task.checkins.find(function(c) { return c.date === today; });
      var status = todayCheck ? todayCheck.status : 'pending';
      var statusClass = status === 'done' ? 'task-done' : (status === 'skip' ? 'task-skipped' : 'task-pending');

      html += '<div class="task-item ' + statusClass + '" data-task-id="' + task.id + '">';
      html += '  <div class="task-check" data-task-id="' + task.id + '" data-action="toggle">';
      if (status === 'done') {
        html += '<span style="color:#52C41A;font-size:1.3rem;">✅</span>';
      } else if (status === 'skip') {
        html += '<span style="color:#999;font-size:1.3rem;">⏭️</span>';
      } else {
        html += '<span class="task-check-circle"></span>';
      }
      html += '  </div>';
      html += '  <div class="task-info">';
      html += '    <div class="task-title">' + task.icon + ' ' + task.title + '</div>';
      if (task.time) html += '<div class="task-time">⏰ ' + task.time + '</div>';
      html += '    <div class="task-tip">💡 ' + task.supportTip + '</div>';
      html += '  </div>';
      html += '  <div class="task-actions">';
      if (status === 'pending') {
        html += '<button class="task-skip-btn" data-task-id="' + task.id + '" data-action="skip">跳过</button>';
      }
      if (status === 'done') {
        html += '<button class="task-undo-btn" data-task-id="' + task.id + '" data-action="undo">撤销</button>';
      }
      html += '</div></div>';
    });
    html += '</div>';

    // 添加新任务按钮
    html += '<div style="text-align:center;margin-top:20px;">';
    html += '<button id="btn-add-task" class="btn btn-outline" style="padding:10px 24px;">+ 添加新任务</button>';
    html += '</div>';

    // 本周打卡记录
    html += '<div class="task-week-section">';
    html += '<h3 style="font-size:1rem;margin-bottom:12px;">📅 本周打卡</h3>';
    html += '<div class="task-week-grid">';
    for (var i = 6; i >= 0; i--) {
      var dt = new Date();
      dt.setDate(dt.getDate() - i);
      var ds = dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
      var dayLabel = ['日','一','二','三','四','五','六'][dt.getDay()];
      var dayCompleted = 0;
      var dayTotal = activeTasks.length;
      activeTasks.forEach(function(t) {
        var c = t.checkins.find(function(ch) { return ch.date === ds && ch.status === 'done'; });
        if (c) dayCompleted++;
      });
      var ratio = dayTotal > 0 ? dayCompleted / dayTotal : 0;
      var isToday = ds === today;
      html += '<div class="task-week-day ' + (isToday ? 'today' : '') + '">';
      html += '<div class="task-week-label">周' + dayLabel + '</div>';
      html += '<div class="task-week-bar" style="background:conic-gradient(#4A90D9 ' + (ratio*360) + 'deg, #eee 0);">';
      html += '<div class="task-week-bar-inner"></div></div>';
      html += '<div class="task-week-count">' + dayCompleted + '/' + dayTotal + '</div>';
      html += '</div>';
    }
    html += '</div></div>';

    contentArea.innerHTML = html;
    bindTaskEvents(today);
  }

  function bindTaskEvents(today) {
    // 打卡/撤销事件委托
    document.getElementById('tasks-content').addEventListener('click', function(e) {
      var checkEl = e.target.closest('[data-action="toggle"]');
      var skipEl = e.target.closest('[data-action="skip"]');
      var undoEl = e.target.closest('[data-action="undo"]');

      if (checkEl) {
        var taskId = checkEl.dataset.taskId;
        DataStore.updateTaskCheckin(taskId, today, 'done', '');
        renderTasks();
      }
      if (skipEl) {
        var taskId = skipEl.dataset.taskId;
        DataStore.updateTaskCheckin(taskId, today, 'skip', '');
        renderTasks();
      }
      if (undoEl) {
        var taskId = undoEl.dataset.taskId;
        var tasks = DataStore.getTasks();
        var task = tasks.find(function(t) { return t.id === taskId; });
        if (task) {
          task.checkins = task.checkins.filter(function(c) { return c.date !== today; });
          var data = JSON.parse(localStorage.getItem('ai_dongwo_data'));
          var idx = data.tasks.findIndex(function(t) { return t.id === taskId; });
          if (idx >= 0) { data.tasks[idx] = task; localStorage.setItem('ai_dongwo_data', JSON.stringify(data)); }
          renderTasks();
        }
      }

      // 添加新任务
      if (e.target.closest('#btn-add-task')) {
        showAddTaskModal();
      }
    });
  }

  function showAddTaskModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'add-task-modal';
    overlay.innerHTML = '<div class="modal-content" style="max-width:440px;">' +
      '<div class="modal-header"><span class="modal-title">添加新任务</span><button class="modal-close" onclick="document.getElementById(\'add-task-modal\').remove();">&times;</button></div>' +
      '<div class="modal-body">' +
      '<div style="margin-bottom:12px;"><label class="form-label">任务名称</label><input class="form-input" id="new-task-title" placeholder="例如：做早操" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label class="form-label">图标</label><input class="form-input" id="new-task-icon" placeholder="🏃" maxlength="2" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div>' +
      '<div><label class="form-label">计划时间</label><input class="form-input" id="new-task-time" type="time" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div></div>' +
      '<div style="margin-bottom:12px;"><label class="form-label">支持提示</label><input class="form-input" id="new-task-tip" placeholder="给照顾者的提示" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div>' +
      '<button class="btn btn-primary" style="width:100%;padding:12px;border-radius:10px;" onclick="submitNewTask()">添加任务</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.getElementById('new-task-title').focus();
  }

  window.submitNewTask = function() {
    var title = document.getElementById('new-task-title').value.trim();
    if (!title) { showToast('请输入任务名称'); return; }
    var icon = document.getElementById('new-task-icon').value.trim() || '📋';
    var time = document.getElementById('new-task-time').value || '';
    var tip = document.getElementById('new-task-tip').value.trim() || '';
    DataStore.addTask({ title: title, icon: icon, category: 'custom', time: time, difficulty: 'easy', supportTip: tip, isActive: true });
    document.getElementById('add-task-modal').remove();
    document.body.style.overflow = '';
    showToast('任务添加成功');
    renderTasks();
  };

  /* ==========================================================
   * 二十八、日程日历页面
   * ========================================================== */
  var calendarState = { currentYear: 0, currentMonth: 0, selectedDate: null };

  function renderCalendar() {
    var contentArea = document.getElementById('calendar-content');
    if (!contentArea) return;
    var now = new Date();
    if (calendarState.currentYear === 0) {
      calendarState.currentYear = now.getFullYear();
      calendarState.currentMonth = now.getMonth();
    }
    if (!calendarState.selectedDate) calendarState.selectedDate = getTodayString();

    var events = DataStore.getEvents();
    var html = '';

    // 月份导航
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">';
    html += '<button id="cal-prev" class="btn btn-ghost" style="padding:8px 16px;">◀ 上月</button>';
    html += '<h2 style="margin:0;font-size:1.2rem;">' + calendarState.currentYear + '年' + (calendarState.currentMonth + 1) + '月</h2>';
    html += '<button id="cal-next" class="btn btn-ghost" style="padding:8px 16px;">下月 ▶</button>';
    html += '</div>';

    // 即将到来的事件提醒
    var upcoming = events.filter(function(e) { return e.date >= getTodayString(); }).sort(function(a,b) { return a.date.localeCompare(b.date); }).slice(0, 3);
    if (upcoming.length > 0) {
      html += '<div style="margin-bottom:20px;">';
      html += '<h3 style="font-size:0.95rem;margin-bottom:8px;">🔔 即将到来</h3>';
      upcoming.forEach(function(e) {
        html += '<div class="cal-upcoming-item" style="border-left:4px solid ' + (e.color||'#4A90D9') + ';background:#fff;border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span style="font-weight:600;">' + e.icon + ' ' + e.title + '</span>';
        html += '<span style="font-size:0.8rem;color:#999;">' + e.date + (e.time ? ' ' + e.time : '') + '</span>';
        html += '</div>';
        if (e.description) html += '<div style="font-size:0.82rem;color:#666;margin-top:4px;">' + e.description + '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    // 日历网格
    html += '<div class="calendar-grid">';
    var weekdays = ['日','一','二','三','四','五','六'];
    weekdays.forEach(function(d) {
      html += '<div class="cal-weekday">' + d + '</div>';
    });

    var firstDay = new Date(calendarState.currentYear, calendarState.currentMonth, 1).getDay();
    var daysInMonth = new Date(calendarState.currentYear, calendarState.currentMonth + 1, 0).getDate();
    var today = getTodayString();
    var eventDateMap = {};
    events.forEach(function(e) {
      if (!eventDateMap[e.date]) eventDateMap[e.date] = [];
      eventDateMap[e.date].push(e);
    });

    for (var i = 0; i < firstDay; i++) {
      html += '<div class="cal-day empty"></div>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = calendarState.currentYear + '-' + String(calendarState.currentMonth + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var isToday = dateStr === today;
      var isSelected = dateStr === calendarState.selectedDate;
      var dayEvents = eventDateMap[dateStr] || [];
      var cls = 'cal-day';
      if (isToday) cls += ' cal-today';
      if (isSelected) cls += ' cal-selected';
      html += '<div class="' + cls + '" data-date="' + dateStr + '">';
      html += '<div class="cal-day-num">' + d + '</div>';
      if (dayEvents.length > 0) {
        html += '<div class="cal-dots">';
        dayEvents.slice(0, 3).forEach(function(e) {
          html += '<span class="cal-dot" style="background:' + (e.color || '#4A90D9') + ';"></span>';
        });
        if (dayEvents.length > 3) html += '<span style="font-size:0.6rem;color:#999;">+' + (dayEvents.length-3) + '</span>';
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';

    // 选中日期事件详情
    html += '<div class="cal-event-panel">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
    html += '<h3 style="margin:0;font-size:1rem;">' + calendarState.selectedDate + ' 的日程</h3>';
    html += '<button id="btn-add-event" class="btn btn-primary" style="padding:6px 16px;font-size:0.85rem;border-radius:8px;">+ 添加日程</button>';
    html += '</div>';
    var selEvents = DataStore.getEventsByDate(calendarState.selectedDate);
    if (selEvents.length === 0) {
      html += '<div class="empty-state" style="padding:24px;"><div class="empty-icon">📅</div><div class="empty-text">当天没有日程安排</div></div>';
    } else {
      selEvents.sort(function(a,b) { return (a.time||'').localeCompare(b.time||''); });
      selEvents.forEach(function(evt) {
        html += '<div class="cal-event-item" style="border-left:4px solid ' + (evt.color||'#4A90D9') + ';background:#fff;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:8px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">';
        html += '<span style="font-weight:600;">' + evt.icon + ' ' + evt.title + '</span>';
        if (evt.time) html += '<span style="font-size:0.82rem;color:#999;">' + evt.time + (evt.endTime ? ' - ' + evt.endTime : '') + '</span>';
        html += '</div>';
        if (evt.description) html += '<div style="font-size:0.85rem;color:#666;">' + evt.description + '</div>';
        html += '<div style="text-align:right;margin-top:6px;"><button class="cal-event-del" data-id="' + evt.id + '" style="font-size:0.78rem;color:#F5222D;background:none;border:none;cursor:pointer;">删除</button></div>';
        html += '</div>';
      });
    }
    html += '</div>';

    contentArea.innerHTML = html;
    bindCalendarEvents();
  }

  function bindCalendarEvents() {
    var content = document.getElementById('calendar-content');
    content.addEventListener('click', function(e) {
      if (e.target.closest('#cal-prev')) {
        calendarState.currentMonth--;
        if (calendarState.currentMonth < 0) { calendarState.currentMonth = 11; calendarState.currentYear--; }
        renderCalendar();
      }
      if (e.target.closest('#cal-next')) {
        calendarState.currentMonth++;
        if (calendarState.currentMonth > 11) { calendarState.currentMonth = 0; calendarState.currentYear++; }
        renderCalendar();
      }
      var dayEl = e.target.closest('.cal-day[data-date]');
      if (dayEl) {
        calendarState.selectedDate = dayEl.dataset.date;
        renderCalendar();
      }
      if (e.target.closest('.cal-event-del')) {
        var id = e.target.closest('.cal-event-del').dataset.id;
        DataStore.deleteEvent(id);
        showToast('日程已删除');
        renderCalendar();
      }
      if (e.target.closest('#btn-add-event')) {
        showAddEventModal();
      }
    });
  }

  function showAddEventModal() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'add-event-modal';
    overlay.innerHTML = '<div class="modal-content" style="max-width:440px;">' +
      '<div class="modal-header"><span class="modal-title">添加日程</span><button class="modal-close" onclick="document.getElementById(\'add-event-modal\').remove();document.body.style.overflow=\'\';">&times;</button></div>' +
      '<div class="modal-body">' +
      '<div style="margin-bottom:12px;"><label class="form-label">标题</label><input class="form-input" id="new-event-title" placeholder="例如：看医生" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
      '<div><label class="form-label">日期</label><input class="form-input" id="new-event-date" type="date" value="' + (calendarState.selectedDate || getTodayString()) + '" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div>' +
      '<div><label class="form-label">时间</label><input class="form-input" id="new-event-time" type="time" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;"></div></div>' +
      '<div style="margin-bottom:12px;"><label class="form-label">描述</label><textarea class="form-input" id="new-event-desc" placeholder="补充说明" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;resize:vertical;"></textarea></div>' +
      '<div style="margin-bottom:12px;"><label class="form-label">类型</label><select id="new-event-type" style="width:100%;padding:10px 14px;border:1.5px solid #ddd;border-radius:8px;">' +
      '<option value="medical">🏥 医疗</option><option value="activity">🎨 活动</option><option value="meeting">📋 会议</option><option value="reminder">💊 提醒</option><option value="custom">📌 其他</option></select></div>' +
      '<button class="btn btn-primary" style="width:100%;padding:12px;border-radius:10px;" onclick="submitNewEvent()">添加日程</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.getElementById('new-event-title').focus();
  }

  window.submitNewEvent = function() {
    var title = document.getElementById('new-event-title').value.trim();
    if (!title) { showToast('请输入日程标题'); return; }
    var date = document.getElementById('new-event-date').value;
    if (!date) { showToast('请选择日期'); return; }
    var time = document.getElementById('new-event-time').value || '';
    var desc = document.getElementById('new-event-desc').value.trim();
    var type = document.getElementById('new-event-type').value;
    var icons = { medical: '🏥', activity: '🎨', meeting: '📋', reminder: '💊', custom: '📌' };
    var colors = { medical: '#F5222D', activity: '#FAAD14', meeting: '#4A90D9', reminder: '#722ED1', custom: '#13C2C2' };
    var user = appState.currentUser;
    DataStore.addEvent({
      title: title, type: type, icon: icons[type] || '📌',
      date: date, time: time, description: desc,
      recurring: 'none', priority: 'medium', color: colors[type] || '#4A90D9',
      author: user ? user.name : '未知', authorRole: user ? user.role : 'parent'
    });
    document.getElementById('add-event-modal').remove();
    document.body.style.overflow = '';
    showToast('日程已添加');
    renderCalendar();
  };

  /* ==========================================================
   * 二十三、DOMContentLoaded 启动
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', initApp);

  /* ==========================================================
   * 二十五、导出与打印模块
   * ========================================================== */
  var ExportModule = {
    exportToPDF: function(elementId, filename) {
      var element = document.getElementById(elementId);
      if (!element) { showToast('找不到导出内容'); return; }
      showToast('正在生成PDF，请稍候...');
      var opt = {
        margin: [10, 10, 10, 10],
        filename: (filename || 'AI懂我导出') + '.pdf',
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save();
    },
    exportRecords: function() {
      var records = DataStore.getRecords();
      if (records.length === 0) { showToast('暂无记录可导出'); return; }
      var container = document.createElement('div');
      container.id = 'export-temp';
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:#fff;padding:32px;font-family:"Microsoft YaHei",sans-serif;color:#333;';
      var html = '';
      html += '<div style="text-align:center;margin-bottom:24px;">';
      html += '<h1 style="font-size:1.5rem;color:#4A90D9;margin:0;">AI懂我 - 心智障碍者动态支持档案</h1>';
      html += '<p style="color:#999;font-size:0.85rem;">记录导出 · ' + getTodayString() + '</p>';
      html += '</div>';
      records.sort(function(a,b) { return (b.date+b.time).localeCompare(a.date+a.time); });
      var lastDate = '';
      records.forEach(function(r) {
        if (r.date !== lastDate) {
          html += '<h2 style="font-size:1rem;color:#4A90D9;border-bottom:1px solid #eee;padding-bottom:4px;margin:16px 0 8px;">' + r.date + '</h2>';
          lastDate = r.date;
        }
        var typeLabel = RECORD_TYPES[r.type] ? RECORD_TYPES[r.type].label : r.type;
        html += '<div style="background:#f9fafb;border-radius:8px;padding:12px 16px;margin-bottom:8px;border-left:3px solid #4A90D9;">';
        html += '<div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#999;margin-bottom:4px;">';
        html += '<span>' + (r.author||'') + ' · ' + typeLabel + '</span>';
        html += '<span>' + (r.time||'') + '</span>';
        html += '</div>';
        if (r.title) html += '<div style="font-weight:600;margin-bottom:4px;">' + r.title + '</div>';
        html += '<div style="font-size:0.9rem;line-height:1.6;">' + r.content + '</div>';
        if (r.mood) html += '<div style="margin-top:4px;font-size:0.85rem;">心情：' + r.mood + '</div>';
        if (r.emotion_type) html += '<div style="margin-top:4px;font-size:0.85rem;">情绪：' + r.emotion_type + '</div>';
        html += '</div>';
      });
      html += '<div style="text-align:center;margin-top:24px;color:#ccc;font-size:0.75rem;">由「AI懂我」系统生成</div>';
      container.innerHTML = html;
      document.body.appendChild(container);
      this.exportToPDF('export-temp', 'AI懂我-记录导出-' + getTodayString());
      setTimeout(function() { container.remove(); }, 5000);
    }
  };

  /* ==========================================================
   * 二十六、数据可视化页面
   * ========================================================== */
  var chartInstances = { moodTrend: null, typeDist: null, emotionBar: null };

  function renderCharts() {
    var contentArea = document.getElementById('charts-content');
    if (!contentArea) return;
    Object.keys(chartInstances).forEach(function(key) {
      if (chartInstances[key]) { chartInstances[key].destroy(); chartInstances[key] = null; }
    });
    var records = DataStore.getRecords();
    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;">';
    html += '<h2 style="margin:0;font-size:1.2rem;">📊 数据统计</h2>';
    html += '<div style="display:flex;gap:8px;">';
    html += '<button class="btn btn-outline" style="padding:8px 16px;font-size:0.85rem;" onclick="ExportModule.exportToPDF(\'charts-content\',\'AI懂我-数据报告-' + getTodayString() + '\')">📄 导出为PDF</button>';
    html += '</div></div>';

    // 统计概览卡片（可点击）
    var totalRecords = records.length;
    var moodRecords = records.filter(function(r) { return r.type === 'mood'; }).length;
    var emotionRecords = records.filter(function(r) { return r.type === 'emotion'; }).length;
    var activityRecords = records.filter(function(r) { return r.type === 'activity'; }).length;
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">';
    html += buildStatCard('📝', '总记录', totalRecords, '#4A90D9', 'all');
    html += buildStatCard('😊', '心情记录', moodRecords, '#52C41A', 'mood');
    html += buildStatCard('⚡', '情绪事件', emotionRecords, '#F5222D', 'emotion');
    html += buildStatCard('🎨', '活动记录', activityRecords, '#FAAD14', 'activity');
    html += '</div>';

    // 图表区域
    html += '<div id="charts-main-area">';
    html += '<div class="chart-card"><canvas id="chart-mood-trend"></canvas></div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">';
    html += '<div class="chart-card"><canvas id="chart-type-dist"></canvas></div>';
    html += '<div class="chart-card"><canvas id="chart-emotion-bar"></canvas></div>';
    html += '</div></div>';

    // 详情列表区域（默认隐藏）
    html += '<div id="charts-detail-area" style="display:none;"></div>';

    contentArea.innerHTML = html;
    renderMoodTrendChart(records);
    renderTypeDistChart(records);
    renderEmotionBarChart(records);

    // 绑定统计卡片点击事件
    contentArea.querySelectorAll('.stat-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var filterType = this.dataset.filter;
        renderChartDetail(filterType);
      });
    });
  }

  function buildStatCard(icon, label, value, color, filterType) {
    return '<div class="stat-card" data-filter="' + filterType + '" style="background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);text-align:center;cursor:pointer;transition:all 0.2s;border:2px solid transparent;">' +
      '<div style="font-size:1.5rem;margin-bottom:4px;">' + icon + '</div>' +
      '<div style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + value + '</div>' +
      '<div style="font-size:0.78rem;color:#999;">' + label + '</div></div>';
  }

  /** 渲染图表详情列表 */
  function renderChartDetail(filterType) {
    var records = DataStore.getRecords();
    var filtered = filterType === 'all' ? records : records.filter(function(r) { return r.type === filterType; });
    var typeLabels = { mood: '心情记录', emotion: '情绪事件', activity: '活动记录', all: '全部记录' };
    var typeLabel = typeLabels[filterType] || '记录';

    var detailArea = document.getElementById('charts-detail-area');
    var mainArea = document.getElementById('charts-main-area');
    if (!detailArea || !mainArea) return;

    mainArea.style.display = 'none';
    detailArea.style.display = 'block';

    var html = '';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="margin:0;font-size:1.1rem;">📋 ' + typeLabel + '（' + filtered.length + '条）</h3>';
    html += '<button class="btn btn-ghost" style="padding:6px 14px;font-size:0.85rem;" onclick="backToCharts()">← 返回图表</button>';
    html += '</div>';

    if (filtered.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">暂无' + typeLabel + '</div></div>';
    } else {
      filtered.sort(function(a, b) { return (b.date + b.time).localeCompare(a.date + a.time); });
      filtered.forEach(function(r) {
        var rt = RECORD_TYPES[r.type] || { label: r.type, color: '#4A90D9', icon: '📝' };
        html += '<div class="timeline-item" style="margin-bottom:10px;padding:14px 16px;background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,0.04);">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">';
        html += '<div style="display:flex;align-items:center;gap:8px;">';
        html += '<span style="font-size:1.1rem;">' + rt.icon + '</span>';
        html += '<span style="font-weight:600;font-size:0.92rem;">' + (r.title || rt.label) + '</span>';
        html += '</div>';
        html += '<span style="font-size:0.78rem;color:#999;white-space:nowrap;">' + r.date + ' ' + (r.time || '') + '</span>';
        html += '</div>';
        html += '<div style="font-size:0.88rem;color:#555;line-height:1.5;margin-bottom:6px;">' + r.content + '</div>';
        if (r.mood) html += '<div style="font-size:0.82rem;color:#52C41A;">😊 心情：' + r.mood + '</div>';
        if (r.emotion_type) html += '<div style="font-size:0.82rem;color:#F5222D;">⚡ 情绪：' + r.emotion_type + '</div>';
        html += '<div style="font-size:0.78rem;color:#bbb;margin-top:6px;">👤 ' + (r.author || '') + ' · ' + (RECORD_TYPES[r.type] ? RECORD_TYPES[r.type].label : r.type) + '</div>';
        html += '</div>';
      });
    }

    detailArea.innerHTML = html;
  }

  window.backToCharts = function() {
    var detailArea = document.getElementById('charts-detail-area');
    var mainArea = document.getElementById('charts-main-area');
    if (detailArea) detailArea.style.display = 'none';
    if (mainArea) mainArea.style.display = 'block';
  };

  function renderMoodTrendChart(records) {
    var ctx = document.getElementById('chart-mood-trend');
    if (!ctx || typeof Chart === 'undefined') return;
    var moodRecords = records.filter(function(r) { return r.type === 'mood'; });
    if (moodRecords.length < 2) {
      ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">需要至少2条心情记录才能展示趋势</div></div>';
      return;
    }
    var moodMap = { 'happy': 5, 'excited': 5, 'calm': 4, 'anxious': 2, 'sad': 1, 'angry': 1 };
    var labelMap = { 1: '难过', 2: '焦虑', 3: '一般', 4: '平静', 5: '开心' };
    var grouped = {};
    moodRecords.forEach(function(r) {
      if (!grouped[r.date]) grouped[r.date] = [];
      grouped[r.date].push(moodMap[r.mood] || 3);
    });
    var dates = Object.keys(grouped).sort();
    var data = dates.map(function(d) {
      var vals = grouped[d];
      return Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length);
    });
    chartInstances.moodTrend = new Chart(ctx, {
      type: 'line',
      data: {
        labels: dates.map(function(d) { return d.slice(5); }),
        datasets: [{
          label: '心情指数',
          data: data,
          borderColor: '#4A90D9',
          backgroundColor: 'rgba(74,144,217,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: '#4A90D9'
        }]
      },
      options: {
        responsive: true,
        plugins: { title: { display: true, text: '心情趋势', font: { size: 14 } } },
        scales: {
          y: { min: 1, max: 5, ticks: { callback: function(v) { return labelMap[v] || ''; }, stepSize: 1 } }
        }
      }
    });
  }

  function renderTypeDistChart(records) {
    var ctx = document.getElementById('chart-type-dist');
    if (!ctx || typeof Chart === 'undefined') return;
    var typeLabels = { mood: '心情', care: '照护', activity: '活动', communication: '沟通观察', emotion: '情绪事件', accompany: '陪伴', note: '备注' };
    var typeColors = { mood: '#52C41A', care: '#4A90D9', activity: '#FAAD14', communication: '#13C2C2', emotion: '#F5222D', accompany: '#722ED1', note: '#999' };
    var counts = {};
    records.forEach(function(r) { counts[r.type] = (counts[r.type] || 0) + 1; });
    var labels = [], data = [], colors = [];
    Object.keys(typeLabels).forEach(function(k) {
      if (counts[k]) { labels.push(typeLabels[k]); data.push(counts[k]); colors.push(typeColors[k]); }
    });
    if (data.length === 0) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-text">暂无记录数据</div></div>'; return; }
    chartInstances.typeDist = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
      options: { responsive: true, plugins: { title: { display: true, text: '记录类型分布', font: { size: 14 } } } }
    });
  }

  function renderEmotionBarChart(records) {
    var ctx = document.getElementById('chart-emotion-bar');
    if (!ctx || typeof Chart === 'undefined') return;
    var emotionRecords = records.filter(function(r) { return r.type === 'emotion'; });
    if (emotionRecords.length === 0) { ctx.parentElement.innerHTML = '<div class="empty-state"><div class="empty-text">暂无情绪事件记录</div></div>'; return; }
    var counts = {};
    emotionRecords.forEach(function(r) { var t = r.emotion_type || '未知'; counts[t] = (counts[t] || 0) + 1; });
    var sorted = Object.entries(counts).sort(function(a,b) { return b[1] - a[1]; });
    chartInstances.emotionBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(function(s) { return s[0]; }),
        datasets: [{ label: '次数', data: sorted.map(function(s) { return s[1]; }), backgroundColor: 'rgba(245,34,45,0.7)', borderRadius: 6 }]
      },
      options: { responsive: true, plugins: { title: { display: true, text: '情绪事件统计', font: { size: 14 } } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
  }

  /* ==========================================================
   * 二十七、暴露到全局作用域（供HTML onclick调用）
   * ========================================================== */
  window.openQuickCard = openQuickCard;
  window.closeQuickCard = closeQuickCard;
  window.switchVersion = switchVersion;
  window.printQuickCard = printQuickCard;
  window.switchRole = switchRole;
  window.openAddRecordModal = openAddRecordModal;
  window.closeAddRecordModal = closeAddRecordModal;
  window.doLogin = doLogin;
  window.doRegister = doRegister;
  window.logout = logout;
  window.ExportModule = ExportModule;

})();
