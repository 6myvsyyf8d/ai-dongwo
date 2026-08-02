// api/chatbot.js - Vercel Serverless Function
// 对话采集 AI 代理：支持 ping / classify / generateReply 三个 action
// 与 netlify/functions/chatbot.js 功能等价，仅函数签名不同
// API Key 存服务端环境变量 ZHIPU_API_KEY，前端不暴露

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

const MODULE_DESC = {
  communicationGuide: '沟通方式、表达习惯、理解能力、社交偏好',
  emotionBehavior: '情绪状态、行为表现、异常行为、情绪触发',
  careMedical: '饮食、睡眠、用药、健康状况、医疗相关',
  workSupport: '学习、工作、日常活动、任务安排',
  relationshipMap: '人际关系、家庭互动、社交网络'
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

async function callZhipu(messages, options) {
  options = options || {};
  const body = {
    model: options.model || 'glm-4-flash',
    messages: messages,
    temperature: options.temperature != null ? options.temperature : 0.7,
    max_tokens: options.maxTokens || 1024,
    stream: false
  };

  const response = await fetch(ZHIPU_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Zhipu API error:', response.status, errText);
    throw new Error('Zhipu API ' + response.status);
  }

  const data = await response.json();
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }
  return '';
}

async function classify(text, youthName) {
  const moduleList = Object.keys(MODULE_DESC)
    .map(k => `- ${k}: ${MODULE_DESC[k]}`)
    .join('\n');

  const systemPrompt = `你是一个文本分类助手。将用户描述的内容按句子归类到以下模块之一（如果无法归类则返回 null）：\n${moduleList}\n\n返回 JSON 数组格式：[{ "sentence": "原句", "module": "模块key或null", "confidence": 0.0-1.0 }]\n只返回 JSON，不要其他内容。`;

  const result = await callZhipu([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text }
  ], { temperature: 0.1, maxTokens: 512 });

  try {
    let jsonStr = result.trim();
    const match = jsonStr.match(/\[[\s\S]*\]/);
    if (match) jsonStr = match[0];
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('classify parse error:', e, result);
    return [];
  }
}

async function generateReply(history, youthName) {
  const systemPrompt = `你是一位专业的特殊教育/照护工作者，正在与${youthName || '心青年'}的照护者对话。\n` +
    '你的任务是：\n' +
    '1. 以温暖、专业、不评判的口吻回应\n' +
    '2. 从对话中提取有价值的照护信息\n' +
    '3. 追问细节以完善记录（如时间、频率、强度、触发因素等）\n' +
    '4. 回复控制在 2-3 句话，保持对话自然流畅\n' +
    '5. 不要使用"根据我的分析"等机械用语，像真人一样聊天';

  const messages = [{ role: 'system', content: systemPrompt }].concat(history);
  const reply = await callZhipu(messages, { temperature: 0.7, maxTokens: 300 });
  return reply;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).set(corsHeaders).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!process.env.ZHIPU_API_KEY) {
    return res.status(500).json({ error: '服务端未配置 ZHIPU_API_KEY' });
  }

  const body = req.body || {};
  const action = body.action;

  try {
    if (action === 'ping') {
      return res.status(200).json({ ok: true });
    }

    if (action === 'classify') {
      if (!body.text) {
        return res.status(400).json({ error: 'text 不能为空' });
      }
      const results = await classify(body.text, body.youthName);
      return res.status(200).json({ results: results });
    }

    if (action === 'generateReply') {
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return res.status(400).json({ error: 'messages 不能为空' });
      }
      const reply = await generateReply(body.messages, body.youthName);
      return res.status(200).json({ reply: reply });
    }

    return res.status(400).json({ error: '未知 action: ' + action });
  } catch (err) {
    console.error('chatbot handler error:', err);
    return res.status(502).json({ error: 'AI 服务暂时不可用', message: err.message });
  }
}
