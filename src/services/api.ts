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
