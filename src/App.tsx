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
  GenerateResult,
  Preference,
  GlossaryTerm,
  getAllPreferences,
  updatePreference,
  getAllGlossaryTerms,
  addGlossaryTerm,
  updateGlossaryTerm,
  deleteGlossaryTerm
} from './services/api'
import './App.css'

type ViewMode = 'generator' | 'history' | 'favorites' | 'settings'

type SettingsTab = 'preferences' | 'glossary'

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

  const [settingsTab, setSettingsTab] = useState<SettingsTab>('preferences')
  const [preferences, setPreferences] = useState<Preference[]>([])
  const [glossaryTerms, setGlossaryTerms] = useState<GlossaryTerm[]>([])
  const [glossarySearchKeyword, setGlossarySearchKeyword] = useState('')
  const [editingTerm, setEditingTerm] = useState<GlossaryTerm | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newTermForm, setNewTermForm] = useState({
    chineseTerm: '',
    englishTerm: '',
    priority: 0,
    description: ''
  })

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

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const prefs = await getAllPreferences()
      setPreferences(prefs)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载偏好设置失败')
      console.error('Load preferences error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadGlossaryTerms = useCallback(async (keyword?: string) => {
    try {
      setLoading(true)
      setError(null)
      const options: { keyword?: string } = {}
      if (keyword && keyword.trim()) {
        options.keyword = keyword.trim()
      }
      const terms = await getAllGlossaryTerms(options)
      setGlossaryTerms(terms)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载术语表失败')
      console.error('Load glossary terms error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'history' || viewMode === 'favorites') {
      loadHistory(viewMode === 'favorites' ? 'favorites' : 'all', searchKeyword)
    } else if (viewMode === 'settings') {
      if (settingsTab === 'preferences') {
        loadPreferences()
      } else {
        loadGlossaryTerms(glossarySearchKeyword)
      }
    }
  }, [viewMode, loadHistory, searchKeyword, settingsTab, loadPreferences, loadGlossaryTerms, glossarySearchKeyword])

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

  const handleUpdatePreference = useCallback(async (key: string, value: string) => {
    try {
      const updated = await updatePreference(key, value)
      setPreferences(prev => 
        prev.map(pref => 
          pref.preference_key === key ? updated : pref
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新偏好设置失败')
      console.error('Update preference error:', err)
    }
  }, [])

  const handleAddGlossaryTerm = useCallback(async () => {
    try {
      if (!newTermForm.chineseTerm.trim() || !newTermForm.englishTerm.trim()) {
        setError('中文术语和英文术语都不能为空')
        return
      }

      const newTerm = await addGlossaryTerm(newTermForm)
      setGlossaryTerms(prev => [...prev, newTerm].sort((a, b) => b.priority - a.priority))
      setShowAddModal(false)
      setNewTermForm({
        chineseTerm: '',
        englishTerm: '',
        priority: 0,
        description: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加术语失败')
      console.error('Add glossary term error:', err)
    }
  }, [newTermForm])

  const handleUpdateGlossaryTerm = useCallback(async () => {
    if (!editingTerm) return
    
    try {
      const updated = await updateGlossaryTerm(editingTerm.id, {
        chineseTerm: editingTerm.chinese_term,
        englishTerm: editingTerm.english_term,
        priority: editingTerm.priority,
        description: editingTerm.description
      })
      setGlossaryTerms(prev => 
        prev.map(term => 
          term.id === editingTerm.id ? updated : term
        ).sort((a, b) => b.priority - a.priority)
      )
      setEditingTerm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新术语失败')
      console.error('Update glossary term error:', err)
    }
  }, [editingTerm])

  const handleDeleteGlossaryTerm = useCallback(async (id: number) => {
    try {
      await deleteGlossaryTerm(id)
      setGlossaryTerms(prev => prev.filter(term => term.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除术语失败')
      console.error('Delete glossary term error:', err)
    }
  }, [])

  const handleGlossarySearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      loadGlossaryTerms(glossarySearchKeyword)
    }
  }, [loadGlossaryTerms, glossarySearchKeyword])

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
        <button
          className={`nav-tab ${viewMode === 'settings' ? 'active' : ''}`}
          onClick={() => setViewMode('settings')}
        >
          设置
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

        {viewMode === 'settings' && (
          <>
            <nav className="settings-nav">
              <button
                className={`settings-tab ${settingsTab === 'preferences' ? 'active' : ''}`}
                onClick={() => setSettingsTab('preferences')}
              >
                命名偏好
              </button>
              <button
                className={`settings-tab ${settingsTab === 'glossary' ? 'active' : ''}`}
                onClick={() => setSettingsTab('glossary')}
              >
                术语表
              </button>
            </nav>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            {loading ? (
              <div className="loading-section">
                <p className="loading-text">加载中...</p>
              </div>
            ) : settingsTab === 'preferences' ? (
              <section className="preferences-section">
                <div className="settings-header">
                  <h2 className="settings-title">命名偏好设置</h2>
                  <p className="settings-description">配置 AI 命名生成的偏好选项，生成命名时会优先遵循这些设置</p>
                </div>
                
                <div className="preferences-list">
                  {preferences.map((pref) => (
                    <div key={pref.preference_key} className="preference-item">
                      <div className="preference-info">
                        <label className="preference-label">{pref.preference_key}</label>
                        <p className="preference-description">{pref.description}</p>
                      </div>
                      <div className="preference-control">
                        {pref.preference_key === 'namingStyle' && (
                          <select
                            className="preference-select"
                            value={pref.preference_value}
                            onChange={(e) => handleUpdatePreference(pref.preference_key, e.target.value)}
                          >
                            <option value="concise">简洁（优先使用短单词）</option>
                            <option value="balanced">平衡（适中长度）</option>
                            <option value="detailed">详细（优先使用完整单词）</option>
                          </select>
                        )}
                        {pref.preference_key === 'wordPreference' && (
                          <select
                            className="preference-select"
                            value={pref.preference_value}
                            onChange={(e) => handleUpdatePreference(pref.preference_key, e.target.value)}
                          >
                            <option value="standard">标准（通用英语）</option>
                            <option value="american">美式英语</option>
                            <option value="british">英式英语</option>
                          </select>
                        )}
                        {pref.preference_key === 'abbreviationThreshold' && (
                          <select
                            className="preference-select"
                            value={pref.preference_value}
                            onChange={(e) => handleUpdatePreference(pref.preference_key, e.target.value)}
                          >
                            <option value="2">2 个字符以上考虑缩写</option>
                            <option value="3">3 个字符以上考虑缩写</option>
                            <option value="4">4 个字符以上考虑缩写</option>
                            <option value="5">5 个字符以上考虑缩写</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className="glossary-section">
                <div className="settings-header">
                  <h2 className="settings-title">术语表管理</h2>
                  <p className="settings-description">管理自定义术语映射，生成命名时会优先使用这些术语进行翻译</p>
                  <button
                    className="add-term-btn"
                    onClick={() => setShowAddModal(true)}
                  >
                    + 添加术语
                  </button>
                </div>

                <div className="glossary-search-section">
                  <input
                    type="text"
                    className="glossary-search-input"
                    placeholder="搜索术语（中文或英文）..."
                    value={glossarySearchKeyword}
                    onChange={(e) => setGlossarySearchKeyword(e.target.value)}
                    onKeyDown={handleGlossarySearch}
                  />
                  <button
                    className="glossary-search-btn"
                    onClick={() => loadGlossaryTerms(glossarySearchKeyword)}
                  >
                    搜索
                  </button>
                  <button
                    className="glossary-refresh-btn"
                    onClick={() => {
                      setGlossarySearchKeyword('')
                      loadGlossaryTerms('')
                    }}
                  >
                    刷新
                  </button>
                </div>

                {glossaryTerms.length === 0 ? (
                  <div className="empty-section">
                    <p className="empty-text">
                      {glossarySearchKeyword 
                        ? '没有找到匹配的术语' 
                        : '暂无术语记录，点击"添加术语"开始创建'}
                    </p>
                  </div>
                ) : (
                  <div className="glossary-list">
                    <div className="glossary-table-header">
                      <span className="glossary-col-priority">优先级</span>
                      <span className="glossary-col-chinese">中文术语</span>
                      <span className="glossary-col-english">英文术语</span>
                      <span className="glossary-col-description">描述</span>
                      <span className="glossary-col-actions">操作</span>
                    </div>
                    {glossaryTerms.map((term) => (
                      <div key={term.id} className="glossary-item">
                        {editingTerm?.id === term.id ? (
                          <>
                            <div className="glossary-col-priority">
                              <input
                                type="number"
                                className="glossary-input priority-input"
                                value={editingTerm.priority}
                                onChange={(e) => setEditingTerm({ ...editingTerm, priority: parseInt(e.target.value) || 0 })}
                              />
                            </div>
                            <div className="glossary-col-chinese">
                              <input
                                type="text"
                                className="glossary-input"
                                value={editingTerm.chinese_term}
                                onChange={(e) => setEditingTerm({ ...editingTerm, chinese_term: e.target.value })}
                              />
                            </div>
                            <div className="glossary-col-english">
                              <input
                                type="text"
                                className="glossary-input"
                                value={editingTerm.english_term}
                                onChange={(e) => setEditingTerm({ ...editingTerm, english_term: e.target.value })}
                              />
                            </div>
                            <div className="glossary-col-description">
                              <input
                                type="text"
                                className="glossary-input"
                                value={editingTerm.description}
                                onChange={(e) => setEditingTerm({ ...editingTerm, description: e.target.value })}
                              />
                            </div>
                            <div className="glossary-col-actions">
                              <button
                                className="save-edit-btn"
                                onClick={handleUpdateGlossaryTerm}
                              >
                                保存
                              </button>
                              <button
                                className="cancel-edit-btn"
                                onClick={() => setEditingTerm(null)}
                              >
                                取消
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="glossary-col-priority">{term.priority}</span>
                            <span className="glossary-col-chinese">{term.chinese_term}</span>
                            <span className="glossary-col-english">{term.english_term}</span>
                            <span className="glossary-col-description">{term.description || '-'}</span>
                            <div className="glossary-col-actions">
                              <button
                                className="edit-term-btn"
                                onClick={() => setEditingTerm(term)}
                                title="编辑"
                              >
                                编辑
                              </button>
                              <button
                                className="delete-term-btn"
                                onClick={() => handleDeleteGlossaryTerm(term.id)}
                                title="删除"
                              >
                                删除
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {(showAddModal || editingTerm) && (
              <div className="modal-overlay" onClick={() => {
                if (showAddModal) setShowAddModal(false)
                if (editingTerm) setEditingTerm(null)
              }}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3 className="modal-title">{showAddModal ? '添加新术语' : '编辑术语'}</h3>
                  <div className="modal-form">
                    <div className="form-group">
                      <label className="form-label">优先级</label>
                      <input
                        type="number"
                        className="form-input"
                        value={showAddModal ? newTermForm.priority : editingTerm?.priority || 0}
                        onChange={(e) => showAddModal 
                          ? setNewTermForm({ ...newTermForm, priority: parseInt(e.target.value) || 0 })
                          : editingTerm && setEditingTerm({ ...editingTerm, priority: parseInt(e.target.value) || 0 })
                        }
                        placeholder="数字越大优先级越高"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">中文术语 *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={showAddModal ? newTermForm.chineseTerm : editingTerm?.chinese_term || ''}
                        onChange={(e) => showAddModal 
                          ? setNewTermForm({ ...newTermForm, chineseTerm: e.target.value })
                          : editingTerm && setEditingTerm({ ...editingTerm, chinese_term: e.target.value })
                        }
                        placeholder="例如：用户"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">英文术语 *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={showAddModal ? newTermForm.englishTerm : editingTerm?.english_term || ''}
                        onChange={(e) => showAddModal 
                          ? setNewTermForm({ ...newTermForm, englishTerm: e.target.value })
                          : editingTerm && setEditingTerm({ ...editingTerm, english_term: e.target.value })
                        }
                        placeholder="例如：user"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">描述</label>
                      <input
                        type="text"
                        className="form-input"
                        value={showAddModal ? newTermForm.description : editingTerm?.description || ''}
                        onChange={(e) => showAddModal 
                          ? setNewTermForm({ ...newTermForm, description: e.target.value })
                          : editingTerm && setEditingTerm({ ...editingTerm, description: e.target.value })
                        }
                        placeholder="可选，用于说明术语的使用场景"
                      />
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button
                      className="modal-cancel-btn"
                      onClick={() => {
                        if (showAddModal) setShowAddModal(false)
                        if (editingTerm) setEditingTerm(null)
                      }}
                    >
                      取消
                    </button>
                    <button
                      className="modal-confirm-btn"
                      onClick={() => {
                        if (showAddModal) handleAddGlossaryTerm()
                        if (editingTerm) handleUpdateGlossaryTerm()
                      }}
                    >
                      确认
                    </button>
                  </div>
                </div>
              </div>
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
