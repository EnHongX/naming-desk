import express from 'express'
import cors from 'cors'
import { initDatabase, saveNamingHistory, toggleFavorite, getHistory, deleteHistory, getHistoryById } from './database.js'

const app = express()
const PORT = 3002

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Naming Desk API is running' })
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

async function startServer() {
  await initDatabase()
  app.listen(PORT, () => {
    console.log(`Naming Desk API server running on http://localhost:${PORT}`)
  })
}

startServer()
