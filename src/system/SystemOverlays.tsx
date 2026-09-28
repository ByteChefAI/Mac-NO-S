import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CloudSun } from 'lucide-react'
import { appNames, type AppId, type FsEntry } from './types'
import { useSystemStore } from './store'
import type { OSDialogRequest } from './dialogs'

const apps: AppId[] = ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant', 'trash']

export function OSDialogs() {
  const [dialog, setDialog] = useState<OSDialogRequest | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const queueRef = useRef<OSDialogRequest[]>([])
  const activeRef = useRef<OSDialogRequest | null>(null)
  useEffect(() => {
    const open = (event: Event) => {
      const request = (event as CustomEvent<OSDialogRequest>).detail
      if (activeRef.current) { queueRef.current.push(request); return }
      activeRef.current = request
      setValue(request.initialValue ?? '')
      setDialog(request)
    }
    window.addEventListener('mac-os-dialog', open)
    return () => window.removeEventListener('mac-os-dialog', open)
  }, [])
  useEffect(() => { if (dialog?.kind === 'prompt') inputRef.current?.focus() }, [dialog])
  if (!dialog) return null
  const finish = (result: boolean | string | null) => {
    const next = queueRef.current.shift() ?? null
    activeRef.current = next
    setValue(next?.initialValue ?? '')
    setDialog(next)
    window.dispatchEvent(new CustomEvent('mac-os-dialog-result', { detail: { id: dialog.id, value: result } }))
  }
  const confirmLabel = dialog.actionLabel ?? (dialog.kind === 'confirm' ? 'Continue' : 'OK')
  return <div className="os-dialog-backdrop" role="presentation"><section className="os-dialog" role={dialog.kind === 'alert' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby="os-dialog-title"><div className="os-dialog-icon">{dialog.kind === 'confirm' ? '!' : '⌘'}</div><div className="os-dialog-copy"><h2 id="os-dialog-title">{dialog.title}</h2><p>{dialog.message}</p>{dialog.kind === 'prompt' && <input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') finish(value); if (event.key === 'Escape') finish(null) }} />}</div><footer>{dialog.kind !== 'alert' && <button className="os-dialog-cancel" onClick={() => finish(dialog.kind === 'confirm' ? false : null)}>Cancel</button>}<button className="os-dialog-confirm" onClick={() => finish(dialog.kind === 'alert' ? true : dialog.kind === 'confirm' ? true : value)}>{confirmLabel}</button></footer></section></div>
}

type ConfirmationRequest = { id: string; title: string; message: string }

export function AssistantConfirmation() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null)
  useEffect(() => {
    const handleRequest = (event: Event) => setRequest((event as CustomEvent<ConfirmationRequest>).detail)
    window.addEventListener('mac-assistant-confirm', handleRequest)
    return () => window.removeEventListener('mac-assistant-confirm', handleRequest)
  }, [])
  if (!request) return null
  const answer = (approved: boolean) => {
    window.dispatchEvent(new CustomEvent('mac-assistant-confirmed', { detail: { id: request.id, approved } }))
    setRequest(null)
  }
  return <div className="assistant-confirm-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="assistant-confirm-title"><section className="assistant-confirm"><span className="assistant-confirm-symbol">!</span><div><h2 id="assistant-confirm-title">{request.title}</h2><p>{request.message}</p></div><footer><button onClick={() => answer(false)}>Cancel</button><button className="confirm-destructive" onClick={() => answer(true)}>Move to Trash</button></footer></section></div>
}

export function MissionControl() {
  const { spaces, activeSpaceId, windows, windowSpaces, missionControlOpen, switchSpace, addSpace, removeSpace, moveWindowToSpace, focusApp, closeApp, setMissionControlOpen } = useSystemStore(useShallow((state) => ({
    spaces: state.spaces, activeSpaceId: state.activeSpaceId, windows: state.windows, windowSpaces: state.windowSpaces,
    missionControlOpen: state.missionControlOpen, switchSpace: state.switchSpace, addSpace: state.addSpace,
    removeSpace: state.removeSpace, moveWindowToSpace: state.moveWindowToSpace, focusApp: state.focusApp,
    closeApp: state.closeApp, setMissionControlOpen: state.setMissionControlOpen,
  })))
  if (!missionControlOpen) return null

  return <div className="mission-control" role="dialog" aria-label="Mission Control" onMouseDown={(event) => { if (event.target === event.currentTarget) setMissionControlOpen(false) }}>
    <header className="mission-header"><h2>Mission Control</h2><button onClick={() => setMissionControlOpen(false)}>Done</button></header>
    <div className="spaces-strip">{spaces.map((space) => <section key={space.id} className={`space-preview ${activeSpaceId === space.id ? 'active' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const app = event.dataTransfer.getData('application/x-mac-nos-app') as AppId; if (app) moveWindowToSpace(app, space.id) }}>
      <div className="space-preview-header"><button className="space-label" onClick={() => { switchSpace(space.id); setMissionControlOpen(false) }}>{space.name}</button>{spaces.length > 1 && <button className="space-remove" aria-label={`Remove ${space.name}`} onClick={() => removeSpace(space.id)}>×</button>}</div>
      <div className="space-windows">{apps.filter((app) => windows[app].open && !windows[app].minimized && (windowSpaces[app] ?? spaces[0].id) === space.id).map((app) => <article key={app} className="mission-window-card" draggable onDragStart={(event) => event.dataTransfer.setData('application/x-mac-nos-app', app)}><button className="mission-window-open" onClick={() => { switchSpace(space.id); focusApp(app); setMissionControlOpen(false) }}><span className="mission-window-preview"><b>{appNames[app]}</b><small>{app === 'finder' ? 'Browse your files' : appNames[app]}</small></span><strong>{appNames[app]}</strong></button><button className="mission-close" aria-label={`Close ${appNames[app]}`} onClick={() => closeApp(app)}>×</button></article>)}</div>
    </section>)}<button className="space-add" onClick={addSpace}><span>+</span><small>Add Desktop</small></button></div>
    <p className="mission-hint">Drag a window to another desktop to move it.</p>
  </div>
}

export function Spotlight() {
  const { open, setOpen, files, openApp } = useSystemStore(useShallow((state) => ({ open: state.spotlightOpen, setOpen: state.setSpotlightOpen, files: state.files, openApp: state.openApp })))
  const [query, setQuery] = useState('')
  const matches = useMemo(() => {
    const needle = query.toLowerCase().trim()
    const appMatches = apps.filter((app) => !needle || appNames[app].toLowerCase().includes(needle)).map((app) => ({ label: appNames[app], path: '', app, type: 'app' as const }))
    const fileMatches = Object.entries(files).filter(([path]) => path !== '/' && (!needle || path.toLowerCase().includes(needle))).slice(0, 8).map(([path, entry]) => ({ label: path.slice(path.lastIndexOf('/') + 1), path, entry, type: 'file' as const }))
    return [...appMatches, ...fileMatches].slice(0, 12)
  }, [files, query])
  useEffect(() => { if (!open) setQuery('') }, [open])
  if (!open) return null
  const launch = (item: (typeof matches)[number]) => {
    setOpen(false)
    if (item.type === 'app') { openApp(item.app); return }
    if ('entry' in item && item.entry.type === 'folder') {
      openApp('finder')
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('finder-open-path', { detail: item.path })), 80)
    } else {
      openApp('textedit')
      window.setTimeout(() => window.dispatchEvent(new CustomEvent('open-text-file', { detail: item.path })), 80)
    }
  }
  return <div className="spotlight-backdrop" role="dialog" aria-label="Spotlight search" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="spotlight-panel"><input autoFocus aria-label="Search this Mac" placeholder="Search this Mac" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); if (event.key === 'Enter' && matches[0]) launch(matches[0]); if (event.key === 'ArrowDown') (document.querySelector('.spotlight-results button') as HTMLButtonElement | null)?.focus() }} /><div className="spotlight-results">{matches.map((item) => <button key={`${item.type}:${item.path || item.label}`} onClick={() => launch(item)}><span className={`spotlight-symbol ${item.type}`}>{item.type === 'app' ? '◈' : '▤'}</span><span><strong>{item.label}</strong><small>{item.type === 'app' ? 'Application' : item.path}</small></span><kbd>↵</kbd></button>)}{!matches.length && <p>No results</p>}</div></section></div>
}

function CalendarWidget() {
  const [date, setDate] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setDate(new Date()), 30000); return () => window.clearInterval(timer) }, [])
  const start = new Date(date.getFullYear(), date.getMonth(), 1).getDay()
  const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return <section className="calendar-widget"><header><span>{date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><strong>{date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong></header><div className="calendar-grid">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <span className="weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: start }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => <span className={index + 1 === date.getDate() ? 'today' : ''} key={index}>{index + 1}</span>)}</div></section>
}

function WeatherWidget() {
  const [weather, setWeather] = useState<{ temperature: number; description: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const loadWeather = () => {
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); return }
    setLoading(true); setError('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const query = new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), current: 'temperature_2m,weather_code', forecast_days: '1' })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`)
        if (!response.ok) throw new Error('Weather is temporarily unavailable.')
        const data = await response.json()
        const code = Number(data.current?.weather_code ?? -1)
        const description = code === 0 ? 'Clear' : code < 4 ? 'Partly cloudy' : code < 50 ? 'Foggy' : code < 70 ? 'Rain' : code < 80 ? 'Snow' : 'Showers'
        setWeather({ temperature: Math.round(Number(data.current?.temperature_2m)), description })
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Weather is unavailable.') }
      finally { setLoading(false) }
    }, () => { setLoading(false); setError('Allow location access to see local weather.') }, { timeout: 12000, maximumAge: 300000 })
  }
  return <section className="weather-widget"><div><CloudSun size={18} /><strong>{weather ? `${weather.temperature}°` : 'Weather'}</strong></div><span>{weather?.description ?? (error || 'Local forecast')}</span><button disabled={loading} onClick={loadWeather}>{loading ? 'Loading…' : weather ? 'Refresh' : 'Use location'}</button></section>
}

export function NotificationCenter() {
  const { open, setOpen, notifications, dismissNotification, clearNotifications, focusMode } = useSystemStore(useShallow((state) => ({ open: state.notificationCenterOpen, setOpen: state.setNotificationCenterOpen, notifications: state.notifications, dismissNotification: state.dismissNotification, clearNotifications: state.clearNotifications, focusMode: state.focusMode })))
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer) }, [])
  if (!open) return null
  return <div className="notification-backdrop" role="dialog" aria-label="Notification Center" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><aside className="notification-center"><header><div><strong>{now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</strong><span>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span></div><button onClick={() => setOpen(false)}>Done</button></header><CalendarWidget /><WeatherWidget /><section className="notification-section"><div className="notification-heading"><strong>Notifications & Activity</strong>{notifications.length > 0 && <button onClick={clearNotifications}>Clear</button>}</div>{focusMode && <p className="notification-empty">Focus is on</p>}{notifications.length ? notifications.map((notification) => <article className="notification-card" key={notification.id}><button aria-label="Dismiss notification" onClick={() => dismissNotification(notification.id)}>×</button><strong>{notification.title}</strong><p>{notification.message}</p><small>{new Date(notification.time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></article>) : !focusMode && <p className="notification-empty">No notifications</p>}</section></aside></div>
}
