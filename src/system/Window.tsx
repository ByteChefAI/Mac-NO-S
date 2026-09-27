import { useRef, type PointerEvent, type ReactNode } from 'react'
import { Maximize2, Minus, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useSystemStore } from './store'
import { appNames, type AppId, type WindowFrame } from './types'

interface Props { id: AppId; children: ReactNode }

export function Window({ id, children }: Props) {
  const { windowState, active, focusApp, closeApp, minimizeApp, toggleMaximize, updateFrame } = useSystemStore(useShallow((state) => ({
    windowState: state.windows[id], active: state.activeApp === id, focusApp: state.focusApp, closeApp: state.closeApp,
    minimizeApp: state.minimizeApp, toggleMaximize: state.toggleMaximize, updateFrame: state.updateFrame,
  })))
  const drag = useRef<{ x: number; y: number; frame: WindowFrame } | null>(null)
  const resize = useRef<{ x: number; y: number; frame: WindowFrame; edge: string } | null>(null)

  if (!windowState.open || windowState.minimized) return null

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || windowState.maximized || (event.target as HTMLElement).closest('button')) return
    focusApp(id)
    drag.current = { x: event.clientX, y: event.clientY, frame: windowState.frame }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      updateFrame(id, { ...drag.current.frame, x: Math.max(0, drag.current.frame.x + event.clientX - drag.current.x), y: Math.max(28, drag.current.frame.y + event.clientY - drag.current.y) })
    } else if (resize.current) {
      const { frame, x, y, edge } = resize.current
      const dx = event.clientX - x
      const dy = event.clientY - y
      const left = edge.includes('w')
      const top = edge.includes('n')
      updateFrame(id, {
        x: left ? frame.x + dx : frame.x,
        y: top ? frame.y + dy : frame.y,
        width: Math.max(440, frame.width + (edge.includes('e') ? dx : left ? -dx : 0)),
        height: Math.max(300, frame.height + (edge.includes('s') ? dy : top ? -dy : 0)),
      })
    }
  }

  const startResize = (event: PointerEvent<HTMLDivElement>, edge: string) => {
    event.preventDefault()
    event.stopPropagation()
    focusApp(id)
    resize.current = { x: event.clientX, y: event.clientY, frame: windowState.frame, edge }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  return (
    <section data-window-app={id} className={`os-window ${active ? 'is-active' : ''} ${windowState.maximized ? 'is-maximized' : ''}`} style={{ ...(windowState.maximized ? {} : { left: windowState.frame.x, top: windowState.frame.y, width: windowState.frame.width, height: windowState.frame.height }), zIndex: windowState.zIndex }} onPointerDown={() => focusApp(id)}>
      <div className="window-titlebar" onPointerDown={startDrag} onPointerMove={move} onPointerUp={() => { drag.current = null; resize.current = null }} onDoubleClick={() => toggleMaximize(id)}>
        <div className="traffic-lights">
          <button className="traffic close" title="Close" aria-label={`Close ${appNames[id]}`} onClick={() => closeApp(id)}><X size={9} /></button>
          <button className="traffic minimize" title="Minimize" aria-label="Minimize" onClick={() => minimizeApp(id)}><Minus size={9} /></button>
          <button className="traffic maximize" title="Zoom" aria-label="Toggle full screen" onClick={() => toggleMaximize(id)}><Maximize2 size={8} /></button>
        </div>
        <span className="window-title">{appNames[id]}</span>
        <span className="titlebar-spacer" />
      </div>
      <div className="window-content">{children}</div>
      {!windowState.maximized && ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => <div key={edge} className={`resize-handle resize-${edge}`} onPointerDown={(event) => startResize(event, edge)} onPointerMove={move} onPointerUp={() => { resize.current = null }} />)}
    </section>
  )
}