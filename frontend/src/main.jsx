import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { getApiBaseUrl } from './utils/apiBaseUrl'
import './index.css'
import App from './App.jsx'
import './config/clarity'
import { perfLog } from './utils/perf'
import { applyStoredTheme } from './utils/userSettings'

getApiBaseUrl()
applyStoredTheme()

const boot = performance.now()
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
requestAnimationFrame(() => {
  perfLog('first-animation-frame', `${Math.round(performance.now() - boot)}ms`)
})
