import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowLeft, ArrowRight, Bot, Check, ChevronDown, CircleHelp, Cloud, Code2, FilePlus2, Folder, FolderPlus, Globe, Grid2X2, Home, LoaderCircle, LockKeyhole, MoreHorizontal, Plus, RefreshCw, Save, Search, Send, Settings2, ShieldAlert, Sidebar, Sparkles, Trash2, Wifi, X } from 'lucide-react'
import { useSystemStore, normalizePath } from '../system/store'
import type { AppId, FsEntry } from '../system/types'

const childrenAt = (files: Record<string, FsEntry>, folder: string) => Object.entries(files)
  .filter(([path]) => path !== folder && normalizePath(path.slice(0, path.lastIndexOf('/')) || '/') === folder)
  .sort(([a, first], [b, second]) => first.type !== second.type ? (first.type === 'folder' ? -1 : 1) : a.localeCompare(b))

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1) || 'Macintosh HD'
const iconFor = (entry: FsEntry) => entry.type === 'folder' ? <Folder size={25} fill="#79aefc" color="#4f88dc" /> : <FilePlus2 size={24} color="#92a6c8" />

export function FinderApp() {
  const { files, createEntry, deleteEntry, openApp } = useSystemStore(useShallow((state) => ({ files: state.files, createEntry: state.createEntry, deleteEntry: state.deleteEntry, openApp: state.openApp })))
  const [folder, setFolder] = useState('/Documents')
  const [selection, setSelection] = useState<string | null>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const entries = useMemo(() => childrenAt(files, folder), [files, folder])
  const navigate = (path: string) => { setFolder(path); setSelection(null) }
  const newFolder = () => { const name = window.prompt('New folder name'); if (name?.trim()) createEntry(`${folder}/${name.trim()}`, 'folder') }
  const openFile = (path: string) => {
    openApp('textedit')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('open-text-file', { detail: path })), 0)
  }
  const newFile = () => { const name = window.prompt('New file name', 'Untitled.txt'); if (name?.trim()) { const path = `${folder}/${name.trim()}`; if (createEntry(path, 'file', '')) openFile(path) } }
  const openSelected = (path: string, entry: FsEntry) => { if (entry.type === 'folder') navigate(path); else openFile(path) }

  return <div className="finder-app">
    <aside className="finder-sidebar"><div className="sidebar-group-label">Favorites</div>{[['/Desktop', 'Desktop'], ['/Documents', 'Documents'], ['/Downloads', 'Downloads'], ['/Pictures', 'Pictures']].map(([path, label]) => <button key={path} className={`sidebar-item ${folder === path ? 'selected' : ''}`} onClick={() => navigate(path)}><span>{label === 'Desktop' ? '▧' : label === 'Documents' ? '▤' : label === 'Downloads' ? '⇩' : '▣'}</span>{label}</button>)}<div className="sidebar-group-label locations-label">Locations</div><button className="sidebar-item" onClick={() => navigate('/')}><span>⌘</span>Macintosh HD</button><div className="sidebar-bottom"><Cloud size={15} /> iCloud Drive</div></aside>
    <section className="finder-main"><div className="finder-toolbar"><div className="finder-nav"><button title="Back" onClick={() => navigate('/') }><ArrowLeft size={15} /></button><button title="Forward" disabled><ArrowRight size={15} /></button></div><h2>{basename(folder)}</h2><div className="toolbar-actions"><button title="New folder" onClick={newFolder}><FolderPlus size={16} /></button><button title="New file" onClick={newFile}><FilePlus2 size={16} /></button><button title="Delete selected" disabled={!selection} onClick={() => { if (selection && window.confirm(`Move ${basename(selection)} to the Trash?`)) { deleteEntry(selection); setSelection(null) } }}><Trash2 size={15} /></button><button title="List view" className={layout === 'list' ? 'active' : ''} onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}><Grid2X2 size={15} /></button><button title="More options"><MoreHorizontal size={17} /></button><button title="Search"><Search size={15} /></button></div></div><div className={`finder-path ${layout}`}>
      {entries.length ? entries.map(([path, entry]) => <button key={path} className={`file-entry ${selection === path ? 'selected' : ''}`} onClick={() => setSelection(path)} onDoubleClick={() => openSelected(path, entry)}>{iconFor(entry)}<span>{basename(path)}</span></button>) : <div className="empty-folder"><Folder size={38} /><span>This folder is empty</span></div>}
    </div><footer className="finder-status">{entries.length} items <span>Available on this Mac</span></footer></section>
  </div>
}

export function TextEditApp() {
  const { files, writeFile } = useSystemStore(useShallow((state) => ({ files: state.files, writeFile: state.writeFile })))
  const filePaths = Object.entries(files).filter(([path, entry]) => entry.type === 'file' && !path.startsWith('/System')).map(([path]) => path)
  const [path, setPath] = useState(filePaths[0] ?? '/Documents/Welcome.txt')
  const [content, setContent] = useState(files[path]?.content ?? '')
  const [saved, setSaved] = useState(true)
  useEffect(() => {
    const handleOpen = (event: Event) => { const target = (event as CustomEvent<string>).detail; setPath(target); setContent(useSystemStore.getState().files[target]?.content ?? ''); setSaved(true) }
    window.addEventListener('open-text-file', handleOpen)
    return () => window.removeEventListener('open-text-file', handleOpen)
  }, [])
  useEffect(() => { if (files[path]) setContent(files[path].content ?? '') }, [path])
  const save = () => { if (!files[path]) writeFile(path, content); else writeFile(path, content); setSaved(true) }
  const chooseFile = (next: string) => { setPath(next); setContent(files[next]?.content ?? ''); setSaved(true) }
  return <div className="textedit-app"><div className="textedit-toolbar"><select aria-label="Document" value={path} onChange={(event) => chooseFile(event.target.value)}>{filePaths.map((file) => <option key={file} value={file}>{basename(file)}</option>)}</select><span className="save-state">{saved ? <><Check size={12} /> Saved</> : 'Edited'}</span><button className="primary-button" onClick={save}><Save size={14} /> Save</button></div><textarea aria-label="Document text" spellCheck value={content} onChange={(event) => { setContent(event.target.value); setSaved(false) }} /></div>
}

export function TerminalApp() {
  const { files, createEntry } = useSystemStore(useShallow((state) => ({ files: state.files, createEntry: state.createEntry })))
  const [cwd, setCwd] = useState('/Users/you')
  const [lines, setLines] = useState<string[]>(['Last login: today on ttys001', 'Welcome to zsh. Type help to see available commands.'])
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])
  const resolve = (value: string) => normalizePath(value.startsWith('/') ? value : `${cwd === '/Users/you' ? '/Documents' : cwd}/${value}`)
  const execute = (raw: string) => {
    const args = raw.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((arg) => arg.replace(/^['"]|['"]$/g, '')) ?? []
    const [command, ...parts] = args
    let output: string[] = []
    if (!command) return
    const filesNow = useSystemStore.getState().files
    if (command === 'clear') { setLines([]); return }
    if (command === 'help') output = ['Commands: ls, cd, mkdir, cat, touch, echo, clear, help', 'Paths are rooted in your local virtual filesystem.']
    else if (command === 'pwd') output = [cwd === '/Users/you' ? '/Documents' : cwd]
    else if (command === 'ls') output = childrenAt(filesNow, cwd === '/Users/you' ? '/Documents' : cwd).map(([path, entry]) => `${entry.type === 'folder' ? '📁' : '📄'}  ${basename(path)}`)
    else if (command === 'cd') { const target = parts[0] ?? '/Documents'; const next = target === '~' ? '/Users/you' : resolve(target); const fsPath = next === '/Users/you' ? '/' : next; if (filesNow[fsPath]?.type === 'folder') setCwd(next); else output = [`cd: no such directory: ${target}`] }
    else if (command === 'mkdir') { if (!parts[0]) output = ['mkdir: missing operand']; else if (!createEntry(resolve(parts[0]), 'folder')) output = [`mkdir: cannot create directory '${parts[0]}'`] }
    else if (command === 'touch') { if (!parts[0]) output = ['touch: missing operand']; else if (!createEntry(resolve(parts[0]), 'file')) output = [`touch: cannot create file '${parts[0]}'`] }
    else if (command === 'cat') { const target = resolve(parts[0] ?? ''); output = filesNow[target]?.type === 'file' ? (filesNow[target].content ?? '').split('\n') : [`cat: ${parts[0] ?? ''}: No such file`] }
    else if (command === 'echo') {
      const redirect = parts.findIndex((part) => part === '>')
      if (redirect >= 0 && parts[redirect + 1]) {
        const text = parts.slice(0, redirect).join(' ')
        const target = resolve(parts[redirect + 1])
        if (!useSystemStore.getState().writeFile(target, `${text}\n`)) output = [`zsh: no such file or directory: ${parts[redirect + 1]}`]
        else output = [text]
      } else output = [parts.join(' ')]
    }
    else output = [`zsh: command not found: ${command}`]
    setLines((previous) => [...previous, `you@mac-nos ${cwd === '/Users/you' ? '~' : cwd} % ${raw}`, ...output])
  }
  return <div className="terminal-app"><div className="terminal-toolbar"><span className="terminal-dot" /><span>you — zsh — 80×24</span></div><div className="terminal-output">{lines.map((line, index) => <div key={index}>{line}</div>)}<div className="terminal-prompt"><span>you@mac-nos {cwd === '/Users/you' ? '~' : cwd} %</span><input autoFocus aria-label="Terminal command" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { const command = input; setInput(''); execute(command) } }} /><div ref={endRef} /></div></div></div>
}

const wallpapers = [
  { id: 'sonoma', label: 'Sonoma', style: 'url(https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=2200&q=90)' },
  { id: 'coast', label: 'Pacific', style: 'linear-gradient(155deg,#9ad5d0 0%,#5ca6b0 42%,#154e73 43%,#11334e 100%)' },
  { id: 'dusk', label: 'Dusk', style: 'linear-gradient(155deg,#f3a66c 0%,#d97872 38%,#855a78 70%,#293d60 100%)' },
]

function SettingSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="setting-row"><div><strong>{label}</strong><small>{description}</small></div><button className={`setting-switch ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button></div>
}

export function SettingsApp() {
  const { darkMode, toggleDarkMode, wallpaper, setWallpaper, files, wifiEnabled, bluetoothEnabled, notificationsEnabled, focusMode, accentColor, brightness, showDesktopIcons, dockMagnification, assistantControlEnabled, updatePreferences, resetFilesystem } = useSystemStore(useShallow((state) => ({
    darkMode: state.darkMode, toggleDarkMode: state.toggleDarkMode, wallpaper: state.wallpaper, setWallpaper: state.setWallpaper, files: state.files,
    wifiEnabled: state.wifiEnabled, bluetoothEnabled: state.bluetoothEnabled, notificationsEnabled: state.notificationsEnabled, focusMode: state.focusMode,
    accentColor: state.accentColor, brightness: state.brightness, showDesktopIcons: state.showDesktopIcons, dockMagnification: state.dockMagnification,
    assistantControlEnabled: state.assistantControlEnabled, updatePreferences: state.updatePreferences, resetFilesystem: state.resetFilesystem,
  })))
  const [section, setSection] = useState('Appearance')
  const [query, setQuery] = useState('')
  const sections = ['Wi-Fi', 'Bluetooth', 'Network', 'Notifications', 'General', 'Appearance', 'Wallpaper', 'Desktop & Dock', 'Privacy & Security']
  const filtered = sections.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const accentColors = ['#1976d2', '#d44336', '#e98126', '#d2a629', '#55a85a', '#9c6ade']
  const resetFiles = () => {
    if (window.confirm('Remove all files from this Mac? This cannot be undone.')) resetFilesystem()
  }

  let content
  if (section === 'Appearance') content = <>
    <p>Choose how Mac-NO-S looks and feels.</p>
    <div className="appearance-options"><button className={!darkMode ? 'chosen' : ''} onClick={() => darkMode && toggleDarkMode()}><span className="appearance-preview light-preview" />Light</button><button className={darkMode ? 'chosen' : ''} onClick={() => !darkMode && toggleDarkMode()}><span className="appearance-preview dark-preview" />Dark</button></div>
    <div className="setting-row"><div><strong>Accent color</strong><small>Used for selections and highlights</small></div><div className="swatches">{accentColors.map((color) => <button key={color} className={accentColor === color ? 'chosen' : ''} style={{ background: color }} aria-label={`Set accent color ${color}`} onClick={() => updatePreferences({ accentColor: color })} />)}</div></div>
    <label className="range-setting"><span>Display brightness</span><input type="range" min="35" max="100" value={brightness} onChange={(event) => updatePreferences({ brightness: Number(event.target.value) })} /><output>{brightness}%</output></label>
  </>
  else if (section === 'Wi-Fi') content = <><p>Connect this simulated Mac to a wireless network.</p><SettingSwitch label="Wi-Fi" description={wifiEnabled ? 'Connected to Studio Network' : 'Turn on Wi-Fi to see available networks'} checked={wifiEnabled} onChange={() => updatePreferences({ wifiEnabled: !wifiEnabled })} />{wifiEnabled && <div className="setting-row"><div><strong>Studio Network</strong><small>Secured · Connected</small></div><span className="spec-pill">✓</span></div>}</>
  else if (section === 'Bluetooth') content = <><p>Connect wireless accessories to this Mac.</p><SettingSwitch label="Bluetooth" description={bluetoothEnabled ? 'On · No new devices nearby' : 'Bluetooth is off'} checked={bluetoothEnabled} onChange={() => updatePreferences({ bluetoothEnabled: !bluetoothEnabled })} />{bluetoothEnabled && <div className="setting-row"><div><strong>My Devices</strong><small>No devices connected</small></div><button className="small-action" onClick={() => window.alert('Put your Bluetooth accessory in pairing mode to connect it.')}>Connect</button></div>}</>
  else if (section === 'Network') content = <><p>Network connections for this Mac.</p><div className="setting-row"><div><strong>Wi-Fi</strong><small>{wifiEnabled ? 'Studio Network · Connected' : 'Off'}</small></div><span className={`connection-state ${wifiEnabled ? 'connected' : ''}`}>{wifiEnabled ? 'Connected' : 'Not connected'}</span></div><div className="setting-row"><div><strong>Private Wi-Fi address</strong><small>Rotates periodically for privacy</small></div><span className="spec-pill">On</span></div></>
  else if (section === 'Notifications') content = <><p>Choose when notifications are shown.</p><SettingSwitch label="Allow notifications" description="Show alerts from apps on this Mac" checked={notificationsEnabled} onChange={() => updatePreferences({ notificationsEnabled: !notificationsEnabled })} /><SettingSwitch label="Focus" description="Silence notifications while you work" checked={focusMode} onChange={() => updatePreferences({ focusMode: !focusMode })} /></>
  else if (section === 'General') content = <><p>About this Mac and its local storage.</p><div className="setting-row"><div><strong>Mac-NO-S</strong><small>Browser Desktop · Version 1.0</small></div><span className="spec-pill">{navigator.platform || 'Web'}</span></div><div className="setting-row"><div><strong>Virtual filesystem</strong><small>{Object.keys(files).length} items stored in this browser</small></div><span className="spec-pill">Local</span></div></>
  else if (section === 'Wallpaper') content = <><p>Choose a picture or color for the desktop.</p><div className="wallpaper-options">{wallpapers.map((item) => <button key={item.id} className={wallpaper === item.id ? 'chosen' : ''} onClick={() => setWallpaper(item.id)}><span style={{ background: item.style }} />{item.label}</button>)}</div></>
  else if (section === 'Desktop & Dock') content = <><p>Choose what appears on your desktop and Dock.</p><SettingSwitch label="Show desktop icons" description="Show Macintosh HD and Projects on the desktop" checked={showDesktopIcons} onChange={() => updatePreferences({ showDesktopIcons: !showDesktopIcons })} /><SettingSwitch label="Dock magnification" description="Enlarge icons when the pointer moves over the Dock" checked={dockMagnification} onChange={() => updatePreferences({ dockMagnification: !dockMagnification })} /></>
  else content = <><p>Control local data and assistant access on this browser.</p><SettingSwitch label="Mac Assistant desktop access" description="Allow the assistant to open apps and manage virtual files" checked={assistantControlEnabled} onChange={() => updatePreferences({ assistantControlEnabled: !assistantControlEnabled })} /><div className="setting-row"><div><strong>Clear virtual filesystem</strong><small>Remove files saved by this browser desktop</small></div><button className="small-action destructive" onClick={resetFiles}>Clear files…</button></div></>

  return <div className="settings-app"><aside className="settings-sidebar"><div className="settings-search"><Search size={14} /><input placeholder="Search Settings" aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{filtered.map((item, index) => <button key={item} className={section === item ? 'selected' : ''} onClick={() => setSection(item)}><span className={`settings-symbol symbol-${index}`}>{['◉', 'ᛒ', '⌘', '◉', '⚙', '◐', '▧', '▣', '◈'][sections.indexOf(item)]}</span>{item}</button>)}</aside><section className="settings-main"><h2>{section}</h2>{content}</section></div>
}

export function SafariApp() {
  const [address, setAddress] = useState('https://example.com')
  const [page, setPage] = useState('https://example.com')
  const [history, setHistory] = useState<string[]>(['https://example.com'])
  const [index, setIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const navigate = (value: string) => {
    let target = value.trim()
    if (!target) return
    if (!/^https?:\/\//i.test(target)) target = target.includes('.') && !target.includes(' ') ? `https://${target}` : `https://www.google.com/search?q=${encodeURIComponent(target)}`
    try { new URL(target) } catch { return }
    const next = [...history.slice(0, index + 1), target]
    setHistory(next); setIndex(next.length - 1); setPage(target); setAddress(target); setLoading(true); setFailed(false)
  }
  const go = (nextIndex: number) => { if (nextIndex < 0 || nextIndex >= history.length) return; setIndex(nextIndex); setPage(history[nextIndex]); setAddress(history[nextIndex]); setLoading(true); setFailed(false) }
  const src = `/api/proxy?url=${encodeURIComponent(page)}&v=${refreshKey}`
  return <div className="safari-app"><div className="safari-toolbar"><button title="Show sidebar" onClick={() => setShowSidebar(!showSidebar)}><Sidebar size={16} /></button><div className="safari-nav"><button title="Back" disabled={index === 0} onClick={() => go(index - 1)}><ArrowLeft size={15} /></button><button title="Forward" disabled={index >= history.length - 1} onClick={() => go(index + 1)}><ArrowRight size={15} /></button></div><form className="address-bar" onSubmit={(event) => { event.preventDefault(); navigate(address) }}><LockKeyhole size={12} /><input aria-label="Website address" value={address} onChange={(event) => setAddress(event.target.value)} onFocus={(event) => event.currentTarget.select()} /><button type="button" aria-label="Reload" title="Reload" onClick={() => { setLoading(true); setFailed(false); setRefreshKey((key) => key + 1) }}><RefreshCw size={13} /></button></form><button title="New tab" onClick={() => navigate('https://example.com')}><Plus size={16} /></button><button title="More"><MoreHorizontal size={17} /></button></div><div className="safari-tabs"><span className="safari-tab"><Globe size={12} />{new URL(page).hostname}<button title="Close tab"><X size={11} /></button></span><button title="New tab" onClick={() => navigate('https://example.com')}><Plus size={13} /></button></div><div className="safari-viewport">{showSidebar && <aside className="safari-sidebar"><strong>Favorites</strong><button onClick={() => navigate('https://example.com')}>Example</button><button onClick={() => navigate('https://developer.mozilla.org')}>MDN</button><button onClick={() => navigate('https://wikipedia.org')}>Wikipedia</button></aside>}<iframe key={`${page}-${refreshKey}`} title="Safari web content" src={src} sandbox="allow-scripts allow-forms allow-popups" onLoad={() => { setLoading(false); setFailed(false) }} onError={() => { setLoading(false); setFailed(true) }} />{loading && <div className="safari-loading"><LoaderCircle size={20} className="spin" /> Loading {new URL(page).hostname}…</div>}{failed && <div className="safari-error"><ShieldAlert size={27} /><strong>Safari can’t open this page</strong><span>Start the optional proxy service with <code>npm run server</code>.</span></div>}</div><footer className="safari-status"><span><LockKeyhole size={10} /> Private browsing</span><span>{new URL(page).hostname}</span></footer></div>
}

const assistantTools = [{ type: 'function', function: { name: 'control_os', description: 'Control the desktop or change its virtual filesystem.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['open_app', 'create_file', 'create_folder', 'read_file', 'list_files'] }, app: { type: 'string', enum: ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant'] }, path: { type: 'string' }, content: { type: 'string' } }, required: ['action'] } } }]

export function AssistantApp() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([{ role: 'assistant', content: 'Good afternoon. What can I help you with?' }])
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('groq-api-key') ?? '')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  const runTool = (raw: string) => {
    const args = JSON.parse(raw) as { action: string; app?: AppId; path?: string; content?: string }
    const os = useSystemStore.getState()
    if (!os.assistantControlEnabled) return 'Desktop control is disabled in Privacy & Security settings.'
    if (args.action === 'open_app' && args.app) { os.openApp(args.app); return `${args.app} opened.` }
    if (args.action === 'create_file' && args.path) return os.writeFile(args.path, args.content ?? '') ? `Created ${args.path}.` : `Could not create ${args.path}; check that its parent folder exists.`
    if (args.action === 'create_folder' && args.path) return os.createEntry(args.path, 'folder') ? `Created ${args.path}.` : `Could not create ${args.path}.`
    if (args.action === 'read_file' && args.path) return os.files[normalizePath(args.path)]?.content ?? 'File not found.'
    if (args.action === 'list_files') return Object.keys(os.files).join('\n')
    return 'That action is not available.'
  }
  const send = async (text = input) => {
    if (!text.trim() || busy) return
    const nextMessages = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages(nextMessages); setInput(''); setBusy(true)
    if (!apiKey) { setMessages((current) => [...current, { role: 'assistant', content: 'Add your Groq API key using the sliders button to start a conversation. Your key is kept only for this browser session.' }]); setBusy(false); return }
    try {
      const apiMessages: Array<Record<string, unknown>> = [{ role: 'system', content: 'You are Mac Assistant, a thoughtful and concise desktop AI. You can operate this desktop using control_os. Ask before destructive actions. File paths use /Documents, /Desktop, /Downloads, or /Pictures.' }, ...nextMessages]
      let answer = ''
      for (let turn = 0; turn < 4; turn++) {
        const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Groq-Api-Key': apiKey }, body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages: apiMessages, tools: assistantTools, tool_choice: 'auto', temperature: 0.7 }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Groq request failed (${response.status}). Check the API key and try again.`)
        const message = data.choices?.[0]?.message
        if (!message) throw new Error('The assistant returned an empty response.')
        if (message.tool_calls?.length) {
          apiMessages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
          for (const call of message.tool_calls) apiMessages.push({ role: 'tool', tool_call_id: call.id, content: runTool(call.function.arguments) })
          continue
        }
        answer = message.content ?? ''
        break
      }
      setMessages((current) => [...current, { role: 'assistant', content: answer || 'Done.' }])
    } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'Something went wrong.' }]) }
    finally { setBusy(false) }
  }
  const suggestions = ['Organize my desktop', 'Create a notes file', 'Open System Settings']
  return <div className="assistant-app"><header className="assistant-header"><div className="assistant-brand"><span><Sparkles size={16} /></span><div><strong>Mac Assistant</strong><small>Here when you need me</small></div></div><button title="Settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /></button></header>{settingsOpen && <div className="assistant-settings"><label htmlFor="groq-key">Groq API key</label><input id="groq-key" type="password" placeholder="gsk_…" value={apiKey} onChange={(event) => { setApiKey(event.target.value); sessionStorage.setItem('groq-api-key', event.target.value) }} /><small>Sent to Groq through this local server. Never saved on the server.</small></div>}<div className="assistant-messages">{messages.length === 1 && <div className="assistant-welcome"><span className="welcome-orb"><Sparkles size={23} /></span><h2>A little help,<br />right when you need it.</h2><p>Ask a question or tell me what to do on your Mac.</p></div>}{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span className="message-avatar">{message.role === 'assistant' ? <Sparkles size={13} /> : 'You'}</span><p>{message.content}</p></div>)}{busy && <div className="chat-message assistant"><span className="message-avatar"><Sparkles size={13} /></span><p><LoaderCircle className="spin" size={16} /></p></div>}<div ref={endRef} /></div>{messages.length === 1 && <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}<ArrowRight size={12} /></button>)}</div>}<form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); void send() }}><textarea aria-label="Message Mac Assistant" placeholder="Message Mac Assistant…" rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} /><div><button type="button" title="Help" onClick={() => setSettingsOpen(true)}><CircleHelp size={15} /></button><button className="send-button" title="Send" disabled={busy || !input.trim()}><Send size={15} /></button></div></form><footer className="assistant-disclaimer">Mac Assistant can make mistakes. Review important changes.</footer></div>
}