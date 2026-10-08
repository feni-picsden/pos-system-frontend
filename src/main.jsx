import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { installDebugLog } from './utils/debugLog'

// Setup > General > "Debug Logging Level": mirror console output into the
// local diagnostics database (level applied once the company settings load).
installDebugLog()

createRoot(document.getElementById('root')).render(<App />)
