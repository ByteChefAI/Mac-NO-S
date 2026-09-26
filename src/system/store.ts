import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { appFrames, type AppId, type FsEntry, type WindowFrame, type WindowState } from './types'

const initialFiles: Record<string, FsEntry> = {
  '/': { type: 'folder', modified: Date.now() },
  '/Desktop': { type: 'folder', modified: Date.now() },
  '/Documents': { type: 'folder', modified: Date.now() },
  '/Downloads': { type: 'folder', modified: Date.now() },
  '/Pictures': { type: 'folder', modified: Date.now() },
  '/Documents/Welcome.txt': { type: 'file', content: 'Welcome to Mac-NO-S.\n\nYour files live in this browser and stay on this device.', modified: Date.now() },
  '/Desktop/Notes.md': { type: 'file', content: '# A fresh start\n\nMake yourself at home.', modified: Date.now() },
}

const createWindows = (): Record<AppId, WindowState> => Object.fromEntries(
  Object.entries(appFrames).map(([id, frame]) => [id, { open: false, minimized: false, maximized: false, zIndex: 1, frame }]),
) as Record<AppId, WindowState>

interface SystemState {
  windows: Record<AppId, WindowState>
  activeApp: AppId | null
  nextZ: number
  files: Record<string, FsEntry>
  darkMode: boolean
  wallpaper: string
  wifiEnabled: boolean
  bluetoothEnabled: boolean
  notificationsEnabled: boolean
  focusMode: boolean
  accentColor: string
  brightness: number
  volume: number
  showDesktopIcons: boolean
  dockMagnification: boolean
  assistantControlEnabled: boolean
  openApp: (id: AppId) => void
  closeApp: (id: AppId) => void
  minimizeApp: (id: AppId) => void
  toggleMaximize: (id: AppId) => void
  focusApp: (id: AppId) => void
  updateFrame: (id: AppId, frame: WindowFrame) => void
  toggleDarkMode: () => void
  setWallpaper: (wallpaper: string) => void
  updatePreferences: (preferences: Partial<Pick<SystemState, 'wifiEnabled' | 'bluetoothEnabled' | 'notificationsEnabled' | 'focusMode' | 'accentColor' | 'brightness' | 'volume' | 'showDesktopIcons' | 'dockMagnification' | 'assistantControlEnabled'>>) => void
  resetFilesystem: () => void
  createEntry: (path: string, type: FsEntry['type'], content?: string) => boolean
  writeFile: (path: string, content: string) => boolean
  deleteEntry: (path: string) => void
}

const normalizePath = (path: string) => {
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

export const useSystemStore = create<SystemState>()(persist((set, get) => ({
  windows: createWindows(),
  activeApp: null,
  nextZ: 2,
  files: initialFiles,
  darkMode: true,
  wallpaper: 'sonoma',
  wifiEnabled: true,
  bluetoothEnabled: true,
  notificationsEnabled: true,
  focusMode: false,
  accentColor: '#4b9cf5',
  brightness: 100,
  volume: 58,
  showDesktopIcons: true,
  dockMagnification: true,
  assistantControlEnabled: true,
  openApp: (id) => set((state) => {
    const zIndex = state.nextZ
    return { activeApp: id, nextZ: zIndex + 1, windows: { ...state.windows, [id]: { ...state.windows[id], open: true, minimized: false, zIndex } } }
  }),
  closeApp: (id) => set((state) => ({
    activeApp: state.activeApp === id ? null : state.activeApp,
    windows: { ...state.windows, [id]: { ...state.windows[id], open: false, minimized: false } },
  })),
  minimizeApp: (id) => set((state) => ({
    activeApp: state.activeApp === id ? null : state.activeApp,
    windows: { ...state.windows, [id]: { ...state.windows[id], minimized: true } },
  })),
  toggleMaximize: (id) => set((state) => ({ windows: { ...state.windows, [id]: { ...state.windows[id], maximized: !state.windows[id].maximized } } })),
  focusApp: (id) => set((state) => {
    const zIndex = state.nextZ
    return { activeApp: id, nextZ: zIndex + 1, windows: { ...state.windows, [id]: { ...state.windows[id], zIndex } } }
  }),
  updateFrame: (id, frame) => set((state) => ({ windows: { ...state.windows, [id]: { ...state.windows[id], frame } } })),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setWallpaper: (wallpaper) => set({ wallpaper }),
  updatePreferences: (preferences) => set(preferences),
  resetFilesystem: () => set({ files: initialFiles }),
  createEntry: (path, type, content = '') => {
    const normalized = normalizePath(path)
    const parent = normalizePath(normalized.slice(0, normalized.lastIndexOf('/')) || '/')
    const current = get().files
    if (current[normalized] || current[parent]?.type !== 'folder') return false
    set({ files: { ...current, [normalized]: { type, content, modified: Date.now() } } })
    return true
  },
  writeFile: (path, content) => {
    const normalized = normalizePath(path)
    const current = get().files
    if (current[normalized] && current[normalized].type !== 'file') return false
    const parent = normalizePath(normalized.slice(0, normalized.lastIndexOf('/')) || '/')
    if (!current[parent]) return false
    set({ files: { ...current, [normalized]: { type: 'file', content, modified: Date.now() } } })
    return true
  },
  deleteEntry: (path) => {
    const normalized = normalizePath(path)
    if (normalized === '/') return
    const files = { ...get().files }
    for (const key of Object.keys(files)) if (key === normalized || key.startsWith(`${normalized}/`)) delete files[key]
    set({ files })
  },
}), {
  name: 'mac-nos-system',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    files: state.files,
    darkMode: state.darkMode,
    wallpaper: state.wallpaper,
    wifiEnabled: state.wifiEnabled,
    bluetoothEnabled: state.bluetoothEnabled,
    notificationsEnabled: state.notificationsEnabled,
    focusMode: state.focusMode,
    accentColor: state.accentColor,
    brightness: state.brightness,
    volume: state.volume,
    showDesktopIcons: state.showDesktopIcons,
    dockMagnification: state.dockMagnification,
    assistantControlEnabled: state.assistantControlEnabled,
  }),
}))

export { normalizePath }