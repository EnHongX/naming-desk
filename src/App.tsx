import { useState, useCallback } from 'react'
import { NamingType, generateName, namingTypeLabels } from './utils/naming'
import './App.css'

interface NamingResult {
  type: NamingType
  label: string
  value: string
}

interface BatchItemResult {
  id: string
  originalInput: string
  results: NamingResult[]
}

interface CopyState {
  itemId: string
  type: NamingType | 'all'
}

function App() {
  const [input, setInput] = useState('')
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([])
  const [copiedState, setCopiedState] = useState<CopyState | null>(null)

  const generateAllTypes = useCallback((text: string): NamingResult[] => {
    return [
      {
        type: NamingType.GITHUB_REPO,
        label: namingTypeLabels[NamingType.GITHUB_REPO],
        value: generateName(text, NamingType.GITHUB_REPO),
      },
      {
        type: NamingType.CAMEL_CASE,
        label: namingTypeLabels[NamingType.CAMEL_CASE],
        value: generateName(text, NamingType.CAMEL_CASE),
      },
      {
        type: NamingType.SNAKE_CASE,
        label: namingTypeLabels[NamingType.SNAKE_CASE],
        value: generateName(text, NamingType.SNAKE_CASE),
      },
      {
        type: NamingType.GIT_BRANCH,
        label: namingTypeLabels[NamingType.GIT_BRANCH],
        value: generateName(text, NamingType.GIT_BRANCH),
      },
    ]
  }, [])

  const handleGenerate = useCallback(() => {
    const lines = input.split('\n').filter(line => line.trim())
    
    if (lines.length === 0) {
      setBatchResults([])
      return
    }

    const newResults: BatchItemResult[] = lines.map((line, index) => ({
      id: `item-${index}-${Date.now()}`,
      originalInput: line.trim(),
      results: generateAllTypes(line.trim()),
    }))

    setBatchResults(newResults)
  }, [input, generateAllTypes])

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

  const isCopied = (itemId: string, type: NamingType | 'all') => {
    return copiedState?.itemId === itemId && copiedState?.type === type
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">命名助手</h1>
        <p className="app-subtitle">输入中文想法，一键生成英文命名（支持批量）</p>
      </header>

      <main className="app-main">
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
          <button className="generate-btn" onClick={handleGenerate} disabled={!input.trim()}>
            批量生成命名
          </button>
        </section>

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
      </main>

      <footer className="app-footer">
        <p>支持：GitHub 仓库名、camelCase、snakeCase、Git Branch</p>
      </footer>
    </div>
  )
}

export default App
