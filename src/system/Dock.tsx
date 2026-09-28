import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Bot, Compass, FileText, Folder, Settings, Terminal, Trash2 } from 'lucide-react'
import { useSystemStore } from './store'
import type { AppId } from './types'

const items: { id: AppId; label: string; icon: typeof Folder; color: string }[] = [
  { id: 'finder', label: 'Finder', icon: Folder, color: 'finder-icon' },
  { id: 'safari', label: 'Safari', icon: Compass, color: 'safari-icon' },
  { id: 'textedit', label: 'TextEdit', icon: FileText, color: 'textedit-icon' },
  { id: 'terminal', label: 'Terminal', icon: Terminal, color: 'terminal-icon' },
  { id: 'assistant', label: 'Mac Assistant', icon: Bot, color: 'assistant-icon' },
  { id: 'settings', label: 'System Settings', icon: Settings, color: 'settings-icon' },
  { id: 'trash', label: 'Trash', icon: Trash2, color: 'settings-icon' },
]

export function Dock() {
  const [pointer, setPointer] = useState<number | null>(null)
  const { windows, activeApp, dockMagnification, openApp } = useSystemStore(useShallow((state) => ({ windows: state.windows, activeApp: state.activeApp, dockMagnification: state.dockMagnification, openApp: state.openApp })))
  return <nav className="dock-wrap" aria-label="Dock"><div className="dock" onPointerLeave={() => setPointer(null)}>{items.map(({ id, label, icon: Icon, color }, index) => {
    const distance = pointer === null ? 0 : Math.abs(pointer - index)
    const scale = !dockMagnification || pointer === null ? 1 : distance < 1 ? 1.33 : distance < 2 ? 1.15 : 1
    return <button key={id} data-dock-app={id} className={`dock-item ${windows[id].open ? 'is-running' : ''} ${activeApp === id ? 'is-focused' : ''}`} title={label} aria-label={`Open ${label}`} onPointerEnter={() => setPointer(index)} onClick={() => openApp(id)} style={{ transform: `translateY(${dockMagnification && pointer === index ? -7 : 0}px) scale(${scale})` }}><span className={`dock-icon ${color}`}><Icon size={26} strokeWidth={1.7} /></span><span className="dock-label">{label}</span><i className="dock-indicator" /></button>
  })}<span className="dock-separator" /></div></nav>
}