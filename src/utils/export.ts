import { NamingType, namingTypeLabels } from './naming'
import { NamingResults, ProjectNamingItem, ProjectWithNamingItems } from '../services/api'

export interface ExportNamingItem {
  id: number
  originalInput: string
  results: NamingResults
  isFinalized: boolean
  createdAt: string
}

export interface ExportProjectData {
  project: {
    id: number
    name: string
    description: string
    createdAt: string
    updatedAt: string
  }
  namingItems: ExportNamingItem[]
  exportMeta: {
    exportedAt: string
    totalItems: number
    finalizedItems: number
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').trim()
}

export function convertToExportData(project: ProjectWithNamingItems): ExportProjectData {
  const finalizedItems = project.namingItems.filter(item => !!item.final_results)
  
  return {
    project: {
      id: project.id,
      name: project.name,
      description: project.description || '',
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    },
    namingItems: project.namingItems.map(item => ({
      id: item.id,
      originalInput: item.original_input,
      results: item.final_results || item.generated_results || {
        githubRepo: '',
        camelCase: '',
        snakeCase: '',
        gitBranch: '',
      },
      isFinalized: !!item.final_results,
      createdAt: item.created_at,
    })),
    exportMeta: {
      exportedAt: new Date().toISOString(),
      totalItems: project.namingItems.length,
      finalizedItems: finalizedItems.length,
    },
  }
}

export function generateMarkdown(data: ExportProjectData): string {
  const lines: string[] = []
  
  lines.push(`# ${data.project.name}`)
  lines.push('')
  
  if (data.project.description) {
    lines.push(`> ${data.project.description}`)
    lines.push('')
  }
  
  lines.push('## 项目信息')
  lines.push('')
  lines.push(`| 字段 | 值 |`)
  lines.push(`|------|-----|`)
  lines.push(`| 项目ID | ${data.project.id} |`)
  lines.push(`| 创建时间 | ${formatDate(data.project.createdAt)} |`)
  lines.push(`| 更新时间 | ${formatDate(data.project.updatedAt)} |`)
  lines.push(`| 命名项总数 | ${data.exportMeta.totalItems} |`)
  lines.push(`| 已确认命名项 | ${data.exportMeta.finalizedItems} |`)
  lines.push('')
  
  lines.push('## 命名方案')
  lines.push('')
  
  if (data.namingItems.length === 0) {
    lines.push('> 暂无命名项')
    lines.push('')
  } else {
    const finalizedItems = data.namingItems.filter(item => item.isFinalized)
    const pendingItems = data.namingItems.filter(item => !item.isFinalized)
    
    if (finalizedItems.length > 0) {
      lines.push('### 已确认命名')
      lines.push('')
      
      finalizedItems.forEach((item, index) => {
        lines.push(`#### ${index + 1}. ${item.originalInput}`)
        lines.push('')
        lines.push(`| 命名类型 | 值 |`)
        lines.push(`|----------|-----|`)
        lines.push(`| ${namingTypeLabels[NamingType.GITHUB_REPO]} | \`${item.results.githubRepo || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.CAMEL_CASE]} | \`${item.results.camelCase || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.SNAKE_CASE]} | \`${item.results.snakeCase || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.GIT_BRANCH]} | \`${item.results.gitBranch || '-'}\` |`)
        lines.push('')
      })
    }
    
    if (pendingItems.length > 0) {
      lines.push('### 待确认命名')
      lines.push('')
      
      pendingItems.forEach((item, index) => {
        lines.push(`#### ${index + 1}. ${item.originalInput}`)
        lines.push('')
        lines.push('> ⚠️ 此命名尚未确认')
        lines.push('')
        lines.push(`| 命名类型 | 值 |`)
        lines.push(`|----------|-----|`)
        lines.push(`| ${namingTypeLabels[NamingType.GITHUB_REPO]} | \`${item.results.githubRepo || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.CAMEL_CASE]} | \`${item.results.camelCase || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.SNAKE_CASE]} | \`${item.results.snakeCase || '-'}\` |`)
        lines.push(`| ${namingTypeLabels[NamingType.GIT_BRANCH]} | \`${item.results.gitBranch || '-'}\` |`)
        lines.push('')
      })
    }
  }
  
  lines.push('---')
  lines.push('')
  lines.push(`> 导出时间：${formatDate(data.exportMeta.exportedAt)}`)
  lines.push('')
  lines.push('> 本文档由命名助手自动生成')
  
  return lines.join('\n')
}

export function generateJSON(data: ExportProjectData, pretty: boolean = true): string {
  return pretty 
    ? JSON.stringify(data, null, 2) 
    : JSON.stringify(data)
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportAsMarkdown(project: ProjectWithNamingItems): void {
  const data = convertToExportData(project)
  const content = generateMarkdown(data)
  const filename = `${sanitizeFilename(project.name)}_命名方案.md`
  downloadFile(content, filename, 'text/markdown')
}

export function exportAsJSON(project: ProjectWithNamingItems): void {
  const data = convertToExportData(project)
  const content = generateJSON(data)
  const filename = `${sanitizeFilename(project.name)}_命名方案.json`
  downloadFile(content, filename, 'application/json')
}
