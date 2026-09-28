import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ArrowLeft, ArrowRight, Bot, Check, ChevronDown, CircleHelp, Cloud, FilePlus2, Folder, FolderPlus, Globe, Grid2X2, LoaderCircle, LockKeyhole, Mic, MicOff, MonitorUp, MoreHorizontal, Plus, RefreshCw, Save, Search, Send, Settings2, ShieldAlert, Sidebar, Sparkles, Trash2, Wifi, X } from 'lucide-react'
import { useSystemStore, normalizePath } from '../system/store'
import type { FsEntry } from '../system/types'
import { assistantTools, DEFAULT_GROQ_MODEL, executeAssistantTool } from './assistantTools'
import { showOSAlert, showOSConfirm, showOSPrompt } from '../system/dialogs'

const childrenAt = (files: Record<string, FsEntry>, folder: string) => Object.entries(files)
  .filter(([path]) => path !== folder && normalizePath(path.slice(0, path.lastIndexOf('/')) || '/') === folder)
  .sort(([a, first], [b, second]) => first.type !== second.type ? (first.type === 'folder' ? -1 : 1) : a.localeCompare(b))

const basename = (path: string) => path.slice(path.lastIndexOf('/') + 1) || 'Macintosh HD'
const iconFor = (entry: FsEntry) => entry.type === 'folder' ? <Folder size={25} fill="#79aefc" color="#4f88dc" /> : <FilePlus2 size={24} color="#92a6c8" />

export function FinderApp() {
  const { files, createEntry, deleteEntry, moveEntry, renameEntry, openApp } = useSystemStore(useShallow((state) => ({ files: state.files, createEntry: state.createEntry, deleteEntry: state.deleteEntry, moveEntry: state.moveEntry, renameEntry: state.renameEntry, openApp: state.openApp })))
  const [folder, setFolder] = useState('/Documents')
  const [selection, setSelection] = useState<string | null>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [draftEntry, setDraftEntry] = useState<{ type: 'folder' | 'file'; name: string }>({ type: 'file', name: '' })
  const [creating, setCreating] = useState(false)
  const entries = useMemo(() => childrenAt(files, folder).filter(([path]) => basename(path).toLowerCase().includes(search.toLowerCase())), [files, folder, search])
  const navigate = (path: string) => { setFolder(path); setSelection(null); setSearch('') }
  useEffect(() => {
    const openPath = (event: Event) => navigate((event as CustomEvent<string>).detail)
    window.addEventListener('finder-open-path', openPath)
    return () => window.removeEventListener('finder-open-path', openPath)
  }, [])
  const renameSelected = async () => {
    if (!selection) return
    const next = await showOSPrompt('Rename Item', 'Enter a new name for this item.', basename(selection))
    if (next && renameEntry(selection, next)) setSelection(`${selection.slice(0, selection.lastIndexOf('/'))}/${next}`)
  }
  const confirmMoveToTrash = async () => {
    if (!selection) return
    if (await showOSConfirm('Move to Trash?', `Move ${basename(selection)} to the Trash?`, 'Move to Trash')) { deleteEntry(selection); setSelection(null) }
  }
  const dropEntry = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const source = event.dataTransfer.getData('application/x-mac-nos-file')
    if (!source) return
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-entry-path]')
    const destination = target && files[target.dataset.entryPath ?? '']?.type === 'folder' ? target.dataset.entryPath! : folder
    moveEntry(source, destination)
  }
  const beginEntry = (type: 'folder' | 'file') => { setDraftEntry({ type, name: type === 'folder' ? 'Untitled Folder' : 'Untitled.txt' }); setCreating(true) }
  const commitEntry = (event: React.FormEvent) => {
    event.preventDefault()
    const name = draftEntry.name.trim()
    if (!name) return
    const path = `${folder}/${name}`
    if (createEntry(path, draftEntry.type)) {
      setCreating(false)
      setSelection(path)
      if (draftEntry.type === 'file') openFile(path)
    }
  }
  const openFile = (path: string) => {
    openApp('textedit')
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('open-text-file', { detail: path })), 0)
  }
  const openSelected = (path: string, entry: FsEntry) => { if (entry.type === 'folder') navigate(path); else openFile(path) }

  return <div className="finder-app">
    <aside className="finder-sidebar"><div className="sidebar-group-label">Favorites</div>{[['/Desktop', 'Desktop'], ['/Documents', 'Documents'], ['/Downloads', 'Downloads'], ['/Pictures', 'Pictures']].map(([path, label]) => <button key={path} data-path={path} className={`sidebar-item ${folder === path ? 'selected' : ''}`} onClick={() => navigate(path)}><span>{label === 'Desktop' ? '▧' : label === 'Documents' ? '▤' : label === 'Downloads' ? '⇩' : '▣'}</span>{label}</button>)}<div className="sidebar-group-label locations-label">Locations</div><button className="sidebar-item" data-path="/" onClick={() => navigate('/')}><span>⌘</span>Macintosh HD</button><button className="sidebar-item" onClick={() => useSystemStore.getState().openApp('trash')}><span>▥</span>Trash</button><div className="sidebar-bottom"><Cloud size={15} /> iCloud Drive</div></aside>
    <section className="finder-main">
      <div className="finder-toolbar"><div className="finder-nav"><button title="Back" onClick={() => navigate('/') }><ArrowLeft size={15} /></button><button title="Forward" disabled><ArrowRight size={15} /></button></div><h2>{basename(folder)}</h2><div className="toolbar-actions"><button title="New folder" onClick={() => beginEntry('folder')}><FolderPlus size={16} /></button><button title="New file" onClick={() => beginEntry('file')}><FilePlus2 size={16} /></button><button title="Rename selected" disabled={!selection} onClick={() => void renameSelected()}>Rename</button><button title="Move selected to Trash" disabled={!selection} onClick={() => void confirmMoveToTrash()}><Trash2 size={15} /></button><button title="List view" className={layout === 'list' ? 'active' : ''} onClick={() => setLayout(layout === 'grid' ? 'list' : 'grid')}><Grid2X2 size={15} /></button></div></div>
      <div className="finder-breadcrumbs">{folder.split('/').filter(Boolean).map((part, index, parts) => { const path = `/${parts.slice(0, index + 1).join('/')}`; return <span key={path}><button onClick={() => navigate(path)}>{part}</button><span>›</span></span>})}</div>
      <div className={`finder-path ${layout}`} data-current-folder={folder} onDragOver={(event) => event.preventDefault()} onDrop={dropEntry}>
        <div className="finder-inline-search"><Search size={14} /><input aria-label="Search this folder" placeholder="Search this folder" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {pendingDelete && <div className="finder-delete-confirm" data-finder-delete-confirm><span>Move {basename(pendingDelete)} to the Trash?</span><button onClick={() => setPendingDelete(null)}>Cancel</button><button className="destructive" data-confirm-trash onClick={() => { deleteEntry(pendingDelete); setSelection(null); setPendingDelete(null) }}>Move to Trash</button></div>}
        {creating && <form className="file-entry-create" onSubmit={commitEntry}><input data-assistant-entry-name aria-label={`New ${draftEntry.type} name`} autoFocus value={draftEntry.name} onChange={(event) => setDraftEntry({ ...draftEntry, name: event.target.value })} onKeyDown={(event) => { if (event.key === 'Escape') setCreating(false) }} /><button data-assistant-entry-submit type="submit" aria-label="Create item"><Check size={14} /></button></form>}
        {entries.length ? entries.map(([path, entry]) => <button key={path} draggable data-entry-path={path} className={`file-entry ${selection === path ? 'selected' : ''}`} onDragStart={(event) => event.dataTransfer.setData('application/x-mac-nos-file', path)} onClick={() => setSelection(path)} onDoubleClick={() => openSelected(path, entry)}>{iconFor(entry)}<span>{basename(path)}</span></button>) : !creating && <div className="empty-folder"><Folder size={38} /><span>{search ? 'No matching items' : 'This folder is empty'}</span></div>}
      </div><footer className="finder-status">{entries.length} items <span>Available on this Mac</span></footer>
    </section>
  </div>
}

export function TrashApp() {
  const { trash, restoreTrashItem, permanentlyDeleteTrashItem, emptyTrash } = useSystemStore(useShallow((state) => ({
    trash: state.trash,
    restoreTrashItem: state.restoreTrashItem,
    permanentlyDeleteTrashItem: state.permanentlyDeleteTrashItem,
    emptyTrash: state.emptyTrash,
  })))
  return <section className="trash-app"><header className="trash-toolbar"><strong>{trash.length ? `${trash.length} items` : 'Trash is empty'}</strong><button className="small-action destructive" disabled={!trash.length} onClick={() => void showOSConfirm('Empty Trash?', 'Permanently delete every item in the Trash?', 'Empty Trash').then((confirmed) => confirmed && emptyTrash())}>Empty Trash…</button></header>{trash.length ? <div className="trash-list">{trash.map((item) => <article className="trash-row" key={`${item.path}-${item.deletedAt}`}><div><strong>{item.path.slice(item.path.lastIndexOf('/') + 1)}</strong><small>Original location: {item.path.slice(0, item.path.lastIndexOf('/')) || '/'}</small></div><button title="Put Back" onClick={() => restoreTrashItem(item.path)}>Put Back</button><button className="destructive" title="Delete permanently" onClick={() => void showOSConfirm('Delete Permanently?', `Permanently delete ${item.path}?`, 'Delete').then((confirmed) => confirmed && permanentlyDeleteTrashItem(item.path))}><Trash2 size={14} /></button></article>)}</div> : <div className="trash-empty"><Trash2 size={38} /><span>Items you move to the Trash appear here.</span></div>}</section>
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
  return <div className="textedit-app"><div className="textedit-toolbar"><select aria-label="Document" value={path} onChange={(event) => chooseFile(event.target.value)}>{filePaths.map((file) => <option key={file} value={file}>{basename(file)}</option>)}</select><span className="save-state">{saved ? <><Check size={12} /> Saved</> : 'Edited'}</span><button className="primary-button" data-assistant-save onClick={save}><Save size={14} /> Save</button></div><textarea aria-label="Document text" spellCheck value={content} onChange={(event) => { setContent(event.target.value); setSaved(false) }} /></div>
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
  const { darkMode, wallpaper, setWallpaper, files, wifiEnabled, bluetoothEnabled, notificationsEnabled, focusMode, accentColor, brightness, volume, autoAppearance, reduceMotion, highContrast, soundEffectsEnabled, showDesktopIcons, dockMagnification, assistantControlEnabled, updatePreferences, resetFilesystem } = useSystemStore(useShallow((state) => ({
    darkMode: state.darkMode, wallpaper: state.wallpaper, setWallpaper: state.setWallpaper, files: state.files,
    wifiEnabled: state.wifiEnabled, bluetoothEnabled: state.bluetoothEnabled, notificationsEnabled: state.notificationsEnabled, focusMode: state.focusMode,
    accentColor: state.accentColor, brightness: state.brightness, volume: state.volume, autoAppearance: state.autoAppearance, reduceMotion: state.reduceMotion, highContrast: state.highContrast, soundEffectsEnabled: state.soundEffectsEnabled, showDesktopIcons: state.showDesktopIcons, dockMagnification: state.dockMagnification,
    assistantControlEnabled: state.assistantControlEnabled, updatePreferences: state.updatePreferences, resetFilesystem: state.resetFilesystem,
  })))
  const [section, setSection] = useState('Appearance')
  const [query, setQuery] = useState('')
  const sections = ['Wi-Fi', 'Bluetooth', 'Network', 'Notifications', 'General', 'Appearance', 'Wallpaper', 'Desktop & Dock', 'Keyboard', 'Sound', 'Accessibility', 'Battery', 'Storage', 'Privacy & Security']
  const filtered = sections.filter((item) => item.toLowerCase().includes(query.toLowerCase()))
  const accentColors = ['#1976d2', '#d44336', '#e98126', '#d2a629', '#55a85a', '#9c6ade']
  const resetFiles = () => {
    void showOSConfirm('Erase Virtual Files?', 'Remove all files from this Mac? This cannot be undone.', 'Erase Files').then((confirmed) => confirmed && resetFilesystem())
  }

  let content
  if (section === 'Appearance') content = <>
    <p>Choose how Mac-NO-S looks and feels.</p>
    <div className="appearance-options"><button className={!autoAppearance && !darkMode ? 'chosen' : ''} onClick={() => updatePreferences({ autoAppearance: false, darkMode: false })}><span className="appearance-preview light-preview" />Light</button><button className={!autoAppearance && darkMode ? 'chosen' : ''} onClick={() => updatePreferences({ autoAppearance: false, darkMode: true })}><span className="appearance-preview dark-preview" />Dark</button></div>
    <SettingSwitch label="Automatic appearance" description="Match the system appearance schedule" checked={autoAppearance} onChange={() => { const next = !autoAppearance; updatePreferences({ autoAppearance: next, ...(next ? { darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches } : {}) }) }} />
    <div className="setting-row"><div><strong>Accent color</strong><small>Used for selections and highlights</small></div><div className="swatches">{accentColors.map((color) => <button key={color} className={accentColor === color ? 'chosen' : ''} style={{ background: color }} aria-label={`Set accent color ${color}`} onClick={() => updatePreferences({ accentColor: color })} />)}</div></div>
    <label className="range-setting"><span>Display brightness</span><input type="range" min="35" max="100" value={brightness} onChange={(event) => updatePreferences({ brightness: Number(event.target.value) })} /><output>{brightness}%</output></label>
  </>
  else if (section === 'Wi-Fi') content = <><p>Connect this simulated Mac to a wireless network.</p><SettingSwitch label="Wi-Fi" description={wifiEnabled ? 'Connected to Studio Network' : 'Turn on Wi-Fi to see available networks'} checked={wifiEnabled} onChange={() => updatePreferences({ wifiEnabled: !wifiEnabled })} />{wifiEnabled && <div className="setting-row"><div><strong>Studio Network</strong><small>Secured · Connected</small></div><span className="spec-pill">✓</span></div>}</>
  else if (section === 'Bluetooth') content = <><p>Connect wireless accessories to this Mac.</p><SettingSwitch label="Bluetooth" description={bluetoothEnabled ? 'On · No new devices nearby' : 'Bluetooth is off'} checked={bluetoothEnabled} onChange={() => updatePreferences({ bluetoothEnabled: !bluetoothEnabled })} />{bluetoothEnabled && <div className="setting-row"><div><strong>My Devices</strong><small>No devices connected</small></div><button className="small-action" onClick={() => void showOSAlert('Bluetooth', 'Put your Bluetooth accessory in pairing mode to connect it.')}>Connect</button></div>}</>
  else if (section === 'Network') content = <><p>Network connections for this Mac.</p><div className="setting-row"><div><strong>Wi-Fi</strong><small>{wifiEnabled ? 'Studio Network · Connected' : 'Off'}</small></div><span className={`connection-state ${wifiEnabled ? 'connected' : ''}`}>{wifiEnabled ? 'Connected' : 'Not connected'}</span></div><div className="setting-row"><div><strong>Private Wi-Fi address</strong><small>Rotates periodically for privacy</small></div><span className="spec-pill">On</span></div></>
  else if (section === 'Notifications') content = <><p>Choose when notifications are shown.</p><SettingSwitch label="Allow notifications" description="Show alerts from apps on this Mac" checked={notificationsEnabled} onChange={() => updatePreferences({ notificationsEnabled: !notificationsEnabled })} /><SettingSwitch label="Focus" description="Silence notifications while you work" checked={focusMode} onChange={() => updatePreferences({ focusMode: !focusMode })} /></>
  else if (section === 'General') content = <><p>About this Mac and its local storage.</p><div className="setting-row"><div><strong>Mac-NO-S</strong><small>Browser Desktop · Version 1.0</small></div><span className="spec-pill">{navigator.platform || 'Web'}</span></div><div className="setting-row"><div><strong>Browser</strong><small>{navigator.userAgent.split(' ').slice(-2).join(' ')}</small></div><span className="spec-pill">Web runtime</span></div></>
  else if (section === 'Wallpaper') content = <><p>Choose a picture or color for the desktop.</p><div className="wallpaper-options">{wallpapers.map((item) => <button key={item.id} className={wallpaper === item.id ? 'chosen' : ''} onClick={() => setWallpaper(item.id)}><span style={{ background: item.style }} />{item.label}</button>)}</div></>
  else if (section === 'Desktop & Dock') content = <><p>Choose what appears on your desktop and Dock.</p><SettingSwitch label="Show desktop icons" description="Show Macintosh HD and Projects on the desktop" checked={showDesktopIcons} onChange={() => updatePreferences({ showDesktopIcons: !showDesktopIcons })} /><SettingSwitch label="Dock magnification" description="Enlarge icons when the pointer moves over the Dock" checked={dockMagnification} onChange={() => updatePreferences({ dockMagnification: !dockMagnification })} /></>
  else if (section === 'Keyboard') content = <><p>Keyboard shortcuts for navigating this desktop.</p>{[['⌘ Space', 'Open Spotlight'], ['⌘ Tab', 'Switch applications'], ['⌘ W', 'Close active window'], ['⌘ Q', 'Quit active app'], ['F3', 'Mission Control'], ['Control ← / →', 'Switch desktop Spaces']].map(([shortcut, action]) => <div className="setting-row shortcut-row" key={shortcut}><strong>{action}</strong><kbd>{shortcut}</kbd></div>)}</>
  else if (section === 'Sound') content = <><p>Adjust simulated system output and interface sounds.</p><label className="range-setting"><span>Output volume</span><input type="range" min="0" max="100" value={volume} onChange={(event) => updatePreferences({ volume: Number(event.target.value) })} /><output>{volume}%</output></label><SettingSwitch label="Play interface sound effects" description="Play a short sound when Hey Mac activates" checked={soundEffectsEnabled} onChange={() => updatePreferences({ soundEffectsEnabled: !soundEffectsEnabled })} /><div className="setting-row"><div><strong>Sound check</strong><small>Preview the assistant activation sound</small></div><button className="small-action" onClick={() => window.dispatchEvent(new Event('mac-assistant-blup'))}>Play</button></div></>
  else if (section === 'Accessibility') content = <><p>Adjust motion and contrast for this desktop.</p><SettingSwitch label="Reduce motion" description="Use shorter, simpler window transitions" checked={reduceMotion} onChange={() => updatePreferences({ reduceMotion: !reduceMotion })} /><SettingSwitch label="Increase contrast" description="Strengthen borders and text contrast" checked={highContrast} onChange={() => updatePreferences({ highContrast: !highContrast })} /></>
  else if (section === 'Battery') content = <><p>Power controls available to this browser desktop.</p><div className="setting-row"><div><strong>Power source</strong><small>Host battery status is not exposed to this website</small></div><span className="spec-pill">Web runtime</span></div><div className="setting-row"><div><strong>Low Power Mode</strong><small>Reduce visual effects and display brightness</small></div><button className="small-action" onClick={() => updatePreferences({ reduceMotion: true, brightness: Math.min(brightness, 70), highContrast: true })}>Turn On</button></div></>
  else if (section === 'Storage') { const bytes = new Blob([JSON.stringify(files)]).size; content = <><p>Storage used by this browser desktop.</p><div className="storage-meter"><span style={{ width: `${Math.min(100, bytes / 50000 * 100)}%` }} /></div><div className="setting-row"><div><strong>Virtual files</strong><small>{Object.keys(files).length} items</small></div><span className="spec-pill">{bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`}</span></div><div className="setting-row"><div><strong>Browser storage</strong><small>Data stays in this browser profile</small></div><span className="spec-pill">Local</span></div></> }
  else content = <><p>Control local data and assistant access on this browser.</p><SettingSwitch label="Mac Assistant desktop access" description="Allow the assistant to open apps and manage virtual files" checked={assistantControlEnabled} onChange={() => updatePreferences({ assistantControlEnabled: !assistantControlEnabled })} /><div className="setting-row"><div><strong>Clear virtual filesystem</strong><small>Remove files saved by this browser desktop</small></div><button className="small-action destructive" onClick={resetFiles}>Clear files…</button></div></>

  return <div className="settings-app"><aside className="settings-sidebar"><div className="settings-search"><Search size={14} /><input placeholder="Search Settings" aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} /></div>{filtered.map((item, index) => <button key={item} className={section === item ? 'selected' : ''} onClick={() => setSection(item)}><span className={`settings-symbol symbol-${index}`}>{['◉', 'ᛒ', '⌘', '◉', '⚙', '◐', '▧', '▣', '⌨', '♪', '◉', '▰', '▤', '◈'][sections.indexOf(item)]}</span>{item}</button>)}</aside><section className="settings-main"><h2>{section}</h2>{content}</section></div>
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

type GroqModel = { id: string; contextWindow?: number; vision?: boolean }

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The screen image could not be prepared.'))
    reader.onerror = () => reject(new Error('The screen image could not be prepared.'))
    reader.readAsDataURL(blob)
  })
}

export function AssistantApp() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([{ role: 'assistant', content: 'Good afternoon. What can I help you with?' }])
  const [input, setInput] = useState('')
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('groq-api-key') ?? '')
  const [selectedModel, setSelectedModel] = useState(() => {
    const stored = sessionStorage.getItem('groq-model')
    return !stored || stored === 'llama-3.3-70b-versatile' ? DEFAULT_GROQ_MODEL : stored
  })
  const [models, setModels] = useState<GroqModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [discoveryVersion, setDiscoveryVersion] = useState(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, busy])
  useEffect(() => {
    const handleVoiceState = (event: Event) => setVoiceEnabled((event as CustomEvent<boolean>).detail)
    const openVoiceSettings = () => setSettingsOpen(true)
    const handleVoiceChat = (event: Event) => {
      const message = (event as CustomEvent<{ role: 'user' | 'assistant'; content: string }>).detail
      if (message?.content) setMessages((current) => [...current, message])
    }
    const handleScreenAnalyze = (event: Event) => { void analyzeScreen((event as CustomEvent<MediaStream>).detail) }
    const handleScreenError = (event: Event) => setMessages((current) => [...current, { role: 'assistant', content: (event as CustomEvent<string>).detail }])
    const queryTimer = window.setTimeout(() => window.dispatchEvent(new Event('mac-voice-query')), 0)
    window.addEventListener('mac-voice-state', handleVoiceState)
    window.addEventListener('mac-voice-chat', handleVoiceChat)
    window.addEventListener('mac-assistant-analyze-screen', handleScreenAnalyze)
    window.addEventListener('mac-assistant-screen-error', handleScreenError)
    window.addEventListener('mac-assistant-open-settings', openVoiceSettings)
    return () => {
      window.clearTimeout(queryTimer)
      window.removeEventListener('mac-voice-state', handleVoiceState)
      window.removeEventListener('mac-voice-chat', handleVoiceChat)
      window.removeEventListener('mac-assistant-analyze-screen', handleScreenAnalyze)
      window.removeEventListener('mac-assistant-screen-error', handleScreenError)
      window.removeEventListener('mac-assistant-open-settings', openVoiceSettings)
    }
  }, [])
  useEffect(() => { sessionStorage.setItem('groq-model', selectedModel) }, [selectedModel])
  useEffect(() => {
    if (!apiKey.trim()) { setModels([]); setModelsError(''); setModelsLoading(false); return }
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setModelsLoading(true)
      setModelsError('')
      try {
        const response = await fetch('/api/assistant/models', { headers: { 'X-Groq-Api-Key': apiKey }, signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Model lookup failed (${response.status}).`)
        const available: GroqModel[] = data.models ?? []
        setModels(available)
        if (available.length && !available.some((model) => model.id === selectedModel)) {
          const preferred = available.find((model) => model.id === DEFAULT_GROQ_MODEL) ?? available.find((model) => model.id.startsWith('qwen/')) ?? available[0]
          setSelectedModel(preferred.id)
          sessionStorage.setItem('groq-model', preferred.id)
        }
        if (!available.length) setModelsError('No chat models are available for this API key.')
      } catch (error) {
        if (!controller.signal.aborted) setModelsError(error instanceof Error ? error.message : 'Could not load models.')
      } finally {
        if (!controller.signal.aborted) setModelsLoading(false)
      }
    }, 500)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [apiKey, discoveryVersion])
  const send = async (text = input) => {
    if (!text.trim() || busyRef.current) return
    busyRef.current = true
    const nextMessages = [...messages, { role: 'user' as const, content: text.trim() }]
    setMessages(nextMessages); setInput(''); setBusy(true)
    if (!apiKey) { setMessages((current) => [...current, { role: 'assistant', content: 'Add your Groq API key using the sliders button to start a conversation. Your key is kept only for this browser session.' }]); setBusy(false); busyRef.current = false; return }
    try {
      const apiMessages: Array<Record<string, unknown>> = [{ role: 'system', content: 'You are Mac Assistant, a thoughtful and concise desktop AI. You can operate this desktop using control_os. Every system action is carried out visibly by opening apps and using their interfaces; never imply filesystem or app changes happened invisibly. Ask before destructive actions. File paths use /Documents, /Desktop, /Downloads, or /Pictures.' }, ...nextMessages]
      const completedActions = new Map<string, string>()
      let answer = ''
      for (let turn = 0; turn < 4; turn++) {
        const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Groq-Api-Key': apiKey }, body: JSON.stringify({ model: selectedModel, messages: apiMessages, tools: assistantTools, tool_choice: 'auto', temperature: 0.7 }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Groq request failed (${response.status}). Check the API key and try again.`)
        const message = data.choices?.[0]?.message
        if (!message) throw new Error('The assistant returned an empty response.')
        if (message.tool_calls?.length) {
          apiMessages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
          for (const call of message.tool_calls) {
            let actionKey = call.function.arguments
            try { actionKey = JSON.stringify(JSON.parse(actionKey)) } catch {}
            let result: string
            if (completedActions.has(actionKey)) result = completedActions.get(actionKey) ?? ''
            else {
              result = await executeAssistantTool(call.function.arguments)
              completedActions.set(actionKey, result)
            }
            apiMessages.push({ role: 'tool', tool_call_id: call.id, content: result })
          }
          continue
        }
        answer = message.content ?? ''
        break
      }
      setMessages((current) => [...current, { role: 'assistant', content: answer || 'Done.' }])
    } catch (error) { setMessages((current) => [...current, { role: 'assistant', content: error instanceof Error ? error.message : 'Something went wrong.' }]) }
    finally { setBusy(false); busyRef.current = false }
  }
  const analyzeScreen = async (grantedStream?: MediaStream) => {
    const stopGrantedStream = () => grantedStream?.getTracks().forEach((track) => track.stop())
    if (busyRef.current) { stopGrantedStream(); return }
    if (!apiKey) {
      stopGrantedStream()
      setSettingsOpen(true)
      setMessages((current) => [...current, { role: 'assistant', content: 'Add your Groq API key in settings before analyzing a screen.' }])
      return
    }
    const visionModel = models.find((model) => model.id === selectedModel && model.vision) ?? models.find((model) => model.vision)
    if (!visionModel) {
      stopGrantedStream()
      setMessages((current) => [...current, { role: 'assistant', content: 'No vision-capable Groq model is available for this API key. Refresh the model list or try another key.' }])
      return
    }

    busyRef.current = true
    setBusy(true)
    let stream: MediaStream | null = null
    let video: HTMLVideoElement | null = null
    try {
      stream = grantedStream ?? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.srcObject = stream
      await new Promise<void>((resolve, reject) => {
        video!.onloadedmetadata = () => resolve()
        video!.onerror = () => reject(new Error('The selected screen could not be read.'))
      })
      await video.play()
      const scale = Math.min(1, 1280 / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The screen image could not be encoded.')), 'image/jpeg', 0.65))
      stream.getTracks().forEach((track) => track.stop())
      stream = null
      video.pause()
      video.srcObject = null
      const imageUrl = await blobAsDataUrl(image)
      if (imageUrl.length > 3_500_000) throw new Error('This screen image is too large to send. Try sharing a smaller window.')
      const question = input.trim() || 'Describe what is visible on my screen and point out anything that needs attention.'
      setInput('')
      setMessages((current) => [...current, { role: 'user', content: `[Screen analysis] ${question}` }])
      const apiMessages: Array<Record<string, unknown>> = [
        { role: 'system', content: 'You are Mac Assistant. Analyze the user-approved screen capture carefully. Be concise and distinguish visible facts from guesses. If the user asks for an action, use control_os and carry it out visibly through the app UI. Never claim you can see beyond this single captured image.' },
        { role: 'user', content: [{ type: 'text', text: question }, { type: 'image_url', image_url: { url: imageUrl } }] },
      ]
      const completedActions = new Map<string, string>()
      let answer = ''
      for (let turn = 0; turn < 4; turn++) {
        const response = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Groq-Api-Key': apiKey }, body: JSON.stringify({ model: visionModel.id, messages: apiMessages, tools: assistantTools, tool_choice: 'auto', temperature: 0.4 }) })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Screen analysis failed (${response.status}).`)
        const message = data.choices?.[0]?.message
        if (!message) throw new Error('The vision model returned an empty response.')
        if (message.tool_calls?.length) {
          apiMessages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
          for (const call of message.tool_calls) {
            let actionKey = call.function.arguments
            try { actionKey = JSON.stringify(JSON.parse(actionKey)) } catch {}
            let result: string
            if (completedActions.has(actionKey)) result = completedActions.get(actionKey) ?? ''
            else { result = await executeAssistantTool(call.function.arguments); completedActions.set(actionKey, result) }
            apiMessages.push({ role: 'tool', tool_call_id: call.id, content: result })
          }
          continue
        }
        answer = message.content ?? ''
        break
      }
      setMessages((current) => [...current, { role: 'assistant', content: `${answer || 'I could not analyze that screen.'} (Analyzed with ${visionModel.id})` }])
    } catch (error) {
      const message = error instanceof Error && error.name === 'NotAllowedError' ? 'Screen sharing was canceled.' : error instanceof Error ? error.message : 'Screen analysis failed.'
      setMessages((current) => [...current, { role: 'assistant', content: message }])
    } finally {
      stream?.getTracks().forEach((track) => track.stop())
      if (video) { video.pause(); video.srcObject = null }
      setBusy(false)
      busyRef.current = false
    }
  }
  const suggestions = ['Organize my desktop', 'Create a notes file', 'Open System Settings']
  return <div className="assistant-app"><header className="assistant-header"><div className="assistant-brand"><span><Sparkles size={16} /></span><div><strong>Mac Assistant</strong><small>Here when you need me</small></div></div><div className="assistant-header-actions"><div className="model-control"><select aria-label="Available Groq models" title={modelsError || (modelsLoading ? 'Detecting available models…' : 'Choose a model')} value={selectedModel} disabled={!apiKey || modelsLoading || models.length === 0} onChange={(event) => { setSelectedModel(event.target.value); sessionStorage.setItem('groq-model', event.target.value) }}>{models.length ? models.map((model) => <option key={model.id} value={model.id}>{model.id}</option>) : <option value={selectedModel}>{modelsLoading ? 'Detecting models…' : apiKey ? 'No models found' : 'Add API key'}</option>}</select><button title={modelsError || 'Refresh available models'} aria-label="Refresh available models" disabled={!apiKey || modelsLoading} onClick={() => setDiscoveryVersion((version) => version + 1)}>{modelsLoading ? <LoaderCircle size={13} className="spin" /> : <RefreshCw size={13} />}</button></div><button className={`voice-toggle ${voiceEnabled ? 'active' : ''}`} title={voiceEnabled ? 'Turn off Hey Mac voice control' : 'Turn on Hey Mac voice control'} aria-label="Toggle voice control" aria-pressed={voiceEnabled} onClick={() => window.dispatchEvent(new Event('mac-voice-toggle'))}>{voiceEnabled ? <Mic size={16} /> : <MicOff size={16} />}</button><button title="Settings" aria-label="Assistant settings" onClick={() => setSettingsOpen(!settingsOpen)}><Settings2 size={17} /></button></div></header>{settingsOpen && <div className="assistant-settings"><label htmlFor="groq-key">Groq API key</label><input id="groq-key" type="password" placeholder="gsk_…" value={apiKey} onChange={(event) => { setApiKey(event.target.value); sessionStorage.setItem('groq-api-key', event.target.value) }} /><small>Sent to Groq through this local server. Never saved on the server.</small>{modelsError && <small className="model-error">{modelsError}</small>}</div>}<div className="assistant-messages">{messages.length === 1 && <div className="assistant-welcome"><span className="welcome-orb"><Sparkles size={23} /></span><h2>A little help,<br />right when you need it.</h2><p>Ask a question or tell me what to do on your Mac.</p></div>}{messages.map((message, index) => <div key={index} className={`chat-message ${message.role}`}><span className="message-avatar">{message.role === 'assistant' ? <Sparkles size={13} /> : 'You'}</span><p>{message.content}</p></div>)}{busy && <div className="chat-message assistant"><span className="message-avatar"><Sparkles size={13} /></span><p><LoaderCircle className="spin" size={16} /></p></div>}<div ref={endRef} /></div>{messages.length === 1 && <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)}>{suggestion}<ArrowRight size={12} /></button>)}</div>}<form className="assistant-compose" onSubmit={(event) => { event.preventDefault(); void send() }}><textarea aria-label="Message Mac Assistant" placeholder="Message Mac Assistant…" rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} /><div><button type="button" title="Help" onClick={() => setSettingsOpen(true)}><CircleHelp size={15} /></button><button className="send-button" title="Send" disabled={busy || !input.trim()}><Send size={15} /></button></div></form><footer className="assistant-disclaimer">Mac Assistant can make mistakes. Review important changes.</footer></div>
}