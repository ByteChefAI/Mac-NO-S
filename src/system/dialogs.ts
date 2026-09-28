export type OSDialogRequest = {
  id: string
  title: string
  message: string
  kind: 'alert' | 'confirm' | 'prompt'
  actionLabel?: string
  initialValue?: string
}

export function showOSAlert(title: string, message: string) {
  return new Promise<void>((resolve) => {
    const id = `${Date.now()}-${Math.random()}`
    const finish = (event: Event) => {
      if ((event as CustomEvent<{ id: string }>).detail?.id !== id) return
      window.removeEventListener('mac-os-dialog-result', finish)
      resolve()
    }
    window.addEventListener('mac-os-dialog-result', finish)
    window.dispatchEvent(new CustomEvent<OSDialogRequest>('mac-os-dialog', { detail: { id, title, message, kind: 'alert' } }))
  })
}

export function showOSConfirm(title: string, message: string, confirmLabel = 'Continue') {
  return new Promise<boolean>((resolve) => {
    const id = `${Date.now()}-${Math.random()}`
    const finish = (event: Event) => {
      const result = (event as CustomEvent<{ id: string; value: boolean }>).detail
      if (result?.id !== id) return
      window.removeEventListener('mac-os-dialog-result', finish)
      resolve(result.value)
    }
    window.addEventListener('mac-os-dialog-result', finish)
    window.dispatchEvent(new CustomEvent<OSDialogRequest>('mac-os-dialog', { detail: { id, title, message, kind: 'confirm', actionLabel: confirmLabel } }))
  })
}

export function showOSPrompt(title: string, message: string, initialValue = '') {
  return new Promise<string | null>((resolve) => {
    const id = `${Date.now()}-${Math.random()}`
    const finish = (event: Event) => {
      const result = (event as CustomEvent<{ id: string; value: string | null }>).detail
      if (result?.id !== id) return
      window.removeEventListener('mac-os-dialog-result', finish)
      resolve(result.value)
    }
    window.addEventListener('mac-os-dialog-result', finish)
    window.dispatchEvent(new CustomEvent<OSDialogRequest>('mac-os-dialog', { detail: { id, title, message, kind: 'prompt', initialValue } }))
  })
}
