import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bookmark, Download, Globe, History, LockKeyhole, MoreHorizontal, Plus, RefreshCw, Sidebar, X } from 'lucide-react'
import { showOSAlert } from '../system/dialogs'

type BrowserTab = { id: string; url: string; history: string[]; index: number }
type SidebarMode = 'favorites' | 'history'
const initialUrl = 'https://example.com'

function loadBookmarks() {
  try { return JSON.parse(localStorage.getItem('mac-nos-safari-bookmarks') ?? '[]') as string[] } catch { return [] }
}

export function SafariApp() {
  const [tabs, setTabs] = useState<BrowserTab[]>([{ id: 'tab-1', url: initialUrl, history: [initialUrl], index: 0 }])
  const [activeId, setActiveId] = useState('tab-1')
  const [address, setAddress] = useState(initialUrl)
  const [bookmarks, setBookmarks] = useState(loadBookmarks)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('favorites')
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0]
  const src = `/api/proxy?url=${encodeURIComponent(activeTab.url)}&v=${refreshKey}`
  const isBookmarked = bookmarks.includes(activeTab.url)
  const visited = useMemo(() => Array.from(new Set(tabs.flatMap((tab) => tab.history.slice(0, tab.index + 1)).reverse())), [tabs])

  const navigate = (value: string, tabId = activeId) => {
    let target = value.trim()
    if (!target) return
    if (!/^https?:\/\//i.test(target)) target = target.includes('.') && !target.includes(' ') ? `https://${target}` : `https://www.google.com/search?q=${encodeURIComponent(target)}`
    try { new URL(target) } catch { return }
    setTabs((current) => current.map((tab) => tab.id !== tabId ? tab : { ...tab, url: target, history: [...tab.history.slice(0, tab.index + 1), target], index: tab.index + 1 }))
    if (tabId === activeId) setAddress(target)
    setLoading(true)
    setMenuOpen(false)
  }
  const selectTab = (tab: BrowserTab) => { setActiveId(tab.id); setAddress(tab.url); setLoading(true) }
  const addTab = () => {
    const id = `tab-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`
    const tab = { id, url: initialUrl, history: [initialUrl], index: 0 }
    setTabs((current) => [...current, tab]); setActiveId(id); setAddress(initialUrl); setLoading(true)
  }
  const closeTab = (id: string) => {
    if (tabs.length === 1) { navigate(initialUrl, id); return }
    const index = tabs.findIndex((tab) => tab.id === id)
    const next = tabs.filter((tab) => tab.id !== id)
    setTabs(next)
    if (id === activeId) selectTab(next[Math.max(0, index - 1)])
  }
  const stepHistory = (direction: -1 | 1) => {
    const index = activeTab.index + direction
    if (index < 0 || index >= activeTab.history.length) return
    const url = activeTab.history[index]
    setTabs((current) => current.map((tab) => tab.id === activeId ? { ...tab, index, url } : tab))
    setAddress(url); setLoading(true)
  }
  const toggleBookmark = () => {
    const next = isBookmarked ? bookmarks.filter((url) => url !== activeTab.url) : [activeTab.url, ...bookmarks]
    setBookmarks(next)
    localStorage.setItem('mac-nos-safari-bookmarks', JSON.stringify(next))
  }
  const downloadPage = async () => {
    try {
      const response = await fetch(src)
      if (!response.ok) throw new Error(`Download failed (${response.status}).`)
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `${new URL(activeTab.url).hostname}.html`
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (error) { void showOSAlert('Safari Download', error instanceof Error ? error.message : 'Download failed.') }
    setMenuOpen(false)
  }

  return <div className="safari-app">
    <div className="safari-toolbar"><button title="Show sidebar" onClick={() => setShowSidebar(!showSidebar)}><Sidebar size={16} /></button><div className="safari-nav"><button title="Back" disabled={activeTab.index <= 0} onClick={() => stepHistory(-1)}><ArrowLeft size={15} /></button><button title="Forward" disabled={activeTab.index >= activeTab.history.length - 1} onClick={() => stepHistory(1)}><ArrowRight size={15} /></button></div><form className="address-bar" onSubmit={(event) => { event.preventDefault(); navigate(address) }}><LockKeyhole size={12} /><input aria-label="Website address" value={address} onChange={(event) => setAddress(event.target.value)} onFocus={(event) => event.currentTarget.select()} /><button type="button" aria-label="Reload" title="Reload" onClick={() => { setLoading(true); setRefreshKey((key) => key + 1) }}><RefreshCw size={13} /></button></form><button className={isBookmarked ? 'bookmark-active' : ''} title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'} onClick={toggleBookmark}><Bookmark size={15} /></button><button title="New tab" onClick={addTab}><Plus size={16} /></button><button title="More options" onClick={() => setMenuOpen(!menuOpen)}><MoreHorizontal size={17} /></button>
      {menuOpen && <div className="safari-more-menu"><button onClick={() => { setShowSidebar(true); setSidebarMode('history'); setMenuOpen(false) }}><History size={14} /> History</button><button onClick={() => { setShowSidebar(true); setSidebarMode('favorites'); setMenuOpen(false) }}><Bookmark size={14} /> Bookmarks</button><button onClick={() => void downloadPage()}><Download size={14} /> Download page…</button></div>}
    </div>
    <div className="safari-tabs">{tabs.map((tab) => <div key={tab.id} className={`safari-tab ${tab.id === activeId ? 'active' : ''}`}><button className="safari-tab-select" onClick={() => selectTab(tab)}><Globe size={12} />{new URL(tab.url).hostname}</button><button title="Close tab" aria-label="Close tab" onClick={() => closeTab(tab.id)}><X size={11} /></button></div>)}<button className="new-tab-button" title="New tab" onClick={addTab}><Plus size={13} /></button></div>
    <div className="safari-viewport">{showSidebar && <aside className="safari-sidebar"><div className="safari-sidebar-switch"><button className={sidebarMode === 'favorites' ? 'selected' : ''} onClick={() => setSidebarMode('favorites')}>Favorites</button><button className={sidebarMode === 'history' ? 'selected' : ''} onClick={() => setSidebarMode('history')}>History</button></div>{(sidebarMode === 'favorites' ? bookmarks : visited).map((url) => <button key={url} onClick={() => navigate(url)}>{new URL(url).hostname}<small>{url}</small></button>)}</aside>}<iframe key={`${activeTab.id}-${activeTab.url}-${refreshKey}`} title={`Safari: ${new URL(activeTab.url).hostname}`} src={src} sandbox="allow-scripts allow-forms allow-popups allow-downloads" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />{loading && <div className="safari-loading"><RefreshCw size={16} className="spin" /> Loading {new URL(activeTab.url).hostname}…</div>}</div>
    <footer className="safari-status"><span><LockKeyhole size={10} /> Private browsing</span><span>{tabs.length} {tabs.length === 1 ? 'tab' : 'tabs'}</span></footer>
  </div>
}
