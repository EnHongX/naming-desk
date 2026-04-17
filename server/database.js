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

  db.run(`
    CREATE TABLE IF NOT EXISTS naming_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      preference_key TEXT NOT NULL UNIQUE,
      preference_value TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS glossary_terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chinese_term TEXT NOT NULL UNIQUE,
      english_term TEXT NOT NULL,
      priority INTEGER DEFAULT 0,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_chinese_term ON glossary_terms(chinese_term)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at)
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS project_naming_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      original_input TEXT NOT NULL,
      generated_results TEXT,
      final_results TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `)

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_naming_items_project ON project_naming_items(project_id)
  `)
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_naming_items_created_at ON project_naming_items(created_at)
  `)

  const defaultPreferences = [
    { key: 'namingStyle', value: 'balanced', description: '命名风格偏好：concise(简洁) / balanced(平衡) / detailed(详细)' },
    { key: 'wordPreference', value: 'standard', description: '单词偏好：standard(标准) / american(美式) / british(英式)' },
    { key: 'abbreviationThreshold', value: '3', description: '缩写阈值：超过此长度的单词考虑缩写' }
  ]

  for (const pref of defaultPreferences) {
    db.run(`
      INSERT OR IGNORE INTO naming_preferences (preference_key, preference_value, description)
      VALUES (?, ?, ?)
    `, [pref.key, pref.value, pref.description])
  }

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

export function getAllPreferences() {
  const result = db.exec(`
    SELECT id, preference_key, preference_value, description, created_at, updated_at
    FROM naming_preferences
    ORDER BY preference_key
  `)

  if (result.length === 0) return []

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })
}

export function getPreferenceByKey(key) {
  const result = db.exec(`
    SELECT id, preference_key, preference_value, description, created_at, updated_at
    FROM naming_preferences
    WHERE preference_key = ?
  `, [key])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    obj[col] = row[idx]
  })
  return obj
}

export function updatePreference(key, value) {
  db.run(`
    UPDATE naming_preferences 
    SET preference_value = ?, updated_at = CURRENT_TIMESTAMP
    WHERE preference_key = ?
  `, [value, key])
  saveDatabase()
  
  return getPreferenceByKey(key)
}

export function getAllGlossaryTerms(options = {}) {
  const { keyword, limit = 100, offset = 0 } = options
  
  let query = `
    SELECT id, chinese_term, english_term, priority, description, created_at, updated_at
    FROM glossary_terms
    WHERE 1=1
  `
  const params = []

  if (keyword) {
    query += ' AND (chinese_term LIKE ? OR english_term LIKE ? OR description LIKE ?)'
    const likeKeyword = `%${keyword}%`
    params.push(likeKeyword, likeKeyword, likeKeyword)
  }

  query += ' ORDER BY priority DESC, chinese_term ASC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const result = db.exec(query, params)
  
  if (result.length === 0) return []

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })
}

export function getGlossaryTermById(id) {
  const result = db.exec(`
    SELECT id, chinese_term, english_term, priority, description, created_at, updated_at
    FROM glossary_terms
    WHERE id = ?
  `, [id])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    obj[col] = row[idx]
  })
  return obj
}

export function getGlossaryTermByChinese(chineseTerm) {
  const result = db.exec(`
    SELECT id, chinese_term, english_term, priority, description, created_at, updated_at
    FROM glossary_terms
    WHERE chinese_term = ?
  `, [chineseTerm])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    obj[col] = row[idx]
  })
  return obj
}

export function addGlossaryTerm(chineseTerm, englishTerm, priority = 0, description = '') {
  const existing = db.exec(
    'SELECT id FROM glossary_terms WHERE chinese_term = ?',
    [chineseTerm]
  )

  if (existing.length > 0 && existing[0].values.length > 0) {
    return null
  }

  const result = db.run(`
    INSERT INTO glossary_terms (chinese_term, english_term, priority, description)
    VALUES (?, ?, ?, ?)
  `, [chineseTerm, englishTerm, priority, description])
  
  saveDatabase()
  
  return getGlossaryTermById(result.lastInsertRowid)
}

export function updateGlossaryTerm(id, chineseTerm, englishTerm, priority, description) {
  const existing = db.exec(
    'SELECT id FROM glossary_terms WHERE chinese_term = ? AND id != ?',
    [chineseTerm, id]
  )

  if (existing.length > 0 && existing[0].values.length > 0) {
    return null
  }

  db.run(`
    UPDATE glossary_terms 
    SET chinese_term = ?, english_term = ?, priority = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [chineseTerm, englishTerm, priority, description, id])
  saveDatabase()
  
  return getGlossaryTermById(id)
}

export function deleteGlossaryTerm(id) {
  db.run('DELETE FROM glossary_terms WHERE id = ?', [id])
  saveDatabase()
  return { success: true }
}

export function createProject(name, description = '') {
  const result = db.run(`
    INSERT INTO projects (name, description)
    VALUES (?, ?)
  `, [name, description])
  
  saveDatabase()
  
  return getProjectById(result.lastInsertRowid)
}

export function getProjectById(id) {
  const result = db.exec(`
    SELECT id, name, description, created_at, updated_at
    FROM projects
    WHERE id = ?
  `, [id])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    obj[col] = row[idx]
  })
  return obj
}

export function getAllProjects(options = {}) {
  const { keyword, limit = 50, offset = 0 } = options
  
  let query = `
    SELECT id, name, description, created_at, updated_at
    FROM projects
    WHERE 1=1
  `
  const params = []

  if (keyword) {
    query += ' AND (name LIKE ? OR description LIKE ?)'
    const likeKeyword = `%${keyword}%`
    params.push(likeKeyword, likeKeyword)
  }

  query += ' ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?'
  params.push(limit, offset)

  const result = db.exec(query, params)
  
  if (result.length === 0) return []

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      obj[col] = row[idx]
    })
    return obj
  })
}

export function updateProject(id, name, description) {
  const existing = db.exec(
    'SELECT id FROM projects WHERE id = ?',
    [id]
  )

  if (existing.length === 0 || existing[0].values.length === 0) {
    return null
  }

  db.run(`
    UPDATE projects 
    SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, description, id])
  saveDatabase()
  
  return getProjectById(id)
}

export function deleteProject(id) {
  db.run('DELETE FROM project_naming_items WHERE project_id = ?', [id])
  db.run('DELETE FROM projects WHERE id = ?', [id])
  saveDatabase()
  return { success: true }
}

export function addProjectNamingItem(projectId, originalInput, generatedResults = null) {
  const generatedResultsJson = generatedResults ? JSON.stringify(generatedResults) : null
  
  const result = db.run(`
    INSERT INTO project_naming_items (project_id, original_input, generated_results)
    VALUES (?, ?, ?)
  `, [projectId, originalInput, generatedResultsJson])
  
  saveDatabase()
  
  return getProjectNamingItemById(result.lastInsertRowid)
}

export function getProjectNamingItemById(id) {
  const result = db.exec(`
    SELECT id, project_id, original_input, generated_results, final_results, created_at, updated_at
    FROM project_naming_items
    WHERE id = ?
  `, [id])

  if (result.length === 0 || result[0].values.length === 0) return null

  const columns = result[0].columns
  const row = result[0].values[0]
  const obj = {}
  columns.forEach((col, idx) => {
    if (col === 'generated_results' || col === 'final_results') {
      obj[col] = row[idx] ? JSON.parse(row[idx]) : null
    } else {
      obj[col] = row[idx]
    }
  })
  return obj
}

export function getProjectNamingItems(projectId, options = {}) {
  const { limit = 100, offset = 0 } = options
  
  const result = db.exec(`
    SELECT id, project_id, original_input, generated_results, final_results, created_at, updated_at
    FROM project_naming_items
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [projectId, limit, offset])
  
  if (result.length === 0) return []

  const columns = result[0].columns
  return result[0].values.map(row => {
    const obj = {}
    columns.forEach((col, idx) => {
      if (col === 'generated_results' || col === 'final_results') {
        obj[col] = row[idx] ? JSON.parse(row[idx]) : null
      } else {
        obj[col] = row[idx]
      }
    })
    return obj
  })
}

export function updateProjectNamingItemFinalResults(id, finalResults) {
  const existing = db.exec(
    'SELECT id FROM project_naming_items WHERE id = ?',
    [id]
  )

  if (existing.length === 0 || existing[0].values.length === 0) {
    return null
  }

  const finalResultsJson = finalResults ? JSON.stringify(finalResults) : null
  
  db.run(`
    UPDATE project_naming_items 
    SET final_results = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [finalResultsJson, id])
  saveDatabase()
  
  return getProjectNamingItemById(id)
}

export function deleteProjectNamingItem(id) {
  db.run('DELETE FROM project_naming_items WHERE id = ?', [id])
  saveDatabase()
  return { success: true }
}

export function getProjectWithNamingItems(projectId) {
  const project = getProjectById(projectId)
  if (!project) return null

  const namingItems = getProjectNamingItems(projectId)
  
  return {
    ...project,
    namingItems
  }
}
