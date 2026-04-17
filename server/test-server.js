import express from 'express'

const app = express()
const PORT = 3003

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Test server is running' })
})

app.get('/api/projects', (req, res) => {
  res.json({ success: true, projects: [], total: 0 })
})

const server = app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`)
  console.log(`Server address: ${JSON.stringify(server.address())}`)
})

server.on('error', (err) => {
  console.error('Server error:', err)
})

process.on('SIGINT', () => {
  console.log('Shutting down...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})
