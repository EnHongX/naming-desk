import initSqlJs from 'sql.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_PATH = path.join(__dirname, 'naming.db')

let db = null

export async function initDatabase() {
  const SQL = await initSqlJs()
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS naming_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_input TEXT NOT NULL,
      github_repo TEXT,
      camel_case TEXT,
      snake_case TEXT,
      git_branch TEXT,
      is_favorite INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_favorite ON naming_history(is_favorite)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_created_at ON naming_history(created_at)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_original_input ON naming_history(original_input)
  `)

  saveDatabase()
  console.log('Database initialized successfully')
}

function saveDatabase() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

export function saveNamingHistory(originalInput, results) {
  const existing = db.exec(
    'SELECT id FROM naming_history WHERE original_input = ?',
    [originalInput]
  )

  if (existing.length > 0 && existing[0].values.length > 0) {
    const id = existing[0].values[0][0]
    db.run(`
      UPDATE naming_history 
      SET github_repo = ?, camel_case = ?, snake_case = ?, git_branch = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      results.githubRepo,
      results.camelCase,
      results.snakeCase,
      results.gitBranch,
      id
    ])
    saveDatabase()
    return id
  }

  const result = db.run(`
    INSERT INTO naming_history (original_input, github_repo, camel_case, snake_case, git_branch)
    VALUES (?, ?, ?, ?, ?)
  `, [
    originalInput,
    results.githubRepo,
    results.camelCase,
    results.snakeCase,
    results.gitBranch
  ])
  
  saveDatabase()
  return result.lastInsertRowid
}

export function toggleFavorite(id) {
  db.run(`
    UPDATE naming_history 
    SET is_favorite = 1 - is_favorite, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [id])
  saveDatabase()
  
  const result = db.exec(
    'SELECT is_favorite FROM naming_history WHERE id = ?',
    [id]
  )
  
  return result.length > 0 && result[0].values.length > 0 
    ? { isFavorite: result[0].values[0][0] === 1 }
    : null
}

export function getHistory(options = {}) {
  const { isFavorite, keyword, limit = 50, offset = 0 } = options
  
  let query = `
    SELECT id, original_input, github_repo, camel_case, snake_case, git_branch, 
           is_favorite, created_at, updated_at
    FROM naming_history
    WHERE 1=1
  `
  const params = []

  if (isFavorite !== undefined) {
    query += ' AND is_favorite = ?'
    params.push(isFavorite ? 1 : 0)
  }

  if (keyword) {
    query += ' AND (original_input LIKE ? OR github_repo LIKE ? OR camel_case LIKE ? OR snake_case LIKE ? OR git_branch LIKE ?)'
    const likeKeyword = `%${keyword}%`
    params.push(likeKeyword, likeKeyword, likeKeyword, likeKeyword, likeKeyword)
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const result = db.exec(query, params)
  
  if (result.length === 0) return []

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      if (col === 'is_favorite') {
        obj[col] = row[idx] === 1
      } else {
        obj[col] = row[idx]
      }
    })
    return obj
  })
}

export function deleteHistory(id) {
  db.run('DELETE FROM naming_history WHERE id = ?', [id])
  saveDatabase()
  return { success: true }
}

export function getHistoryById(id) {
  const result = db.exec(`
    SELECT id, original_input, github_repo, camel_case, snake_case, git_branch, 
           is_favorite, created_at, updated_at
    FROM naming_history
    WHERE id = ?
  `, [id])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    if (col === 'is_favorite') {
      obj[col] = row[idx] === 1
    } else {
      obj[col] = row[idx]
    }
  })
  return obj
}
