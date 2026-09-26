import React from 'react'
import ReactDOM from 'react-dom/client'
import { Desktop } from './system/Desktop'
import './styles.css'
import './light-theme.css'
import './settings-controls.css'
import './cursors.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Desktop />
  </React.StrictMode>,
)