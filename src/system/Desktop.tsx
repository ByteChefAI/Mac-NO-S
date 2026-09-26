import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AssistantApp, FinderApp, SafariApp, SettingsApp, TerminalApp, TextEditApp } from '../apps/Apps'
import { Dock } from './Dock'
import { MenuBar } from './MenuBar'
import { Window } from './Window'
import { useSystemStore } from './store'
import type { AppId } from './types'

const appIds: AppId[] = ['finder', 'safari', 'textedit', 'terminal', 'settings', 'assistant']
const appComponents = { finder: FinderApp, safari: SafariApp, textedit: TextEditApp, terminal: TerminalApp, settings: SettingsApp, assistant: AssistantApp }

export function Desktop() {
  const { windows, darkMode, wallpaper, accentColor, brightness, showDesktopIcons, openApp } = useSystemStore(useShallow((state) => ({ windows: state.windows, darkMode: state.darkMode, wallpaper: state.wallpaper, accentColor: state.accentColor, brightness: state.brightness, showDesktopIcons: state.showDesktopIcons, openApp: state.openApp })))
  useEffect(() => {
    if (!Object.values(windows).some((window) => window.open)) openApp('finder')
  }, [])

  return (
    <main className={`desktop ${darkMode ? 'theme-dark' : 'theme-light'} wallpaper-${wallpaper}`} style={{ '--accent-color': accentColor } as React.CSSProperties}>
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
    </main>
  )
}