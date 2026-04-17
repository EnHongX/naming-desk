import { useState, useCallback, useEffect } from 'react'
import { NamingType, namingTypeLabels } from './utils/naming'
import { 
  saveHistory, 
  getHistory, 
  toggleFavorite, 
  deleteHistory,
  generateNamingBatch,
  HistoryItem,
  NamingResults,
  GenerateResult
} from './services/api'
import './App.css'

type ViewMode = 'generator' | 'history' | 'favorites'

interface NamingResult {
  type: NamingType
  label: string
  value: string
}

interface BatchItemResult {
  id: string
  dbId?: number
  originalInput: string
  results: NamingResult[]
  isFavorite?: boolean
}

interface CopyState {
  itemId: string
  type: NamingType | 'all'
}

function App() {
  const [input, setInput] = useState('')
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([])
  const [copiedState, setCopiedState] = useState<CopyState | null>(null)
  
  const [viewMode, setViewMode] = useState<ViewMode>('generator')
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([])
  const [searchKeyword, setSearchKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadHistory = useCallback(async (mode: 'all' | 'favorites' = 'all', keyword?: string) => {
    try {
      setLoading(true)
      setError(null)
      const options: { isFavorite?: boolean; keyword?: string } = {}
      if (mode === 'favorites') {
        options.isFavorite = true
      }
      if (keyword && keyword.trim()) {
        options.keyword = keyword.trim()
      }
      const items = await getHistory(options)
      setHistoryItems(items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载历史记录失败')
      console.error('Load history error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'history' || viewMode === 'favorites') {
      loadHistory(viewMode === 'favorites' ? 'favorites' : 'all', searchKeyword)
    }
  }, [viewMode, loadHistory, searchKeyword])

  const convertResultsToNamingResult = (results: NamingResults): NamingResult[] => {
    return [
      {
        type: NamingType.GITHUB_REPO,
        label: namingTypeLabels[NamingType.GITHUB_REPO],
        value: results.githubRepo,
      },
      {
        type: NamingType.CAMEL_CASE,
        label: namingTypeLabels[NamingType.CAMEL_CASE],
        value: results.camelCase,
      },
      {
        type: NamingType.SNAKE_CASE,
        label: namingTypeLabels[NamingType.SNAKE_CASE],
        value: results.snakeCase,
      },
      {
        type: NamingType.GIT_BRANCH,
        label: namingTypeLabels[NamingType.GIT_BRANCH],
        value: results.gitBranch,
      },
    ]
  }

  const handleGenerate = useCallback(async () => {
    const lines = input.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      setBatchResults([])
      return
    }

    try {
      setGenerating(true)
      setError(null)
      
      const generateResults = await generateNamingBatch(lines)
      const newResults: BatchItemResult[] = []
      
      for (let index = 0; index < generateResults.length; index++) {
        const result = generateResults[index]
        const itemId = `item-${index}-${Date.now()}`
        
        if (result.error) {
          console.error(`Generate failed for "${result.originalInput}":`, result.error)
          newResults.push({
            id: itemId,
            originalInput: result.originalInput,
            results: [],
            isFavorite: false,
          })
          continue
        }

        const namingResults = convertResultsToNamingResult(result.results)
        
        try {
          const saveResult = await saveHistory(result.originalInput, result.results)
          newResults.push({
            id: itemId,
            dbId: saveResult.id,
            originalInput: result.originalInput,
            results: namingResults,
            isFavorite: false,
          })
        } catch (err) {
          console.error('Failed to save history:', err)
          newResults.push({
            id: itemId,
            originalInput: result.originalInput,
            results: namingResults,
            isFavorite: false,
          })
        }
      }

      setBatchResults(newResults)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成命名失败')
      console.error('Generate naming error:', err)
    } finally {
      setGenerating(false)
    }
  }, [input])

  const handleCopy = useCallback(async (text: string, itemId: string, type: NamingType | 'all') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedState({ itemId, type })
      setTimeout(() => setCopiedState(null), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }, [])

  const handleCopyItemAll = useCallback((item: BatchItemResult) => {
    const text = item.results
      .map(r => `${r.label}: ${r.value}`)
      .join('\n')
    handleCopy(text, item.id, 'all')
  }, [handleCopy])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        handleGenerate()
      }
    },
    [handleGenerate]
  )

  const handleToggleFavorite = useCallback(async (dbId: number | undefined, itemIndex: number, isFromHistory: boolean = false) => {
    if (!dbId && !isFromHistory) return
    
    try {
      if (isFromHistory) {
        const result = await toggleFavorite(dbId!)
        setHistoryItems(prev => 
          prev.map(item => 
            item.id === dbId ? { ...item, is_favorite: result.isFavorite } : item
          )
        )
      } else {
        const result = await toggleFavorite(dbId!)
        setBatchResults(prev =>
          prev.map((item, idx) =>
            idx === itemIndex ? { ...item, isFavorite: result.isFavorite } : item
          )
        )
      }
    } catch (err) {
      console.error('Toggle favorite error:', err)
    }
  }, [])

  const handleDeleteHistory = useCallback(async (dbId: number) => {
    try {
      await deleteHistory(dbId)
      setHistoryItems(prev => prev.filter(item => item.id !== dbId))
    } catch (err) {
      console.error('Delete history error:', err)
    }
  }, [])

  const handleUseFromHistory = useCallback((item: HistoryItem) => {
    setInput(item.original_input)
    const results: BatchItemResult[] = [{
      id: `history-${item.id}-${Date.now()}`,
      dbId: item.id,
      originalInput: item.original_input,
      isFavorite: item.is_favorite,
      results: [
        { type: NamingType.GITHUB_REPO, label: namingTypeLabels[NamingType.GITHUB_REPO], value: item.github_repo },
        { type: NamingType.CAMEL_CASE, label: namingTypeLabels[NamingType.CAMEL_CASE], value: item.camel_case },
        { type: NamingType.SNAKE_CASE, label: namingTypeLabels[NamingType.SNAKE_CASE], value: item.snake_case },
        { type: NamingType.GIT_BRANCH, label: namingTypeLabels[NamingType.GIT_BRANCH], value: item.git_branch },
      ],
    }]
    setBatchResults(results)
    setViewMode('generator')
  }, [])

  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadHistory(viewMode === 'favorites' ? 'favorites' : 'all', searchKeyword)
    }
  }, [loadHistory, viewMode, searchKeyword])

  const isCopied = (itemId: string, type: NamingType | 'all') => {
    return copiedState?.itemId === itemId && copiedState?.type === type
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">命名助手</h1>
        <p className="app-subtitle">输入中文想法，一键生成英文命名（支持批量）</p>
      </header>

      <nav className="app-nav">
        <button
          className={`nav-tab ${viewMode === 'generator' ? 'active' : ''}`}
          onClick={() => setViewMode('generator')}
        >
          命名生成
        </button>
        <button
          className={`nav-tab ${viewMode === 'history' ? 'active' : ''}`}
          onClick={() => setViewMode('history')}
        >
          历史记录
        </button>
        <button
          className={`nav-tab ${viewMode === 'favorites' ? 'active' : ''}`}
          onClick={() => setViewMode('favorites')}
        >
          我的收藏
        </button>
      </nav>

      <main className="app-main">
        {viewMode === 'generator' && (
          <>
            <section className="input-section">
              <label className="input-label">描述你的想法（每行一条）</label>
              <textarea
                className="input-textarea"
                placeholder="例如：&#10;用户订单列表&#10;新增商品详情页面&#10;修复登录验证bug..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={6}
              />
              <div className="input-hint">
                <span>提示：每行输入一条，按 Ctrl + Enter 快速生成</span>
              </div>
              <button className="generate-btn" onClick={handleGenerate} disabled={!input.trim() || generating}>
                {generating ? '生成中...' : '批量生成命名'}
              </button>
            </section>

            {error && viewMode === 'generator' && (
              <div className="error-message">
                {error}
              </div>
            )}

            {batchResults.length > 0 && (
              <section className="results-section">
                <div className="results-header">
                  <h2 className="results-title">生成结果（共 {batchResults.length} 条）</h2>
                  <button
                    className="copy-all-btn"
                    onClick={() => {
                      const allText = batchResults
                        .map(item => {
                          const resultsText = item.results
                            .map(r => `  ${r.label}: ${r.value}`)
                            .join('\n')
                          return `【${item.originalInput}】\n${resultsText}`
                        })
                        .join('\n\n')
                      const allItemId = 'all-items'
                      handleCopy(allText, allItemId, 'all' as NamingType | 'all')
                    }}
                  >
                    {copiedState?.itemId === 'all-items' ? '已复制全部' : '复制全部结果'}
                  </button>
                </div>
                
                <div className="batch-results-list">
                  {batchResults.map((item, itemIndex) => (
                    <div key={item.id} className="batch-item">
                      <div className="batch-item-header">
                        <span className="batch-item-number">#{itemIndex + 1}</span>
                        <span className="batch-item-original">{item.originalInput}</span>
                        <button
                          className={`favorite-btn ${item.isFavorite ? 'favorited' : ''}`}
                          onClick={() => handleToggleFavorite(item.dbId, itemIndex, false)}
                          title={item.isFavorite ? '取消收藏' : '添加收藏'}
                        >
                          {item.isFavorite ? '★' : '☆'}
                        </button>
                        <button
                          className={`copy-item-btn ${isCopied(item.id, 'all') ? 'copied' : ''}`}
                          onClick={() => handleCopyItemAll(item)}
                        >
                          {isCopied(item.id, 'all') ? '已复制' : '复制本条'}
                        </button>
                      </div>
                      
                      <div className="batch-item-results">
                        {item.results.map((result) => (
                          <div key={result.type} className="result-card">
                            <div className="result-header">
                              <span className="result-label">{result.label}</span>
                              <button
                                className={`copy-btn ${isCopied(item.id, result.type) ? 'copied' : ''}`}
                                onClick={() => handleCopy(result.value, item.id, result.type)}
                                disabled={!result.value}
                              >
                                {isCopied(item.id, result.type) ? '已复制' : '复制'}
                              </button>
                            </div>
                            <div className="result-value">
                              {result.value || <span className="placeholder">无有效命名</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!batchResults.length && input.trim() && (
              <section className="empty-section">
                <p className="empty-text">点击"批量生成命名"按钮查看结果</p>
              </section>
            )}
          </>
        )}

        {(viewMode === 'history' || viewMode === 'favorites') && (
          <>
            <section className="search-section">
              <input
                type="text"
                className="search-input"
                placeholder={viewMode === 'history' ? '搜索历史记录...' : '搜索收藏...'}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleSearch}
              />
              <button
                className="search-btn"
                onClick={() => loadHistory(viewMode === 'favorites' ? 'favorites' : 'all', searchKeyword)}
              >
                搜索
              </button>
              <button
                className="refresh-btn"
                onClick={() => {
                  setSearchKeyword('')
                  loadHistory(viewMode === 'favorites' ? 'favorites' : 'all')
                }}
              >
                刷新
              </button>
            </section>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-section">
                <p className="loading-text">加载中...</p>
              </div>
            ) : historyItems.length === 0 ? (
              <section className="empty-section">
                <p className="empty-text">
                  {searchKeyword 
                    ? '没有找到匹配的记录' 
                    : viewMode === 'favorites' 
                      ? '暂无收藏记录' 
                      : '暂无历史记录'}
                </p>
              </section>
            ) : (
              <section className="history-section">
                <div className="history-header">
                  <h2 className="history-title">
                    {viewMode === 'favorites' ? '我的收藏' : '历史记录'}
                    <span className="history-count">({historyItems.length} 条)</span>
                  </h2>
                </div>
                
                <div className="history-list">
                  {historyItems.map((item, itemIndex) => (
                    <div key={item.id} className="history-item">
                      <div className="history-item-header">
                        <span className="batch-item-number">#{itemIndex + 1}</span>
                        <span className="history-item-input">{item.original_input}</span>
                        <span className="history-item-date">{formatDate(item.created_at)}</span>
                        <button
                          className={`favorite-btn ${item.is_favorite ? 'favorited' : ''}`}
                          onClick={() => handleToggleFavorite(item.id, itemIndex, true)}
                          title={item.is_favorite ? '取消收藏' : '添加收藏'}
                        >
                          {item.is_favorite ? '★' : '☆'}
                        </button>
                        <button
                          className="use-btn"
                          onClick={() => handleUseFromHistory(item)}
                          title="使用此记录"
                        >
                          使用
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDeleteHistory(item.id)}
                          title="删除此记录"
                        >
                          删除
                        </button>
                      </div>
                      
                      <div className="batch-item-results">
                        <div className="result-card">
                          <div className="result-header">
                            <span className="result-label">GitHub 仓库名</span>
                            <button
                              className={`copy-btn ${isCopied(`history-${item.id}`, NamingType.GITHUB_REPO) ? 'copied' : ''}`}
                              onClick={() => handleCopy(item.github_repo, `history-${item.id}`, NamingType.GITHUB_REPO)}
                              disabled={!item.github_repo}
                            >
                              {isCopied(`history-${item.id}`, NamingType.GITHUB_REPO) ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="result-value">
                            {item.github_repo || <span className="placeholder">无有效命名</span>}
                          </div>
                        </div>
                        
                        <div className="result-card">
                          <div className="result-header">
                            <span className="result-label">camelCase 字段名</span>
                            <button
                              className={`copy-btn ${isCopied(`history-${item.id}`, NamingType.CAMEL_CASE) ? 'copied' : ''}`}
                              onClick={() => handleCopy(item.camel_case, `history-${item.id}`, NamingType.CAMEL_CASE)}
                              disabled={!item.camel_case}
                            >
                              {isCopied(`history-${item.id}`, NamingType.CAMEL_CASE) ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="result-value">
                            {item.camel_case || <span className="placeholder">无有效命名</span>}
                          </div>
                        </div>
                        
                        <div className="result-card">
                          <div className="result-header">
                            <span className="result-label">snake_case 字段名</span>
                            <button
                              className={`copy-btn ${isCopied(`history-${item.id}`, NamingType.SNAKE_CASE) ? 'copied' : ''}`}
                              onClick={() => handleCopy(item.snake_case, `history-${item.id}`, NamingType.SNAKE_CASE)}
                              disabled={!item.snake_case}
                            >
                              {isCopied(`history-${item.id}`, NamingType.SNAKE_CASE) ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="result-value">
                            {item.snake_case || <span className="placeholder">无有效命名</span>}
                          </div>
                        </div>
                        
                        <div className="result-card">
                          <div className="result-header">
                            <span className="result-label">Git 分支名</span>
                            <button
                              className={`copy-btn ${isCopied(`history-${item.id}`, NamingType.GIT_BRANCH) ? 'copied' : ''}`}
                              onClick={() => handleCopy(item.git_branch, `history-${item.id}`, NamingType.GIT_BRANCH)}
                              disabled={!item.git_branch}
                            >
                              {isCopied(`history-${item.id}`, NamingType.GIT_BRANCH) ? '已复制' : '复制'}
                            </button>
                          </div>
                          <div className="result-value">
                            {item.git_branch || <span className="placeholder">无有效命名</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        <p>支持：GitHub 仓库名、camelCase、snakeCase、Git Branch</p>
      </footer>
    </div>
  )
}

export default App
