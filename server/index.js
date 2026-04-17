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
  getProjectWithNamingItems
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

async function startServer() {
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`Naming Desk API server running on http://localhost:${PORT}`)
  })
}

startServer()
