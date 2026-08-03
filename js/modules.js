/**
 * modules.js - 六大档案模块唯一定义源
 * 所有模块引用（标签、图标、关键词、颜色）均聚合于此
 * 加载顺序：在 constants.js 之后、profile.js 之前
 */
window.Modules = {
  MODULES: [
    { key: 'communicationGuide', label: '沟通与表达', shortLabel: '沟通', icon: '💬', color: '#9B85B8' },
    { key: 'emotionBehavior', label: '情绪与行为', shortLabel: '情绪', icon: '🌊', color: '#D4877B' },
    { key: 'careMedical', label: '照护与医疗', shortLabel: '医疗', icon: '💊', color: '#A8C9A0' },
    { key: 'workSupport', label: '工作与生活', shortLabel: '工作', icon: '💼', color: '#D4A85A' }
  ],
  MODULE_KEYWORDS: {
    communicationGuide: ['说话', '沟通', '表达', '理解', '手势', '图片', '示意', '说话方式', '交流', '听话', '指令', '语言', '口语', '非语言'],
    emotionBehavior: ['情绪', '哭', '笑', '生气', '焦虑', '害怕', '发脾气', '尖叫', '安静', '开心', '难过', '行为', '红线', '触发', '应对', '安抚', '情绪波动', '心情'],
    careMedical: ['药', '过敏', '医院', '医生', '检查', '用药', '剂量', '护理', '照护', '身体', '不适', '症状', '就诊', '体检', '药物', '作息', '起床', '睡觉', '吃饭', '日常'],
    workSupport: ['工作', '就业', '训练', 'ISP', '计划', '目标', '能力', '评估', '技能', '学习', '康复', '职业', '实习', '工作坊', '喜欢', '爱好', '想吃', '想去', '愿望', '开心', '活动', '游戏', '食物', '地方', '兴趣', '爱做', '偏好']
  },
  MODULE_LABELS: {
    communicationGuide: '💬 沟通与表达',
    emotionBehavior: '🌊 情绪与行为',
    careMedical: '💊 照护与医疗',
    workSupport: '💼 工作与生活'
  }
};
