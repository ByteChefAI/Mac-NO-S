import { useSystemStore } from './store'

let audioContext: AudioContext | null = null
let lastPlayedAt = 0

export function playAssistantBlup() {
  if (!useSystemStore.getState().soundEffectsEnabled) return
  const now = Date.now()
  if (now - lastPlayedAt < 450) return
  lastPlayedAt = now
  try {
    const AudioContextClass = window.AudioContext
    audioContext ??= new AudioContextClass()
    if (audioContext.state === 'suspended') void audioContext.resume()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const start = audioContext.currentTime
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(760, start)
    oscillator.frequency.exponentialRampToValueAtTime(510, start + 0.11)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.09, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.18)
  } catch {
    return
  }
}
