import { useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { assistantTools, DEFAULT_GROQ_MODEL, executeAssistantTool } from '../apps/assistantTools'
import { useSystemStore } from './store'

type VoiceStatus = 'ready' | 'wake' | 'recording' | 'processing' | 'speaking' | 'error'
type SpeechResult = { isFinal: boolean; 0: { transcript: string } }
type SpeechResultEvent = Event & { resultIndex: number; results: { length: number; [index: number]: SpeechResult } }
type SpeechErrorEvent = Event & { error: string }
interface SpeechRecognitionPort {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: SpeechResultEvent) => void) | null
  onerror: ((event: SpeechErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionPort

function getSpeechRecognition() {
  const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
}

function commandFromTranscript(transcript: string) {
  const wake = transcript.match(/\bhey\s+mac\b/i)
  return wake ? transcript.slice((wake.index ?? 0) + wake[0].length).replace(/^[\s,.:;-]+/, '').trim() : ''
}

function responseText(data: { choices?: Array<{ message?: { content?: string | null } }> }) {
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

function acceptedCommandLine(text: string) {
  const normalized = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()
  try {
    const result = JSON.parse(normalized) as { accepted_command_line?: unknown }
    if (typeof result.accepted_command_line === 'string' && result.accepted_command_line.trim()) return result.accepted_command_line.trim()
  } catch {
    const match = normalized.match(/accepted[_ ]command[_ ]line\s*[:=]\s*["']?([^"'\n}]+)/i)
    if (match?.[1]) return match[1].trim()
  }
  return ''
}

export function VoiceControl() {
  const [enabled, setEnabled] = useState(false)
  const [status, setStatus] = useState<VoiceStatus>('ready')
  const [tipDismissed, setTipDismissed] = useState(() => localStorage.getItem('mac-voice-tip-dismissed') === 'true')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  useEffect(() => {
    let active = false
    let starting = false
    let awaitingCommand = true
    let restartTimer = 0
    let stream: MediaStream | null = null
    let pttStream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let recognition: SpeechRecognitionPort | null = null
    let currentStatus: VoiceStatus = 'ready'
    let requestInFlight = false
    let lastTranscript = ''
    let lastTranscriptAt = 0
    let transcriptionInFlight = false
    let pttHeld = false
    let pttStarting = false
    let recording = false
    let manualSession = false
    let mediaRecorder: MediaRecorder | null = null
    let audioChunks: Blob[] = []

    const setVoiceStatus = (next: VoiceStatus) => {
      currentStatus = next
      setStatus(next)
    }

    const announceEnabled = (value: boolean) => {
      window.dispatchEvent(new CustomEvent('mac-voice-state', { detail: value }))
    }

    const reportEnabled = () => announceEnabled(active)
    const announcePtt = (value: boolean) => window.dispatchEvent(new CustomEvent('mac-ptt-state', { detail: value }))
    const requestAssistantSettings = () => {
      useSystemStore.getState().openApp('assistant')
      window.setTimeout(() => window.dispatchEvent(new Event('mac-assistant-open-settings')), 120)
    }

    const stopRecognition = () => {
      const current = recognition
      recognition = null
      if (!current) return
      current.onend = null
      current.onresult = null
      current.onerror = null
      try { current.stop() } catch {}
    }

    const releaseManualSession = () => {
      manualSession = false
      pttStream?.getTracks().forEach((track) => track.stop())
      pttStream = null
      analyserRef.current = null
      void audioContext?.close()
      audioContext = null
      setEnabled(false)
      setVoiceStatus('ready')
      announcePtt(false)
    }

    const attachAnalyser = (audioStream: MediaStream) => {
      if (audioContext) return
      audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(audioStream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 128
      analyser.smoothingTimeConstant = 0.78
      source.connect(analyser)
      analyserRef.current = analyser
    }

    const stop = () => {
      active = false
      starting = false
      awaitingCommand = false
      pttHeld = false
      recording = false
      pttStarting = false
      window.clearTimeout(restartTimer)
      stopRecognition()
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.onstop = null
        try { mediaRecorder.stop() } catch {}
      }
      mediaRecorder = null
      stream?.getTracks().forEach((track) => track.stop())
      stream = null
      pttStream?.getTracks().forEach((track) => track.stop())
      pttStream = null
      analyserRef.current = null
      void audioContext?.close()
      audioContext = null
      setEnabled(false)
      setVoiceStatus('ready')
      announceEnabled(false)
      announcePtt(false)
    }

    const speak = (text: string) => new Promise<void>((resolve) => {
      if (!('speechSynthesis' in window)) { resolve(); return }
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })

    const announceVoiceMessage = (role: 'user' | 'assistant', content: string) => {
      window.dispatchEvent(new CustomEvent('mac-voice-chat', { detail: { role, content } }))
    }

    const handleRequest = async (rawTranscript: string) => {
      const transcript = rawTranscript.trim()
      const transcriptKey = transcript.toLocaleLowerCase().replace(/\s+/g, ' ')
      const now = Date.now()
      if (!transcript || requestInFlight || (transcriptKey === lastTranscript && now - lastTranscriptAt < 3000)) return
      requestInFlight = true
      lastTranscript = transcriptKey
      lastTranscriptAt = now
      awaitingCommand = false
      setVoiceStatus('processing')
      stopRecognition()
      announceVoiceMessage('user', transcript)
      let usedTools = false
      let actionPerformed = false
      let actionFailed = false

      try {
        const apiKey = sessionStorage.getItem('groq-api-key') ?? ''
        if (!apiKey) {
          window.dispatchEvent(new CustomEvent('mac-voice-settings-required'))
          const spokenText = 'Add your Groq API key in Mac Assistant settings first.'
          setVoiceStatus('speaking')
          announceVoiceMessage('assistant', spokenText)
          await speak(spokenText)
          return
        }

        const model = sessionStorage.getItem('groq-model') ?? DEFAULT_GROQ_MODEL
        const messages: Array<Record<string, unknown>> = [
          { role: 'system', content: 'You are Mac Assistant voice control. Understand the request and use control_os for desktop actions; actions visibly open apps and use their interfaces. For conversational requests, answer naturally in one or two short sentences. If you use control_os, after completing the action respond with only a JSON object of the form {"accepted_command_line":"Okay, I created test.txt."}. Keep that spoken acknowledgment brief, do not narrate the tool call, and do not include any other spoken text.' },
          { role: 'user', content: transcript },
        ]
        const completedActions = new Map<string, string>()
        let answer = ''

        for (let turn = 0; turn < 5; turn++) {
          const response = await fetch('/api/assistant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Groq-Api-Key': apiKey },
            body: JSON.stringify({ model, messages, tools: assistantTools, tool_choice: 'auto', temperature: 0.4 }),
          })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Assistant request failed (${response.status}).`)
          const message = data.choices?.[0]?.message
          if (!message) throw new Error('Mac Assistant returned an empty response.')
          if (message.tool_calls?.length) {
            usedTools = true
            messages.push({ role: 'assistant', content: message.content ?? null, tool_calls: message.tool_calls })
            for (const call of message.tool_calls) {
              let actionKey = call.function.arguments
              try { actionKey = JSON.stringify(JSON.parse(actionKey)) } catch {}
              let result: string
              if (completedActions.has(actionKey)) result = completedActions.get(actionKey) ?? ''
              else {
                actionPerformed = true
                result = await executeAssistantTool(call.function.arguments)
                completedActions.set(actionKey, result)
              }
              if (/could not|disabled|not available|invalid command|not found|already exists/i.test(result)) actionFailed = true
              messages.push({ role: 'tool', tool_call_id: call.id, content: result })
            }
            continue
          }
          answer = responseText(data)
          break
        }

        const spokenText = usedTools
          ? actionFailed ? 'I could not complete that command.' : acceptedCommandLine(answer) || 'Okay, on it now.'
          : answer || 'I did not get a response.'
        setVoiceStatus('speaking')
        announceVoiceMessage('assistant', spokenText)
        await speak(spokenText)
      } catch (error) {
        setVoiceStatus('error')
        const spokenText = actionPerformed ? actionFailed ? 'I could not complete that command.' : 'Okay, on it now.' : error instanceof Error ? error.message : 'I could not reach Mac Assistant.'
        announceVoiceMessage('assistant', spokenText)
        await speak(spokenText)
      } finally {
        requestInFlight = false
        if (active) {
          setVoiceStatus('ready')
          scheduleRecognition()
        } else if (manualSession) releaseManualSession()
      }
    }

    const scheduleRecognition = () => {
      if (!active || recognition || recording || requestInFlight || currentStatus === 'processing' || currentStatus === 'speaking') return
      window.clearTimeout(restartTimer)
      restartTimer = window.setTimeout(() => {
        if (!active || recognition || recording || requestInFlight || currentStatus === 'processing' || currentStatus === 'speaking') return
        const SpeechRecognition = getSpeechRecognition()
        if (!SpeechRecognition) return
        const next = new SpeechRecognition()
        next.continuous = true
        next.interimResults = true
        next.lang = navigator.language || 'en-US'
        recognition = next
        next.onresult = (event) => {
          for (let index = event.resultIndex; index < event.results.length; index++) {
            const result = event.results[index]
            const transcript = result[0].transcript.trim()
            if (!transcript) continue
            const hasWakeWord = /\bhey\s+mac\b/i.test(transcript)
            if (hasWakeWord) {
              setVoiceStatus('wake')
              if (result.isFinal) {
                const command = commandFromTranscript(transcript)
                if (command) void handleRequest(command)
                else { awaitingCommand = true; setVoiceStatus('ready') }
              }
            } else if (result.isFinal && awaitingCommand) {
              void handleRequest(transcript)
            }
          }
        }
        next.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            stop()
            window.alert('Allow microphone access for Mac-NO-S to use Hey Mac voice control.')
          }
        }
        next.onend = () => {
          if (recognition === next) recognition = null
          if (currentStatus === 'wake') setVoiceStatus('ready')
          if (active && currentStatus !== 'processing' && currentStatus !== 'speaking') scheduleRecognition()
        }
        try { next.start() } catch { scheduleRecognition() }
      }, 250)
    }

    const start = async () => {
      if (active || starting || pttStarting || recording || requestInFlight || transcriptionInFlight) return
      starting = true
      if (!navigator.mediaDevices?.getUserMedia || !getSpeechRecognition()) {
        starting = false
        window.alert('Voice control requires a supported browser, a secure connection, and microphone access.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        attachAnalyser(stream)
        active = true
        awaitingCommand = false
        setEnabled(true)
        setVoiceStatus('ready')
        announceEnabled(true)
        scheduleRecognition()
      } catch {
        stream?.getTracks().forEach((track) => track.stop())
        stream = null
        starting = false
        window.alert('Microphone access was not granted. Enable it in your browser settings and try again.')
      }
      starting = false
    }

    const transcribeRecording = async (blob: Blob) => {
      try {
        const apiKey = sessionStorage.getItem('groq-api-key') ?? ''
        if (!apiKey) throw new Error('Add your Groq API key in Mac Assistant settings first.')
        if (blob.size === 0) throw new Error('No audio was captured. Hold the microphone button a little longer.')
        const response = await fetch('/api/assistant/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': blob.type || 'audio/webm', 'X-Groq-Api-Key': apiKey },
          body: blob,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error?.message ?? data.error ?? `Transcription failed (${response.status}).`)
        const transcript = typeof data.text === 'string' ? data.text.trim() : ''
        if (!transcript) throw new Error('I did not hear a command. Please try again.')
        transcriptionInFlight = false
        await handleRequest(transcript)
        if (manualSession && !requestInFlight) releaseManualSession()
      } catch (error) {
        transcriptionInFlight = false
        const message = error instanceof Error ? error.message : 'I could not transcribe that recording.'
        setVoiceStatus('error')
        announceVoiceMessage('assistant', message)
        await speak(message)
        if (active) { setVoiceStatus('ready'); scheduleRecognition() }
        else if (manualSession) releaseManualSession()
      }
    }

    const beginRecording = async () => {
      if (pttStarting || recording || requestInFlight) return
      if (!sessionStorage.getItem('groq-api-key')) {
        pttHeld = false
        announcePtt(false)
        window.dispatchEvent(new CustomEvent('mac-voice-settings-required'))
        window.dispatchEvent(new CustomEvent('mac-voice-chat', { detail: { role: 'assistant', content: 'Add your Groq API key in Mac Assistant settings before using push to talk.' } }))
        return
      }
      pttStarting = true
      manualSession = !active
      try {
        const audioStream = active && stream ? stream : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
        if (!active) pttStream = audioStream
        if (!pttHeld) {
          if (!active) releaseManualSession()
          return
        }
        attachAnalyser(audioStream)
        await audioContext?.resume()
        stopRecognition()
        const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find((candidate) => MediaRecorder.isTypeSupported(candidate))
        mediaRecorder = mimeType ? new MediaRecorder(audioStream, { mimeType }) : new MediaRecorder(audioStream)
        audioChunks = []
        mediaRecorder.ondataavailable = (event) => { if (event.data.size) audioChunks.push(event.data) }
        mediaRecorder.onstop = () => {
          const recorded = new Blob(audioChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
          audioChunks = []
          void transcribeRecording(recorded)
        }
        recording = true
        setEnabled(true)
        setVoiceStatus('recording')
        mediaRecorder.start(200)
      } catch (error) {
        pttHeld = false
        announcePtt(false)
        if (active) { setVoiceStatus('ready'); scheduleRecognition() }
        else if (manualSession) releaseManualSession()
        const message = error instanceof Error && error.name === 'NotAllowedError' ? 'Allow microphone access to use push to talk.' : 'This browser could not start an audio recording.'
        window.dispatchEvent(new CustomEvent('mac-voice-chat', { detail: { role: 'assistant', content: message } }))
      } finally {
        pttStarting = false
      }
    }

    const startPtt = () => {
      if (pttHeld || pttStarting || recording || requestInFlight || transcriptionInFlight) return
      pttHeld = true
      announcePtt(true)
      void beginRecording()
    }

    const endPtt = () => {
      if (!pttHeld) return
      pttHeld = false
      announcePtt(false)
      if (recording && mediaRecorder?.state === 'recording') {
        recording = false
        transcriptionInFlight = true
        setVoiceStatus('processing')
        mediaRecorder.stop()
      }
    }

    const toggle = () => { if (active || starting) stop(); else void start() }
    window.addEventListener('mac-voice-toggle', toggle)
    window.addEventListener('mac-ptt-start', startPtt)
    window.addEventListener('mac-ptt-end', endPtt)
    window.addEventListener('pointerup', endPtt)
    window.addEventListener('pointercancel', endPtt)
    window.addEventListener('blur', endPtt)
    window.addEventListener('mac-voice-query', reportEnabled)
    window.addEventListener('mac-voice-settings-required', requestAssistantSettings)
    return () => {
      window.removeEventListener('mac-voice-toggle', toggle)
      window.removeEventListener('mac-ptt-start', startPtt)
      window.removeEventListener('mac-ptt-end', endPtt)
      window.removeEventListener('pointerup', endPtt)
      window.removeEventListener('pointercancel', endPtt)
      window.removeEventListener('blur', endPtt)
      window.removeEventListener('mac-voice-query', reportEnabled)
      window.removeEventListener('mac-voice-settings-required', requestAssistantSettings)
      stop()
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let frame = 0
    const spectrum = new Uint8Array(64)
    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      context.clearRect(0, 0, width, height)
      const analyser = analyserRef.current
      if (analyser) analyser.getByteFrequencyData(spectrum)
      const bars = 38
      const gap = 4
      const barWidth = 3
      const totalWidth = bars * barWidth + (bars - 1) * gap
      if (status === 'ready') {
        context.fillStyle = '#d2e7ff'
        context.globalAlpha = 0.55
        context.fillRect(width * 0.2, height / 2 - 1, width * 0.6, 2)
      } else {
        const offset = (width - totalWidth) / 2
        const activeColor = status === 'error' ? '#ff5a55' : status === 'wake' ? '#70d7ff' : status === 'recording' ? '#ff7968' : status === 'processing' || status === 'speaking' ? '#b7a2ff' : '#d2e7ff'
        context.fillStyle = activeColor
        for (let bar = 0; bar < bars; bar++) {
          const bin = Math.min(spectrum.length - 1, Math.round(bar / bars * spectrum.length))
          const energy = analyser ? spectrum[bin] / 255 : 0
          const center = Math.abs((bars - 1) / 2 - bar) / ((bars - 1) / 2)
          const amplitude = Math.max(2, energy * 37 * (1 - center * 0.42))
          const x = offset + bar * (barWidth + gap)
          context.globalAlpha = 0.55 + energy * 0.45
          context.fillRect(x, (height - amplitude) / 2, barWidth, amplitude)
        }
      }
      context.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [enabled, status])

  if (!enabled) {
    if (tipDismissed) return null
    return <div className="voice-onboarding"><span className="voice-onboarding-icon"><Mic size={15} /></span><span className="voice-onboarding-copy"><strong>Try “Hey Mac”</strong><small>Turn on voice control, then speak anywhere on your desktop.</small></span><button className="voice-onboarding-start" aria-label="Enable Hey Mac voice control" onClick={() => window.dispatchEvent(new Event('mac-voice-toggle'))}>Enable <Mic size={13} /></button><button className="voice-onboarding-dismiss" aria-label="Dismiss voice control tip" onClick={() => { localStorage.setItem('mac-voice-tip-dismissed', 'true'); setTipDismissed(true) }}><X size={13} /></button></div>
  }
  return <div className="voice-hud" aria-label={`Hey Mac voice control ${status}`} role="status"><canvas ref={canvasRef} width={300} height={100} /><span className="voice-sr-only">{status === 'ready' ? 'Listening for Hey Mac or a voice command.' : status}</span></div>
}
