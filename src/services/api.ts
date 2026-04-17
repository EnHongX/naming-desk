import { NamingType } from '../utils/naming'

export interface HistoryItem {
  id: number
  original_input: string
  github_repo: string
  camel_case: string
  snake_case: string
  git_branch: string
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface NamingResults {
  githubRepo: string
  camelCase: string
  snakeCase: string
  gitBranch: string
}

export interface GenerateResult {
  originalInput: string
  results: NamingResults
  error?: string
}

const API_BASE = '/api'

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API request failed: ${response.status}`)
  }

  return response.json()
}

export async function saveHistory(originalInput: string, results: NamingResults): Promise<{ success: boolean; id: number }> {
  return request('/history', {
    method: 'POST',
    body: JSON.stringify({ originalInput, results }),
  })
}

export async function getHistory(options?: {
  isFavorite?: boolean
  keyword?: string
  limit?: number
  offset?: number
}): Promise<HistoryItem[]> {
  const params = new URLSearchParams()
  
  if (options?.isFavorite !== undefined) {
    params.append('isFavorite', String(options.isFavorite))
  }
  if (options?.keyword) {
    params.append('keyword', options.keyword)
  }
  if (options?.limit !== undefined) {
    params.append('limit', String(options.limit))
  }
  if (options?.offset !== undefined) {
    params.append('offset', String(options.offset))
  }

  const queryString = params.toString()
  return request(`/history${queryString ? `?${queryString}` : ''}`)
}

export async function getHistoryById(id: number): Promise<HistoryItem> {
  return request(`/history/${id}`)
}

export async function toggleFavorite(id: number): Promise<{ success: boolean; isFavorite: boolean }> {
  return request(`/history/${id}/favorite`, {
    method: 'PUT',
  })
}

export async function deleteHistory(id: number): Promise<{ success: boolean }> {
  return request(`/history/${id}`, {
    method: 'DELETE',
  })
}

export async function generateNaming(input: string): Promise<NamingResults> {
  const response = await request<{ success: boolean; results: NamingResults }>('/generate', {
    method: 'POST',
    body: JSON.stringify({ input }),
  })
  return response.results
}

export async function generateNamingBatch(inputs: string[]): Promise<GenerateResult[]> {
  const response = await request<{ success: boolean; results: GenerateResult[] }>('/generate/batch', {
    method: 'POST',
    body: JSON.stringify({ inputs }),
  })
  return response.results
}

export function historyItemToResults(item: HistoryItem): NamingResults {
  return {
    githubRepo: item.github_repo,
    camelCase: item.camel_case,
    snakeCase: item.snake_case,
    gitBranch: item.git_branch,
  }
}

export function historyItemToNamingResults(item: HistoryItem, type: NamingType): string {
  switch (type) {
    case NamingType.GITHUB_REPO:
      return item.github_repo
    case NamingType.CAMEL_CASE:
      return item.camel_case
    case NamingType.SNAKE_CASE:
      return item.snake_case
    case NamingType.GIT_BRANCH:
      return item.git_branch
    default:
      return ''
  }
}

export interface Preference {
  id: number
  preference_key: string
  preference_value: string
  description: string
  created_at: string
  updated_at: string
}

export interface GlossaryTerm {
  id: number
  chinese_term: string
  english_term: string
  priority: number
  description: string
  created_at: string
  updated_at: string
}

export async function getAllPreferences(): Promise<Preference[]> {
  const response = await request<{ success: boolean; preferences: Preference[] }>('/preferences')
  return response.preferences
}

export async function getPreferenceByKey(key: string): Promise<Preference> {
  return request(`/preferences/${key}`)
}

export async function updatePreference(key: string, value: string): Promise<Preference> {
  const response = await request<{ success: boolean; preference: Preference }>(`/preferences/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  })
  return response.preference
}

export async function getAllGlossaryTerms(options?: {
  keyword?: string
  limit?: number
  offset?: number
}): Promise<GlossaryTerm[]> {
  const params = new URLSearchParams()
  
  if (options?.keyword) {
    params.append('keyword', options.keyword)
  }
  if (options?.limit !== undefined) {
    params.append('limit', String(options.limit))
  }
  if (options?.offset !== undefined) {
    params.append('offset', String(options.offset))
  }

  const queryString = params.toString()
  const response = await request<{ success: boolean; terms: GlossaryTerm[] }>(
    `/glossary${queryString ? `?${queryString}` : ''}`
  )
  return response.terms
}

export async function getGlossaryTermById(id: number): Promise<GlossaryTerm> {
  return request(`/glossary/${id}`)
}

export async function addGlossaryTerm(term: {
  chineseTerm: string
  englishTerm: string
  priority?: number
  description?: string
}): Promise<GlossaryTerm> {
  const response = await request<{ success: boolean; term: GlossaryTerm }>('/glossary', {
    method: 'POST',
    body: JSON.stringify(term),
  })
  return response.term
}

export async function updateGlossaryTerm(id: number, term: {
  chineseTerm: string
  englishTerm: string
  priority?: number
  description?: string
}): Promise<GlossaryTerm> {
  const response = await request<{ success: boolean; term: GlossaryTerm }>(`/glossary/${id}`, {
    method: 'PUT',
    body: JSON.stringify(term),
  })
  return response.term
}

export async function deleteGlossaryTerm(id: number): Promise<{ success: boolean }> {
  return request(`/glossary/${id}`, {
    method: 'DELETE',
  })
}

export interface NamingResults {
  githubRepo: string
  camelCase: string
  snakeCase: string
  gitBranch: string
}

export interface Project {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
}

export interface ProjectNamingItem {
  id: number
  project_id: number
  original_input: string
  generated_results: NamingResults | null
  final_results: NamingResults | null
  created_at: string
  updated_at: string
}

export interface ProjectWithNamingItems extends Project {
  namingItems: ProjectNamingItem[]
}

export async function createProject(data: {
  name: string
  description?: string
}): Promise<Project> {
  const response = await request<{ success: boolean; project: Project }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.project
}

export async function getAllProjects(options?: {
  keyword?: string
  limit?: number
  offset?: number
}): Promise<Project[]> {
  const params = new URLSearchParams()
  
  if (options?.keyword) {
    params.append('keyword', options.keyword)
  }
  if (options?.limit !== undefined) {
    params.append('limit', String(options.limit))
  }
  if (options?.offset !== undefined) {
    params.append('offset', String(options.offset))
  }

  const queryString = params.toString()
  const response = await request<{ success: boolean; projects: Project[] }>(
    `/projects${queryString ? `?${queryString}` : ''}`
  )
  return response.projects
}

export async function getProjectById(id: number): Promise<ProjectWithNamingItems> {
  const response = await request<{ success: boolean; project: ProjectWithNamingItems }>(`/projects/${id}`)
  return response.project
}

export async function updateProject(id: number, data: {
  name: string
  description?: string
}): Promise<Project> {
  const response = await request<{ success: boolean; project: Project }>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return response.project
}

export async function deleteProject(id: number): Promise<{ success: boolean }> {
  return request(`/projects/${id}`, {
    method: 'DELETE',
  })
}

export interface GenerateNamingItemResult {
  success: boolean
  namingItem?: ProjectNamingItem
  originalInput?: string
  error?: string
}

export async function generateProjectNamingItems(projectId: number, inputs: string[]): Promise<GenerateNamingItemResult[]> {
  const response = await request<{ success: boolean; results: GenerateNamingItemResult[] }>(
    `/projects/${projectId}/naming-items/generate`,
    {
      method: 'POST',
      body: JSON.stringify({ inputs }),
    }
  )
  return response.results
}

export async function updateProjectNamingItemFinalResults(
  itemId: number,
  finalResults: NamingResults
): Promise<ProjectNamingItem> {
  const response = await request<{ success: boolean; namingItem: ProjectNamingItem }>(
    `/projects/naming-items/${itemId}`,
    {
      method: 'PUT',
      body: JSON.stringify({ finalResults }),
    }
  )
  return response.namingItem
}

export async function deleteProjectNamingItem(itemId: number): Promise<{ success: boolean }> {
  return request(`/projects/naming-items/${itemId}`, {
    method: 'DELETE',
  })
}
