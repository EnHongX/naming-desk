const SYSTEM_PROMPT = `你是一个专业的程序员命名助手。用户会输入中文描述，你需要根据描述生成符合编程规范的英文命名。

请严格按照以下 JSON 格式返回结果，不要添加任何额外内容：
{
  "githubRepo": "GitHub仓库名，使用kebab-case格式，简洁有意义",
  "camelCase": "变量/字段名，使用camelCase格式",
  "snakeCase": "常量/数据库字段名，使用snake_case格式",
  "gitBranch": "Git分支名，根据描述类型添加合适的前缀，如feature/, fix/, refactor/, docs/ 等"
}

命名规则：
1. GitHub仓库名：使用短横线连接的小写英文，简洁明了，如 user-management-system
2. camelCase：首字母小写，后续单词首字母大写，如 userManagementSystem
3. snake_case：全小写，用下划线连接，如 user_management_system
4. Git分支名：根据描述内容选择合适的前缀：
   - 新功能/新增：feature/xxx
   - 修复bug/问题：fix/xxx
   - 重构/优化：refactor/xxx
   - 文档：docs/xxx
   - 样式：style/xxx
   - 测试：test/xxx
   - 性能优化：perf/xxx
   - 构建/部署：build/xxx
   - 其他：chore/xxx

请确保：
- 命名自然、符合程序员习惯
- 翻译准确，不要生硬直译
- 保持简洁，不要过于冗长
- 所有字段都必须有值，不要留空`;

async function generateNamingWithAI(input) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.QWEN_MODEL || 'qwen3.5-flash';
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 未配置，请在 .env 文件中设置 API Key');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: input
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI 服务调用失败: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('AI 服务返回格式异常');
  }

  const content = data.choices[0].message.content;
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (parseError) {
    console.error('解析 AI 响应失败:', content);
    throw new Error('AI 响应解析失败，请重试');
  }
}

export { generateNamingWithAI };
