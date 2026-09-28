import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AssistantApp, FinderApp, SettingsApp, TerminalApp, TextEditApp, TrashApp } from '../apps/Apps'
import { SafariApp } from '../apps/SafariApp'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { VoiceControl } from './VoiceControl'
import { AssistantCursor } from './AssistantCursor'
import { Window } from './Window'
import { AssistantConfirmation, MissionControl, NotificationCenter, OSDialogs, Spotlight } from './SystemOverlays'
import { useSystemStore } from './store'
import type { AppId } from './types'

const appIds: AppId[] = ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant', 'trash']
const appComponents: Record<AppId, () => React.JSX.Element> = { finder: FinderApp, safari: SafariApp, textedit: TextEditApp, terminal: TerminalApp, settings: SettingsApp, assistant: AssistantApp, trash: TrashApp }

export function Desktop() {
  const { windows, darkMode, autoAppearance, reduceMotion, highContrast, wallpaper, accentColor, brightness, showDesktopIcons, openApp, updatePreferences } = useSystemStore(useShallow((state) => ({ windows: state.windows, darkMode: state.darkMode, autoAppearance: state.autoAppearance, reduceMotion: state.reduceMotion, highContrast: state.highContrast, wallpaper: state.wallpaper, accentColor: state.accentColor, brightness: state.brightness, showDesktopIcons: state.showDesktopIcons, openApp: state.openApp, updatePreferences: state.updatePreferences })))
  useEffect(() => {
    if (!Object.values(windows).some((window) => window.open)) openApp('finder')
  }, [])
  useEffect(() => {
    if (!autoAppearance) return
    const preference = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => updatePreferences({ darkMode: preference.matches })
    update()
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [autoAppearance, updatePreferences])
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const store = useSystemStore.getState()
      if (event.key === 'Escape') {
        if (store.spotlightOpen || store.missionControlOpen || store.notificationCenterOpen) {
          store.setSpotlightOpen(false); store.setMissionControlOpen(false); store.setNotificationCenterOpen(false); event.preventDefault()
        }
        return
      }
      if (event.metaKey && event.code === 'Space') { event.preventDefault(); store.setSpotlightOpen(true); return }
      if ((event.key === 'F3' || (event.ctrlKey && event.key === 'ArrowUp')) && !event.metaKey) { event.preventDefault(); store.setMissionControlOpen(!store.missionControlOpen); return }
      if (event.ctrlKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault()
        const index = store.spaces.findIndex((space) => space.id === store.activeSpaceId)
        const next = event.key === 'ArrowRight' ? Math.min(index + 1, store.spaces.length - 1) : Math.max(index - 1, 0)
        store.switchSpace(store.spaces[next].id)
        return
      }
      if (event.metaKey && event.key.toLowerCase() === 'w') { if (store.activeApp) { event.preventDefault(); store.closeApp(store.activeApp) }; return }
      if (event.metaKey && event.key.toLowerCase() === 'q') { if (store.activeApp) { event.preventDefault(); store.closeApp(store.activeApp) }; return }
      if (event.metaKey && event.key === 'Tab') {
        event.preventDefault()
        const openApps = Object.entries(store.windows).filter(([app, state]) => state.open && !state.minimized && (store.windowSpaces[app as AppId] ?? store.spaces[0].id) === store.activeSpaceId).sort(([, first], [, second]) => first.zIndex - second.zIndex).map(([app]) => app as AppId)
        if (openApps.length) {
          const current = openApps.indexOf(store.activeApp ?? openApps.at(-1)!)
          store.openApp(openApps[(current + 1) % openApps.length])
        }
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  return (
    <main className={`desktop ${darkMode ? 'theme-dark' : 'theme-light'} wallpaper-${wallpaper} ${reduceMotion ? 'reduce-motion' : ''} ${highContrast ? 'high-contrast' : ''}`} style={{ '--accent-color': accentColor } as React.CSSProperties}>
      <div className="wallpaper-image" style={{ filter: `brightness(${brightness}%)` }} />
      <MenuBar />
      {showDesktopIcons && <div className="desktop-icons" aria-label="Desktop">
        <button onDoubleClick={() => openApp('finder')} onClick={() => openApp('finder')}><span className="desktop-drive">Mac HD</span><span>Macintosh HD</span></button>
        <button onDoubleClick={() => openApp('finder')} onClick={() => openApp('finder')}><span className="desktop-folder">📁</span><span>Projects</span></button>
      </div>}
      {appIds.map((id) => {
        const App = appComponents[id]
        return <Window key={id} id={id}><App /></Window>
      })}
      <Dock />
      <VoiceControl />
      <AssistantCursor />
      <MissionControl />
      <Spotlight />
      <NotificationCenter />
      <AssistantConfirmation />
      <OSDialogs />
    </main>
  )
}