// api/chat.js - Vercel Serverless Function
// 心青年 AI 对话代理：调用智谱 GLM-4-Flash，注入心青年友好 System Prompt + 安全护栏
// API Key 存服务端环境变量 ZHIPU_API_KEY，前端不暴露

const ZHIPU_API = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// 心青年场景安全话题白名单边界
const DANGER_PATTERNS = /(自伤|自杀|不想活|杀|暴力|伤害自己|割腕|跳楼|吃药.*瓶|死掉|去死)/;

export default async function handler(req, res) {
  // CORS & 方法校验
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { messages = [], youthProfile = {} } = req.body || {};

  // 入参校验
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages 不能为空' });
  }

  // 危险信号检测：用户消息中出现自伤/暴力关键词时，触发安全回复
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUserMsg ? (lastUserMsg.content || '') : '';
  if (DANGER_PATTERNS.test(userText)) {
    return res.status(200).json({
      reply: '这个话题我们和爸爸妈妈一起聊好吗？🤗 如果你现在不舒服，可以马上告诉身边的大人，或者拨打 12345 寻求帮助。',
      safetyAlert: true
    });
  }

  // 心青年友好的 System Prompt + 安全护栏 + 档案上下文（脱敏）
  const systemPrompt = `你是心青年的温暖伙伴。请严格遵守：
1. 用简单、正向、8-15 字短句回复，避免抽象问法
2. 禁止讨论自伤、暴力、成人话题，遇到时回复"这个话题我们和爸爸妈妈一起聊好吗？"并提示联系家长
3. 不主动询问敏感信息（身份证、医疗细节、家庭住址）
4. 多用 emoji 表达情绪，语气温柔耐心，把心青年当作好朋友
5. 如果心青年表达难过/焦虑，先共情再温和转移话题，不要追问细节

当前心青年档案摘要（仅用于个性化回复，不要复述这些信息）：
- 姓名：${youthProfile.name || '未知'}
- 年龄：${youthProfile.age || '未知'}
- 兴趣：${(youthProfile.interests || []).join('、') || '未知'}
- 沟通特点：${youthProfile.communicationStyle || '未知'}`;

  try {
    const response = await fetch(ZHIPU_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }))
        ],
        temperature: 0.7,
        max_tokens: 150,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Zhipu API error:', response.status, errText);
      return res.status(502).json({ error: 'AI 服务暂时不可用', fallback: true });
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '我没能理解，可以再说一次吗？😊';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('chat handler error:', err);
    return res.status(500).json({ error: 'AI 服务暂时不可用', fallback: true });
  }
}
