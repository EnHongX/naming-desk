import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { 
  initDatabase, 
  saveNamingHistory, 
  toggleFavorite, 
  getHistory, 
  deleteHistory, 
  getHistoryById,
  getAllPreferences,
  getPreferenceByKey,
  updatePreference,
  getAllGlossaryTerms,
  getGlossaryTermById,
  getGlossaryTermByChinese,
  addGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm,
  createProject,
  getProjectById,
  getAllProjects,
  updateProject,
  deleteProject,
  addProjectNamingItem,
  getProjectNamingItemById,
  getProjectNamingItems,
  updateProjectNamingItemFinalResults,
  deleteProjectNamingItem,
  getProjectWithNamingItems,
  detectNamingStyle,
  splitNameIntoWords,
  checkGlossaryConflict,
  checkNamingConsistency
} from './database.js'
import { generateNamingWithAI, generateNamingWithAIWithContext } from './qwenService.js'

const app = express()
const PORT = 3003

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Naming Desk API is running' })
})

app.post('/api/generate', async (req, res) => {
  try {
    const { input } = req.body
    
    if (!input || !input.trim()) {
      return res.status(400).json({ error: 'input is required' })
    }

    const preferences = getAllPreferences()
    const glossaryTerms = getAllGlossaryTerms({ limit: 1000 })
    
    const results = await generateNamingWithAIWithContext(input, preferences, glossaryTerms)
    
    res.json({
      success: true,
      originalInput: input,
      results: {
        githubRepo: results.githubRepo || '',
        camelCase: results.camelCase || '',
        snakeCase: results.snakeCase || '',
        gitBranch: results.gitBranch || ''
      }
    })
  } catch (error) {
    console.error('Error generating naming:', error)
    res.status(500).json({ error: error.message || 'Failed to generate naming' })
  }
})

app.post('/api/generate/batch', async (req, res) => {
  try {
    const { inputs } = req.body
    
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ error: 'inputs array is required' })
    }

    const preferences = getAllPreferences()
    const glossaryTerms = getAllGlossaryTerms({ limit: 1000 })
    
    const results = []
    
    for (const input of inputs) {
      try {
        const namingResult = await generateNamingWithAIWithContext(input, preferences, glossaryTerms)
        results.push({
          originalInput: input,
          results: {
            githubRepo: namingResult.githubRepo || '',
            camelCase: namingResult.camelCase || '',
            snakeCase: namingResult.snakeCase || '',
            gitBranch: namingResult.gitBranch || ''
          }
        })
      } catch (error) {
        results.push({
          originalInput: input,
          error: error.message
        })
      }
    }
    
    res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error batch generating naming:', error)
    res.status(500).json({ error: error.message || 'Failed to batch generate naming' })
  }
})

app.post('/api/history', async (req, res) => {
  try {
    const { originalInput, results } = req.body
    
    if (!originalInput || !results) {
      return res.status(400).json({ error: 'originalInput and results are required' })
    }

    const id = saveNamingHistory(originalInput, results)
    res.json({ success: true, id })
  } catch (error) {
    console.error('Error saving history:', error)
    res.status(500).json({ error: 'Failed to save history' })
  }
})

app.get('/api/history', async (req, res) => {
  try {
    const { isFavorite, keyword, limit = 50, offset = 0 } = req.query
    
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
    
    if (isFavorite !== undefined) {
      options.isFavorite = isFavorite === 'true' || isFavorite === '1'
    }
    
    if (keyword) {
      options.keyword = keyword
    }

    const history = getHistory(options)
    res.json(history)
  } catch (error) {
    console.error('Error getting history:', error)
    res.status(500).json({ error: 'Failed to get history' })
  }
})

app.get('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    const item = getHistoryById(parseInt(id))
    
    if (!item) {
      return res.status(404).json({ error: 'History item not found' })
    }
    
    res.json(item)
  } catch (error) {
    console.error('Error getting history:', error)
    res.status(500).json({ error: 'Failed to get history' })
  }
})

app.put('/api/history/:id/favorite', async (req, res) => {
  try {
    const { id } = req.params
    const result = toggleFavorite(parseInt(id))
    
    if (!result) {
      return res.status(404).json({ error: 'History item not found' })
    }
    
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('Error toggling favorite:', error)
    res.status(500).json({ error: 'Failed to toggle favorite' })
  }
})

app.delete('/api/history/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = deleteHistory(parseInt(id))
    res.json(result)
  } catch (error) {
    console.error('Error deleting history:', error)
    res.status(500).json({ error: 'Failed to delete history' })
  }
})

app.get('/api/preferences', async (req, res) => {
  try {
    const preferences = getAllPreferences()
    res.json({
      success: true,
      preferences
    })
  } catch (error) {
    console.error('Error getting preferences:', error)
    res.status(500).json({ error: 'Failed to get preferences' })
  }
})

app.get('/api/preferences/:key', async (req, res) => {
  try {
    const { key } = req.params
    const preference = getPreferenceByKey(key)
    
    if (!preference) {
      return res.status(404).json({ error: 'Preference not found' })
    }
    
    res.json({
      success: true,
      preference
    })
  } catch (error) {
    console.error('Error getting preference:', error)
    res.status(500).json({ error: 'Failed to get preference' })
  }
})

app.put('/api/preferences/:key', async (req, res) => {
  try {
    const { key } = req.params
    const { value } = req.body
    
    if (value === undefined) {
      return res.status(400).json({ error: 'value is required' })
    }
    
    const updatedPreference = updatePreference(key, value)
    
    if (!updatedPreference) {
      return res.status(404).json({ error: 'Preference not found' })
    }
    
    res.json({
      success: true,
      preference: updatedPreference
    })
  } catch (error) {
    console.error('Error updating preference:', error)
    res.status(500).json({ error: 'Failed to update preference' })
  }
})

app.get('/api/glossary', async (req, res) => {
  try {
    const { keyword, limit = 100, offset = 0 } = req.query
    
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
    
    if (keyword) {
      options.keyword = keyword
    }
    
    const terms = getAllGlossaryTerms(options)
    res.json({
      success: true,
      terms,
      total: terms.length
    })
  } catch (error) {
    console.error('Error getting glossary terms:', error)
    res.status(500).json({ error: 'Failed to get glossary terms' })
  }
})

app.get('/api/glossary/:id', async (req, res) => {
  try {
    const { id } = req.params
    const term = getGlossaryTermById(parseInt(id))
    
    if (!term) {
      return res.status(404).json({ error: 'Glossary term not found' })
    }
    
    res.json({
      success: true,
      term
    })
  } catch (error) {
    console.error('Error getting glossary term:', error)
    res.status(500).json({ error: 'Failed to get glossary term' })
  }
})

app.post('/api/glossary', async (req, res) => {
  try {
    const { chineseTerm, englishTerm, priority, description } = req.body
    
    if (!chineseTerm || !chineseTerm.trim()) {
      return res.status(400).json({ error: 'chineseTerm is required' })
    }
    
    if (!englishTerm || !englishTerm.trim()) {
      return res.status(400).json({ error: 'englishTerm is required' })
    }
    
    const priorityValue = priority !== undefined ? (parseInt(priority) || 0) : 0
    const descriptionValue = description !== undefined ? description : ''
    
    const newTerm = addGlossaryTerm(
      chineseTerm.trim(), 
      englishTerm.trim(), 
      priorityValue, 
      descriptionValue
    )
    
    if (!newTerm) {
      return res.status(409).json({ error: 'Chinese term already exists' })
    }
    
    res.json({
      success: true,
      term: newTerm
    })
  } catch (error) {
    console.error('Error adding glossary term:', error)
    res.status(500).json({ error: 'Failed to add glossary term' })
  }
})

app.put('/api/glossary/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { chineseTerm, englishTerm, priority, description } = req.body
    
    if (!chineseTerm || !chineseTerm.trim()) {
      return res.status(400).json({ error: 'chineseTerm is required' })
    }
    
    if (!englishTerm || !englishTerm.trim()) {
      return res.status(400).json({ error: 'englishTerm is required' })
    }
    
    const priorityValue = priority !== undefined ? (parseInt(priority) || 0) : 0
    const descriptionValue = description !== undefined ? description : ''
    
    const updatedTerm = updateGlossaryTerm(
      parseInt(id),
      chineseTerm.trim(),
      englishTerm.trim(),
      priorityValue,
      descriptionValue
    )
    
    if (!updatedTerm) {
      const existing = getGlossaryTermById(parseInt(id))
      if (!existing) {
        return res.status(404).json({ error: 'Glossary term not found' })
      }
      return res.status(409).json({ error: 'Chinese term already exists' })
    }
    
    res.json({
      success: true,
      term: updatedTerm
    })
  } catch (error) {
    console.error('Error updating glossary term:', error)
    res.status(500).json({ error: 'Failed to update glossary term' })
  }
})

app.delete('/api/glossary/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = deleteGlossaryTerm(parseInt(id))
    res.json(result)
  } catch (error) {
    console.error('Error deleting glossary term:', error)
    res.status(500).json({ error: 'Failed to delete glossary term' })
  }
})

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }

    const project = createProject(name.trim(), description || '')
    res.json({
      success: true,
      project
    })
  } catch (error) {
    console.error('Error creating project:', error)
    res.status(500).json({ error: 'Failed to create project' })
  }
})

app.get('/api/projects', async (req, res) => {
  try {
    const { keyword, limit = 50, offset = 0 } = req.query
    
    const options = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    }
    
    if (keyword) {
      options.keyword = keyword
    }

    const projects = getAllProjects(options)
    res.json({
      success: true,
      projects,
      total: projects.length
    })
  } catch (error) {
    console.error('Error getting projects:', error)
    res.status(500).json({ error: 'Failed to get projects' })
  }
})

app.get('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params
    const project = getProjectWithNamingItems(parseInt(id))
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    res.json({
      success: true,
      project
    })
  } catch (error) {
    console.error('Error getting project:', error)
    res.status(500).json({ error: 'Failed to get project' })
  }
})

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description } = req.body
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }

    const updatedProject = updateProject(parseInt(id), name.trim(), description || '')
    
    if (!updatedProject) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    res.json({
      success: true,
      project: updatedProject
    })
  } catch (error) {
    console.error('Error updating project:', error)
    res.status(500).json({ error: 'Failed to update project' })
  }
})

app.delete('/api/projects/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = deleteProject(parseInt(id))
    res.json(result)
  } catch (error) {
    console.error('Error deleting project:', error)
    res.status(500).json({ error: 'Failed to delete project' })
  }
})

app.post('/api/projects/:id/naming-items/generate', async (req, res) => {
  try {
    const { id } = req.params
    const { inputs } = req.body
    
    const project = getProjectById(parseInt(id))
    if (!project) {
      return res.status(404).json({ error: 'Project not found' })
    }
    
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      return res.status(400).json({ error: 'inputs array is required' })
    }

    const preferences = getAllPreferences()
    const glossaryTerms = getAllGlossaryTerms({ limit: 1000 })
    
    const results = []
    
    for (const input of inputs) {
      try {
        const namingResult = await generateNamingWithAIWithContext(input, preferences, glossaryTerms)
        const namingItem = addProjectNamingItem(parseInt(id), input, namingResult)
        results.push({
          success: true,
          namingItem
        })
      } catch (error) {
        results.push({
          success: false,
          originalInput: input,
          error: error.message
        })
      }
    }
    
    res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error generating naming items for project:', error)
    res.status(500).json({ error: 'Failed to generate naming items' })
  }
})

app.put('/api/projects/naming-items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params
    const { finalResults } = req.body
    
    const updatedItem = updateProjectNamingItemFinalResults(parseInt(itemId), finalResults)
    
    if (!updatedItem) {
      return res.status(404).json({ error: 'Naming item not found' })
    }
    
    res.json({
      success: true,
      namingItem: updatedItem
    })
  } catch (error) {
    console.error('Error updating naming item:', error)
    res.status(500).json({ error: 'Failed to update naming item' })
  }
})

app.delete('/api/projects/naming-items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params
    const result = deleteProjectNamingItem(parseInt(itemId))
    res.json(result)
  } catch (error) {
    console.error('Error deleting naming item:', error)
    res.status(500).json({ error: 'Failed to delete naming item' })
  }
})

function convertToStyle(words, targetStyle) {
  if (!words || words.length === 0) {
    return ''
  }

  const lowerWords = words.map(w => w.toLowerCase())

  switch (targetStyle) {
    case 'kebab-case':
    case 'git-branch':
      return lowerWords.join('-')
    case 'snake_case':
      return lowerWords.join('_')
    case 'CONSTANT_CASE':
      return words.map(w => w.toUpperCase()).join('_')
    case 'camelCase':
      return lowerWords.map((w, i) => 
        i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)
      ).join('')
    case 'PascalCase':
      return lowerWords.map(w => 
        w.charAt(0).toUpperCase() + w.slice(1)
      ).join('')
    case 'lowercase':
      return lowerWords.join('')
    case 'UPPERCASE':
      return words.map(w => w.toUpperCase()).join('')
    default:
      return lowerWords.join('-')
  }
}

function buildCheckSystemPrompt(preferences, glossaryTerms) {
  let basePrompt = `你是一个专业的代码命名审查助手。用户会提供一组已有的命名（如 repo 名、分支名、字段名等），你需要根据以下规则进行审查：

1. 命名风格一致性检查：检查所有命名是否使用了相同的命名风格（camelCase、snake_case、kebab-case、PascalCase 等）
2. 术语表一致性检查：检查命名是否符合用户自定义的术语表
3. 命名偏好检查：检查是否符合用户设置的命名偏好
4. 提供修改建议：对于不符合规范的命名，给出修改后的建议

请严格按照以下 JSON 格式返回结果，不要添加任何额外内容：
{
  "overallAssessment": "整体评估，描述是否通过检查",
  "styleIssues": [
    {
      "originalName": "原始命名",
      "currentStyle": "当前风格",
      "suggestedStyle": "建议风格",
      "suggestedName": "修改后的命名",
      "reason": "原因说明"
    }
  ],
  "glossaryIssues": [
    {
      "originalName": "原始命名",
      "word": "问题单词",
      "expectedWord": "期望单词",
      "chineseTerm": "中文术语",
      "suggestedName": "修改后的命名",
      "reason": "原因说明"
    }
  ],
  "preferenceIssues": [
    {
      "originalName": "原始命名",
      "issue": "问题描述",
      "suggestion": "修改建议",
      "suggestedName": "修改后的命名"
    }
  ],
  "suggestedNames": [
    {
      "original": "原始命名",
      "suggested": "建议命名",
      "reasons": ["修改原因列表"]
    }
  ]
}

请确保：
- 只返回有效的 JSON 格式
- 所有字段都有值，如果没有问题则返回空数组
- 建议要具体、可操作`;

  if (preferences && preferences.length > 0) {
    basePrompt += `

用户偏好设置：`;
    for (const pref of preferences) {
      basePrompt += `
- ${pref.preference_key}: ${pref.preference_value} (${pref.description || ''})`;
    }
  }

  if (glossaryTerms && glossaryTerms.length > 0) {
    basePrompt += `

用户自定义术语表（请优先检查命名是否符合这些术语）：`;
    const sortedTerms = [...glossaryTerms].sort((a, b) => b.priority - a.priority);
    for (const term of sortedTerms) {
      basePrompt += `
- ${term.chinese_term}: ${term.english_term}${term.description ? ` (${term.description})` : ''}`;
    }
  }

  return basePrompt;
}

async function checkNamingWithAI(names, preferences, glossaryTerms) {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  const model = process.env.QWEN_MODEL || 'qwen3.5-flash';
  const baseUrl = process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    return null;
  }

  const systemPrompt = buildCheckSystemPrompt(preferences, glossaryTerms);
  
  const userMessage = `请审查以下命名：

${names.map((n, i) => `${i + 1}. ${n}`).join('\n')}

请按照要求返回 JSON 格式的审查结果。`;

  try {
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
            content: systemPrompt
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('AI 服务调用失败:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return null;
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
      return null;
    }
  } catch (error) {
    console.error('AI 命名检查失败:', error);
    return null;
  }
}

app.post('/api/check-naming', async (req, res) => {
  try {
    const { names, projectId } = req.body;
    
    if (!names || !Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required' })
    }

    const preferences = getAllPreferences()
    const glossaryTerms = getAllGlossaryTerms({ limit: 1000 })

    const results = {
      basicChecks: {
        styleAnalysis: {},
        glossaryAnalysis: {},
        consistencyCheck: null
      },
      aiAnalysis: null,
      suggestedNames: []
    }

    const styleAnalysis = {}
    for (const name of names) {
      const styleInfo = detectNamingStyle(name)
      const words = splitNameIntoWords(name)
      const glossaryCheck = checkGlossaryConflict(words, glossaryTerms)
      
      styleAnalysis[name] = {
        style: styleInfo.style,
        description: styleInfo.description,
        words: words,
        glossaryConflicts: glossaryCheck.conflicts,
        glossarySuggestions: glossaryCheck.suggestions
      }
    }
    results.basicChecks.styleAnalysis = styleAnalysis

    const allWords = []
    const glossaryAnalysis = {
      conflicts: [],
      suggestions: []
    }
    
    for (const name of names) {
      const words = splitNameIntoWords(name)
      const check = checkGlossaryConflict(words, glossaryTerms)
      
      for (const conflict of check.conflicts) {
        glossaryAnalysis.conflicts.push({
          name: name,
          ...conflict
        })
      }
      
      for (const suggestion of check.suggestions) {
        glossaryAnalysis.suggestions.push({
          name: name,
          ...suggestion
        })
      }
      
      allWords.push(...words)
    }
    results.basicChecks.glossaryAnalysis = glossaryAnalysis

    results.basicChecks.consistencyCheck = checkNamingConsistency(names)

    const suggestedNames = []
    const dominantStyle = results.basicChecks.consistencyCheck.dominantStyle
    
    for (const name of names) {
      const styleInfo = styleAnalysis[name]
      const suggestions = []
      let suggestedName = name
      
      if (!results.basicChecks.consistencyCheck.consistent && 
          styleInfo.style !== dominantStyle && 
          dominantStyle && 
          styleInfo.words.length > 0) {
        suggestedName = convertToStyle(styleInfo.words, dominantStyle)
        suggestions.push(`命名风格不一致，建议统一为 ${results.basicChecks.consistencyCheck.styleDescription}`)
      }
      
      const glossarySuggestions = glossaryAnalysis.suggestions.filter(s => s.name === name)
      if (glossarySuggestions.length > 0) {
        for (const gs of glossarySuggestions) {
          if (styleInfo.words.length > 0) {
            const updatedWords = styleInfo.words.map(w => 
              w.toLowerCase() === gs.original.toLowerCase() ? gs.suggested : w
            )
            suggestedName = convertToStyle(updatedWords, dominantStyle || styleInfo.style)
            suggestions.push(`术语 "${gs.original}" 建议替换为术语表中的 "${gs.suggested}"（中文：${gs.chineseTerm}）`)
          }
        }
      }
      
      if (suggestions.length > 0 || suggestedName !== name) {
        suggestedNames.push({
          original: name,
          suggested: suggestedName,
          reasons: suggestions.length > 0 ? suggestions : ['与其他命名风格保持一致']
        })
      }
    }
    results.suggestedNames = suggestedNames

    try {
      const aiResult = await checkNamingWithAI(names, preferences, glossaryTerms)
      if (aiResult) {
        results.aiAnalysis = aiResult
        
        if (aiResult.suggestedNames && aiResult.suggestedNames.length > 0) {
          for (const aiSuggestion of aiResult.suggestedNames) {
            const existing = results.suggestedNames.find(s => s.original === aiSuggestion.original)
            if (!existing && aiSuggestion.suggested !== aiSuggestion.original) {
              results.suggestedNames.push({
                original: aiSuggestion.original,
                suggested: aiSuggestion.suggested,
                reasons: aiSuggestion.reasons || ['AI 建议优化']
              })
            }
          }
        }
      }
    } catch (aiError) {
      console.error('AI 分析失败，使用基础检查结果:', aiError)
    }

    res.json({
      success: true,
      results
    })
  } catch (error) {
    console.error('Error checking naming:', error)
    res.status(500).json({ error: error.message || 'Failed to check naming' })
  }
})

async function startServer() {
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`Naming Desk API server running on http://localhost:${PORT}`)
  })
}

startServer()
