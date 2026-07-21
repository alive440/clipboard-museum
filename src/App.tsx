import { useState, useEffect, useCallback } from 'react'
import { useClipboardWatcher } from './hooks/useClipboardWatcher'
import { getHistory, searchHistory, deleteEntry, togglePin, cleanupOld, getSetting, setSetting, getMemos, saveMemo, deleteMemo, type ClipEntry, type MemoEntry } from './api/clipboard'
import { getStats } from './api/clipboardStats'

type Tab = 'timeline' | 'pinned' | 'memo' | 'settings'

function toTime(ts: number) {
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h'
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

const ICONS: Record<string, string> = { text: '📝', link: '🔗', code: '💻', image: '🖼️' }
const COLORS: Record<string, string> = { text: '#d4a574', link: '#6495ed', code: '#4dbd90', image: '#a78bfa' }
const LABELS: Record<string, string> = { text: '文本', link: '链接', code: '代码', image: '图片' }

export default function App() {
  const [tab, setTab] = useState<Tab>('timeline')
  const [entries, setEntries] = useState<ClipEntry[]>([])
  const [memos, setMemos] = useState<MemoEntry[]>([])
  const [stats, setStats] = useState<any>(null)
  const [enabled, setEnabled] = useState(true)
  const [copied, setCopied] = useState<number | null>(null)
  const [retention, setRetention] = useState(30)
  const [memoTitle, setMemoTitle] = useState('')
  const [memoBody, setMemoBody] = useState('')

  const loadAll = useCallback(async () => {
    const [h, s, m, r] = await Promise.all([getHistory(200), getStats(), getMemos(), getSetting('retention_days', 30)])
    setEntries(h); setStats(s); setMemos(m); setRetention(r)
  }, [])

  useEffect(() => { loadAll(); cleanupOld(retention) }, [])
  useEffect(() => { if (tab === 'stats') getStats().then(setStats) }, [tab])

  const onNew = useCallback((e: ClipEntry) => {
    setEntries(prev => [e, ...prev.slice(0, 199)])
    getStats().then(setStats)
  }, [])

  const { watching } = useClipboardWatcher(enabled, onNew)
  const pinned = entries.filter(e => e.pinned)

  const handlePin = async (id: number) => { await togglePin(id); loadAll() }
  const handleDelete = async (id: number) => { await deleteEntry(id); setEntries(prev => prev.filter(e => e.id !== id)); getStats().then(setStats) }
  const handleCopy = async (text: string, id: number) => {
    try { await navigator.clipboard.writeText(text) } catch {}
    setCopied(id); setTimeout(() => setCopied(null), 1500)
  }
  const handleRetention = async (days: number) => { setRetention(days); await setSetting('retention_days', days); cleanupOld(days).then(n => n > 0 && loadAll()) }
  const handleAddMemo = async () => {
    if (!memoTitle.trim()) return
    await saveMemo({ title: memoTitle, content: memoBody, createdAt: Date.now(), updatedAt: Date.now() })
    setMemos(await getMemos()); setMemoTitle(''); setMemoBody('')
  }

  const renderEntry = (e: ClipEntry) => (
    <article key={e.id} className="item" style={{ borderLeftColor: COLORS[e.type], background: e.pinned ? 'rgba(212,165,116,0.04)' : undefined }}>
      <div className="item-top">
        <span className="badge" style={{ color: COLORS[e.type], background: COLORS[e.type] + '18' }}>{ICONS[e.type]} {LABELS[e.type]}</span>
        {e.pinned && <span className="badge" style={{ color: '#fa0', background: '#fa018' }}>⭐ 已收藏</span>}
        <span className="ts">{toTime(e.createdAt)}</span>
        <span className="len">{e.length} 字</span>
      </div>
      <div className="body">
        {e.type === 'image' ? <img src={e.content} className="clip-img" /> : e.type === 'link' ? <a href={e.content} target="_blank" className="lnk">{e.content}</a> : <p className="txt">{e.content.slice(0, 600)}</p>}
      </div>
      <div className="item-actions">
        <button className="act" onClick={() => handleCopy(e.content, e.id)}>{copied === e.id ? '✅' : '📋'} 复制</button>
        <button className="act" onClick={() => handlePin(e.id)}>{e.pinned ? '⭐ 取消' : '⭐ 收藏'}</button>
        <button className="act del" onClick={() => handleDelete(e.id)}>🗑️</button>
      </div>
    </article>
  )

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🏛️ <span>剪贴板博物馆</span></div>
        <nav className="nav">
          {(['timeline', 'pinned', 'memo', 'settings'] as Tab[]).map(t => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {{ timeline: '📋', pinned: '⭐', memo: '📝', settings: '⚙️' }[t]} {{ timeline: '时间轴', pinned: `收藏(${pinned.length})`, memo: '备忘录', settings: '设置' }[t]}
            </button>
          ))}
        </nav>
        <div className="right">
          <span className={`dot ${enabled ? 'live' : 'off'}`} />
          <button className="pill" onClick={() => setEnabled(!enabled)}>{enabled ? '⏸' : '▶'}</button>
        </div>
      </header>

      {(tab === 'timeline' || tab === 'pinned') && (
        <main className="main">
          <div className="list">
            {(tab === 'pinned' ? pinned : entries).map(renderEntry)}
            {(tab === 'pinned' ? pinned : entries).length === 0 && (
              <div className="none"><div className="none-icon">{tab === 'pinned' ? '⭐' : '📋'}</div><h2>{tab === 'pinned' ? '还没有收藏' : '等待第一条记录'}</h2><p>{tab === 'pinned' ? '点时间轴里的 ⭐ 收藏重要内容' : 'Ctrl+C 复制任意内容试试'}</p></div>
            )}
          </div>
        </main>
      )}

      {tab === 'memo' && (
        <main className="main">
          <div className="memo-form">
            <input className="q" placeholder="备忘录标题..." value={memoTitle} onChange={e => setMemoTitle(e.target.value)} />
            <textarea className="memo-area" placeholder="内容..." value={memoBody} onChange={e => setMemoBody(e.target.value)} rows={4} />
            <button className="pill" onClick={handleAddMemo} style={{ marginTop: 8 }}>💾 保存</button>
          </div>
          <div className="list" style={{ marginTop: 16 }}>
            {memos.map(m => (
              <article key={m.id} className="item" style={{ borderLeftColor: '#a78bfa' }}>
                <div className="item-top">
                  <span className="badge" style={{ color: '#a78bfa', background: '#a78bfa18' }}>📝 {m.title}</span>
                  <span className="ts">{toTime(m.createdAt)}</span>
                  <button className="act del" onClick={async () => { await deleteMemo(m.id); setMemos(await getMemos()) }}>🗑️</button>
                </div>
                {m.content && <p className="txt">{m.content}</p>}
              </article>
            ))}
          </div>
        </main>
      )}

      {tab === 'settings' && (
        <main className="main">
          <div className="panel">
            <h3>⚙️ 设置</h3>
            <div className="setting-row">
              <span>自动清理：{retention} 天前的记录</span>
              <div className="setting-options">
                {[7, 14, 30, 60, 90].map(d => (
                  <button key={d} className={`pill ${retention === d ? 'active' : ''}`} onClick={() => handleRetention(d)}>{d} 天</button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8 }}>已收藏的条目不会被清理。修改后立即执行。</p>
          </div>
          <div className="panel" style={{ marginTop: 16 }}>
            <h3>📊 存储</h3>
            <p style={{ fontSize: 13, color: '#ccc' }}>{stats?.total || 0} 条剪辑 · {stats?.byType?.image || 0} 张图片 · {memos.length} 条备忘录</p>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>数据仅存储在你的电脑上，不会上传</p>
          </div>
        </main>
      )}
    </div>
  )
}
