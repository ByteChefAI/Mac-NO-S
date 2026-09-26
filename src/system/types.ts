export type AppId = 'finder' | 'safari' | 'textedit' | 'terminal' | 'settings' | 'assistant'
export type EntryType = 'folder' | 'file'

export interface FsEntry {
  type: EntryType
  content?: string
  modified: number
}

export interface WindowFrame {
  x: number
  y: number
  width: number
  height: number
}

export interface WindowState {
  open: boolean
  minimized: boolean
  maximized: boolean
  zIndex: number
  frame: WindowFrame
}

export const appNames: Record<AppId, string> = {
  finder: 'Finder',
  safari: 'Safari',
  textedit: 'TextEdit',
  terminal: 'Terminal',
  settings: 'System Settings',
  assistant: 'Mac Assistant',
}

export const appFrames: Record<AppId, WindowFrame> = {
  finder: { x: 120, y: 88, width: 870, height: 570 },
  safari: { x: 155, y: 74, width: 960, height: 625 },
  textedit: { x: 220, y: 120, width: 760, height: 560 },
  terminal: { x: 250, y: 115, width: 700, height: 460 },
  settings: { x: 170, y: 75, width: 810, height: 585 },
  assistant: { x: 260, y: 95, width: 700, height: 600 },
}