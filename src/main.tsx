import React from 'react'
import ReactDOM from 'react-dom/client'
import { Desktop } from './system/Desktop'
import './styles.css'
import './light-theme.css'
import './settings-controls.css'
import './cursors.css'
import './pwa-assistant.css'
import './voice.css'
import './assistant-cursor.css'
import './voice-onboarding.css'

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Desktop />
  </React.StrictMode>,
)