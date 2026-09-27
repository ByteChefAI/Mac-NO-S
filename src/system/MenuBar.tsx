import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Apple, BatteryFull, Bluetooth, ChevronDown, Command, Mic, MonitorUp, Moon, Search, SlidersHorizontal, Wifi } from 'lucide-react'
import { useSystemStore } from './store'
import { appNames, type AppId } from './types'

export function MenuBar() {
  const { activeApp, darkMode, toggleDarkMode, wifiEnabled, bluetoothEnabled, focusMode, brightness, volume, updatePreferences } = useSystemStore(useShallow((state) => ({ activeApp: state.activeApp, darkMode: state.darkMode, toggleDarkMode: state.toggleDarkMode, wifiEnabled: state.wifiEnabled, bluetoothEnabled: state.bluetoothEnabled, focusMode: state.focusMode, brightness: state.brightness, volume: state.volume, updatePreferences: state.updatePreferences })))
  const [now, setNow] = useState(new Date())
  const [controlOpen, setControlOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pttRecording, setPttRecording] = useState(false)
  const screenCapturePending = useRef(false)
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 15000); return () => window.clearInterval(timer) }, [])
  useEffect(() => {
    const handlePttState = (event: Event) => setPttRecording((event as CustomEvent<boolean>).detail)
    window.addEventListener('mac-ptt-state', handlePttState)
    return () => window.removeEventListener('mac-ptt-state', handlePttState)
  }, [])
  const activeName = activeApp ? appNames[activeApp] : 'Finder'
  const analyzeScreen = () => {
    if (screenCapturePending.current) return
    if (!navigator.mediaDevices?.getDisplayMedia) {
      window.dispatchEvent(new CustomEvent('mac-assistant-screen-error', { detail: 'Screen sharing is not supported in this browser.' }))
      useSystemStore.getState().openApp('assistant')
      return
    }
    try {
      screenCapturePending.current = true
      const capture = navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      useSystemStore.getState().openApp('assistant')
      void capture.then((stream) => {
        screenCapturePending.current = false
        window.dispatchEvent(new CustomEvent('mac-assistant-analyze-screen', { detail: stream }))
      }).catch((error: unknown) => {
        screenCapturePending.current = false
        const message = error instanceof Error && error.name === 'NotAllowedError' ? 'Screen sharing was canceled.' : 'The selected screen could not be shared.'
        window.dispatchEvent(new CustomEvent('mac-assistant-screen-error', { detail: message }))
      })
    } catch {
      screenCapturePending.current = false
      window.dispatchEvent(new CustomEvent('mac-assistant-screen-error', { detail: 'The screen share picker could not be opened.' }))
      useSystemStore.getState().openApp('assistant')
    }
  }

  return (
    <header className="menubar">
      <div className="menu-left">
        <button className="apple-menu" aria-label="Apple menu" onClick={() => setMenuOpen(!menuOpen)}><Apple size={17} fill="currentColor" /></button>
        <button className="app-menu-name" onClick={() => setMenuOpen(!menuOpen)}>{activeName}</button>
        <button className="menubar-link" onClick={() => setMenuOpen(!menuOpen)}>File</button>
        <button className="menubar-link" onClick={() => setMenuOpen(!menuOpen)}>Edit</button>
        <button className="menubar-link" onClick={() => setMenuOpen(!menuOpen)}>View</button>
        <button className="menubar-link" onClick={() => setMenuOpen(!menuOpen)}>Window</button>
        {menuOpen && <div className="menu-popover app-popover"><button onClick={() => { useSystemStore.getState().openApp('settings'); setMenuOpen(false) }}>About This Mac</button><button onClick={() => { toggleDarkMode(); setMenuOpen(false) }}>{darkMode ? 'Light Appearance' : 'Dark Appearance'}</button><div className="popover-divider" /><button onClick={() => { useSystemStore.getState().openApp('settings'); setMenuOpen(false) }}>System Settings…</button></div>}
      </div>
      <div className="menu-right">
        <button title={`Wi-Fi ${wifiEnabled ? 'on' : 'off'}`} onClick={() => updatePreferences({ wifiEnabled: !wifiEnabled })}><Wifi size={15} /></button><button title={`Bluetooth ${bluetoothEnabled ? 'on' : 'off'}`} onClick={() => updatePreferences({ bluetoothEnabled: !bluetoothEnabled })}><Bluetooth size={14} /></button><button title="Battery"><BatteryFull size={17} /></button>
        <button title="Analyze screen with Mac Assistant" aria-label="Analyze screen" onClick={analyzeScreen}><MonitorUp size={15} /></button>
        <button title="Spotlight" onClick={() => useSystemStore.getState().openApp('assistant')}><Search size={15} /></button>
        <button className={`menubar-ptt ${pttRecording ? 'recording' : ''}`} title={pttRecording ? 'Release to send your recording' : 'Touch and hold to record a command'} aria-label={pttRecording ? 'Recording; release to send' : 'Hold to record a voice command'} aria-pressed={pttRecording} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); window.dispatchEvent(new Event('mac-ptt-start')) }} onPointerUp={() => window.dispatchEvent(new Event('mac-ptt-end'))} onPointerCancel={() => window.dispatchEvent(new Event('mac-ptt-end'))} onKeyDown={(event) => { if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) { event.preventDefault(); window.dispatchEvent(new Event('mac-ptt-start')) } }} onKeyUp={(event) => { if (event.code === 'Space' || event.code === 'Enter') window.dispatchEvent(new Event('mac-ptt-end')) }} onContextMenu={(event) => event.preventDefault()}><Mic size={15} /></button>
        <button className="control-trigger" title="Control Center" onClick={() => setControlOpen(!controlOpen)}><SlidersHorizontal size={15} /><ChevronDown size={10} /></button>
        <button className="menubar-clock" onClick={() => setControlOpen(!controlOpen)}>{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</button>
      </div>
      {controlOpen && <div className="menu-popover control-popover"><div className="control-grid"><button className={`control-tile ${wifiEnabled ? 'selected' : ''}`} onClick={() => updatePreferences({ wifiEnabled: !wifiEnabled })}><Wifi size={16} /><span>Wi-Fi</span><small>{wifiEnabled ? 'Connected' : 'Off'}</small></button><button className={`control-tile ${bluetoothEnabled ? 'selected' : ''}`} onClick={() => updatePreferences({ bluetoothEnabled: !bluetoothEnabled })}><Bluetooth size={16} /><span>Bluetooth</span><small>{bluetoothEnabled ? 'On' : 'Off'}</small></button><button className="control-tile" onClick={toggleDarkMode}><Moon size={16} /><span>Appearance</span><small>{darkMode ? 'Dark' : 'Light'}</small></button><button className={`control-tile ${focusMode ? 'selected' : ''}`} onClick={() => updatePreferences({ focusMode: !focusMode })}><Command size={16} /><span>Focus</span><small>{focusMode ? 'On' : 'Off'}</small></button></div><div className="control-slider"><span>Display</span><input aria-label="Display brightness" type="range" min="35" max="100" value={brightness} onChange={(event) => updatePreferences({ brightness: Number(event.target.value) })} /></div><div className="control-slider"><span>Sound</span><input aria-label="Sound volume" type="range" min="0" max="100" value={volume} onChange={(event) => updatePreferences({ volume: Number(event.target.value) })} /></div><button className="settings-link" onClick={() => { useSystemStore.getState().openApp('settings'); setControlOpen(false) }}>Open System Settings</button></div>}
    </header>
  )
}