import { useEffect, useState } from 'react'
import { MousePointer2 } from 'lucide-react'

type CursorState = { x: number; y: number; clicking: boolean; visible: boolean }

export function AssistantCursor() {
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, clicking: false, visible: false })

  useEffect(() => {
    const move = (event: Event) => setCursor((event as CustomEvent<CursorState>).detail)
    window.addEventListener('mac-assistant-cursor', move)
    return () => window.removeEventListener('mac-assistant-cursor', move)
  }, [])

  if (!cursor.visible) return null
  return <div className={`assistant-cursor ${cursor.clicking ? 'clicking' : ''}`} style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }} aria-hidden="true"><MousePointer2 size={28} fill="#f7fbff" strokeWidth={1.8} /><span>Mac Assistant</span></div>
}
