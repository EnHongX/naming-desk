import { useState, useCallback } from 'react'
import { NamingType, generateName, namingTypeLabels } from './utils/naming'
import './App.css'

interface NamingResult {
  type: NamingType
  label: string
  value: string
}

function App() {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<NamingResult[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const handleGenerate = useCallback(() => {
    if (!input.trim()) {
      setResults([])
      return
    }

    const newResults: NamingResult[] = [
      {
        type: NamingType.GITHUB_REPO,
        label: namingTypeLabels[NamingType.GITHUB_REPO],
        value: generateName(input, NamingType.GITHUB_REPO),
      },
      {
        type: NamingType.CAMEL_CASE,
        label: namingTypeLabels[NamingType.CAMEL_CASE],
        value: generateName(input, NamingType.CAMEL_CASE),
      },
      {
        type: NamingType.SNAKE_CASE,
        label: namingTypeLabels[NamingType.SNAKE_CASE],
        value: generateName(input, NamingType.SNAKE_CASE),
      },
      {
        type: NamingType.GIT_BRANCH,
        label: namingTypeLabels[NamingType.GIT_BRANCH],
        value: generateName(input, NamingType.GIT_BRANCH),
      },
    ]

    setResults(newResults)
  }, [input])

  const handleCopy = useCallback(async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        handleGenerate()
      }
    },
    [handleGenerate]
  )

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">命名助手</h1>
        <p className="app-subtitle">输入中文想法，一键生成英文命名</p>
      </header>

      <main className="app-main">
        <section className="input-section">
          <label className="input-label">描述你的想法</label>
          <textarea
            className="input-textarea"
            placeholder="例如：用户订单列表、新增商品详情页面、修复登录验证bug..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
          />
          <div className="input-hint">
            <span>提示：按 Ctrl + Enter 快速生成</span>
          </div>
          <button className="generate-btn" onClick={handleGenerate} disabled={!input.trim()}>
            生成命名
          </button>
        </section>

        {results.length > 0 && (
          <section className="results-section">
            <h2 className="results-title">生成结果</h2>
            <div className="results-grid">
              {results.map((result, index) => (
                <div key={result.type} className="result-card">
                  <div className="result-header">
                    <span className="result-label">{result.label}</span>
                    <button
                      className={`copy-btn ${copiedIndex === index ? 'copied' : ''}`}
                      onClick={() => handleCopy(result.value, index)}
                      disabled={!result.value}
                    >
                      {copiedIndex === index ? '已复制' : '复制'}
                    </button>
                  </div>
                  <div className="result-value">
                    {result.value || <span className="placeholder">无有效命名</span>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!results.length && input.trim() && (
          <section className="empty-section">
            <p className="empty-text">点击"生成命名"按钮查看结果</p>
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
