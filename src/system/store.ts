import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { appFrames, type AppId, type DesktopSpace, type FsEntry, type SystemNotification, type TrashItem, type WindowFrame, type WindowState } from './types'

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
  Object.entries(appFrames).map(([id, frame]) => [id, { open: false, minimized: false, minimizing: false, maximized: false, zIndex: 1, frame }]),
) as Record<AppId, WindowState>

interface SystemState {
  windows: Record<AppId, WindowState>
  activeApp: AppId | null
  spaces: DesktopSpace[]
  activeSpaceId: string
  windowSpaces: Partial<Record<AppId, string>>
  savedWindowFrames: Record<AppId, WindowFrame>
  missionControlOpen: boolean
  spotlightOpen: boolean
  notificationCenterOpen: boolean
  notifications: SystemNotification[]
  nextZ: number
  files: Record<string, FsEntry>
  trash: TrashItem[]
  darkMode: boolean
  wallpaper: string
  wifiEnabled: boolean
  bluetoothEnabled: boolean
  notificationsEnabled: boolean
  focusMode: boolean
  accentColor: string
  autoAppearance: boolean
  reduceMotion: boolean
  highContrast: boolean
  soundEffectsEnabled: boolean
  brightness: number
  volume: number
  showDesktopIcons: boolean
  dockMagnification: boolean
  assistantControlEnabled: boolean
  openApp: (id: AppId) => void
  closeApp: (id: AppId) => void
  minimizeApp: (id: AppId) => void
  finishMinimizeApp: (id: AppId) => void
  toggleMaximize: (id: AppId) => void
  focusApp: (id: AppId) => void
  updateFrame: (id: AppId, frame: WindowFrame) => void
  tileWindow: (id: AppId, side: 'left' | 'right') => void
  switchSpace: (id: string) => void
  addSpace: () => string
  removeSpace: (id: string) => void
  moveWindowToSpace: (app: AppId, spaceId: string) => void
  setMissionControlOpen: (open: boolean) => void
  setSpotlightOpen: (open: boolean) => void
  setNotificationCenterOpen: (open: boolean) => void
  addNotification: (title: string, message: string) => void
  dismissNotification: (id: string) => void
  clearNotifications: () => void
  toggleDarkMode: () => void
  setWallpaper: (wallpaper: string) => void
  updatePreferences: (preferences: Partial<Pick<SystemState, 'wifiEnabled' | 'bluetoothEnabled' | 'notificationsEnabled' | 'focusMode' | 'accentColor' | 'darkMode' | 'autoAppearance' | 'reduceMotion' | 'highContrast' | 'soundEffectsEnabled' | 'brightness' | 'volume' | 'showDesktopIcons' | 'dockMagnification' | 'assistantControlEnabled'>>) => void
  resetFilesystem: () => void
  createEntry: (path: string, type: FsEntry['type'], content?: string) => boolean
  writeFile: (path: string, content: string) => boolean
  deleteEntry: (path: string) => void
  renameEntry: (path: string, name: string) => boolean
  moveEntry: (path: string, destination: string) => boolean
  restoreTrashItem: (path: string) => boolean
  permanentlyDeleteTrashItem: (path: string) => void
  emptyTrash: () => void
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
  spaces: [{ id: 'space-1', name: 'Desktop 1' }, { id: 'space-2', name: 'Desktop 2' }],
  activeSpaceId: 'space-1',
  windowSpaces: {},
  savedWindowFrames: appFrames,
  missionControlOpen: false,
  spotlightOpen: false,
  notificationCenterOpen: false,
  notifications: [],
  nextZ: 2,
  files: initialFiles,
  trash: [],
  darkMode: true,
  wallpaper: 'sonoma',
  wifiEnabled: true,
  bluetoothEnabled: true,
  notificationsEnabled: true,
  focusMode: false,
  accentColor: '#4b9cf5',
  autoAppearance: false,
  reduceMotion: false,
  highContrast: false,
  soundEffectsEnabled: true,
  brightness: 100,
  volume: 58,
  showDesktopIcons: true,
  dockMagnification: true,
  assistantControlEnabled: true,
  openApp: (id) => set((state) => {
    const zIndex = state.nextZ
    const spaceId = state.windows[id].open ? state.windowSpaces[id] ?? state.activeSpaceId : state.activeSpaceId
    return { activeApp: id, activeSpaceId: spaceId, nextZ: zIndex + 1, windowSpaces: { ...state.windowSpaces, [id]: spaceId }, windows: { ...state.windows, [id]: { ...state.windows[id], open: true, minimized: false, minimizing: false, zIndex } } }
  }),
  closeApp: (id) => set((state) => ({
    activeApp: state.activeApp === id ? null : state.activeApp,
    windows: { ...state.windows, [id]: { ...state.windows[id], open: false, minimized: false } },
  })),
  minimizeApp: (id) => set((state) => ({
    activeApp: state.activeApp === id ? null : state.activeApp,
    windows: { ...state.windows, [id]: { ...state.windows[id], minimizing: true } },
  })),
  finishMinimizeApp: (id) => set((state) => ({ windows: { ...state.windows, [id]: { ...state.windows[id], minimizing: false, minimized: true } } })),
  toggleMaximize: (id) => set((state) => ({ windows: { ...state.windows, [id]: { ...state.windows[id], maximized: !state.windows[id].maximized } } })),
  focusApp: (id) => set((state) => {
    const zIndex = state.nextZ
    return { activeApp: id, nextZ: zIndex + 1, windows: { ...state.windows, [id]: { ...state.windows[id], zIndex } } }
  }),
  updateFrame: (id, frame) => set((state) => ({
    windows: { ...state.windows, [id]: { ...state.windows[id], frame } },
    savedWindowFrames: { ...state.savedWindowFrames, [id]: frame },
  })),
  tileWindow: (id, side) => set((state) => {
    const frame: WindowFrame = { x: side === 'left' ? 8 : Math.floor(window.innerWidth / 2), y: 36, width: Math.max(440, Math.floor(window.innerWidth / 2) - 12), height: Math.max(300, window.innerHeight - 120) }
    return { windows: { ...state.windows, [id]: { ...state.windows[id], maximized: false, frame } }, savedWindowFrames: { ...state.savedWindowFrames, [id]: frame } }
  }),
  switchSpace: (id) => set((state) => {
    if (!state.spaces.some((space) => space.id === id)) return state
    const activeApp = Object.entries(state.windows).filter(([app, windowState]) => windowState.open && !windowState.minimized && (state.windowSpaces[app as AppId] ?? state.spaces[0].id) === id).sort(([, first], [, second]) => second.zIndex - first.zIndex)[0]?.[0] as AppId | undefined
    return { activeSpaceId: id, activeApp: activeApp ?? null }
  }),
  addSpace: () => {
    const id = `space-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    set((state) => ({ spaces: [...state.spaces, { id, name: `Desktop ${state.spaces.length + 1}` }], activeSpaceId: id, activeApp: null }))
    return id
  },
  removeSpace: (id) => set((state) => {
    if (state.spaces.length <= 1) return state
    const spaces = state.spaces.filter((space) => space.id !== id)
    if (spaces.length === state.spaces.length) return state
    const target = state.activeSpaceId === id ? spaces[Math.max(0, state.spaces.findIndex((space) => space.id === id) - 1)] : undefined
    const destination = target?.id ?? spaces[0].id
    const windowSpaces = { ...state.windowSpaces }
    for (const [app, spaceId] of Object.entries(windowSpaces)) if (spaceId === id) windowSpaces[app as AppId] = destination
    return { spaces, windowSpaces, activeSpaceId: state.activeSpaceId === id ? destination : state.activeSpaceId }
  }),
  moveWindowToSpace: (app, spaceId) => set((state) => {
    if (!state.spaces.some((space) => space.id === spaceId)) return state
    const windowSpaces = { ...state.windowSpaces, [app]: spaceId }
    const activeApp = state.activeSpaceId === spaceId ? app : state.activeApp === app ? null : state.activeApp
    return { windowSpaces, activeApp }
  }),
  setMissionControlOpen: (open) => set({ missionControlOpen: open }),
  setSpotlightOpen: (open) => set({ spotlightOpen: open }),
  setNotificationCenterOpen: (open) => set({ notificationCenterOpen: open }),
  addNotification: (title, message) => set((state) => state.notificationsEnabled && !state.focusMode ? { notifications: [{ id: `${Date.now()}-${Math.random()}`, title, message, time: Date.now() }, ...state.notifications].slice(0, 30) } : state),
  dismissNotification: (id) => set((state) => ({ notifications: state.notifications.filter((notification) => notification.id !== id) })),
  clearNotifications: () => set({ notifications: [] }),
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
    const entries: Record<string, FsEntry> = {}
    for (const key of Object.keys(files)) if (key === normalized || key.startsWith(`${normalized}/`)) { entries[key] = files[key]; delete files[key] }
    if (!Object.keys(entries).length) return
    set((state) => ({ files, trash: [{ path: normalized, entries, deletedAt: Date.now() }, ...state.trash] }))
  },
  renameEntry: (path, name) => {
    const normalized = normalizePath(path)
    const cleanName = name.trim()
    if (!cleanName || cleanName.includes('/')) return false
    const target = normalizePath(`${normalized.slice(0, normalized.lastIndexOf('/'))}/${cleanName}`)
    const files = { ...get().files }
    if (!files[normalized] || files[target]) return false
    for (const key of Object.keys(files)) if (key === normalized || key.startsWith(`${normalized}/`)) {
      const next = `${target}${key.slice(normalized.length)}`
      files[next] = files[key]
      delete files[key]
    }
    set({ files })
    return true
  },
  moveEntry: (path, destination) => {
    const normalized = normalizePath(path)
    const targetFolder = normalizePath(destination)
    const files = { ...get().files }
    const name = normalized.slice(normalized.lastIndexOf('/') + 1)
    const target = normalizePath(`${targetFolder}/${name}`)
    if (!files[normalized] || files[target] || files[targetFolder]?.type !== 'folder' || target.startsWith(`${normalized}/`)) return false
    for (const key of Object.keys(files)) if (key === normalized || key.startsWith(`${normalized}/`)) {
      const next = `${target}${key.slice(normalized.length)}`
      files[next] = files[key]
      delete files[key]
    }
    set({ files })
    return true
  },
  restoreTrashItem: (path) => {
    const trash = [...get().trash]
    const index = trash.findIndex((item) => item.path === path)
    if (index < 0) return false
    const [item] = trash.splice(index, 1)
    const files = { ...get().files }
    if (Object.keys(item.entries).some((entry) => files[entry])) return false
    Object.assign(files, item.entries)
    set({ files, trash })
    return true
  },
  permanentlyDeleteTrashItem: (path) => set((state) => ({ trash: state.trash.filter((item) => item.path !== path) })),
  emptyTrash: () => set({ trash: [] }),
}), {
  name: 'mac-nos-system',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
    files: state.files,
    spaces: state.spaces,
    activeSpaceId: state.activeSpaceId,
    windowSpaces: state.windowSpaces,
      savedWindowFrames: state.savedWindowFrames,
    trash: state.trash,
    darkMode: state.darkMode,
    wallpaper: state.wallpaper,
    wifiEnabled: state.wifiEnabled,
    bluetoothEnabled: state.bluetoothEnabled,
    notificationsEnabled: state.notificationsEnabled,
    focusMode: state.focusMode,
    accentColor: state.accentColor,
    autoAppearance: state.autoAppearance,
    reduceMotion: state.reduceMotion,
    highContrast: state.highContrast,
    soundEffectsEnabled: state.soundEffectsEnabled,
    brightness: state.brightness,
    volume: state.volume,
    showDesktopIcons: state.showDesktopIcons,
    dockMagnification: state.dockMagnification,
    assistantControlEnabled: state.assistantControlEnabled,
  }),
  merge: (persisted, current) => {
    const saved = persisted as Partial<SystemState>
    const spaces = saved.spaces?.length ? saved.spaces : current.spaces
    const savedWindowFrames = { ...current.savedWindowFrames, ...saved.savedWindowFrames }
    const windows = { ...current.windows }
    for (const [app, frame] of Object.entries(savedWindowFrames) as [AppId, WindowFrame][]) windows[app] = { ...windows[app], frame }
    const activeSpaceId = spaces.some((space) => space.id === saved.activeSpaceId) ? saved.activeSpaceId! : spaces[0].id
    return { ...current, ...saved, spaces, activeSpaceId, windows, savedWindowFrames }
  },
}))

export { normalizePath }