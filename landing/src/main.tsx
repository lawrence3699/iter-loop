import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root not found in document')
}

// StrictMode is intentionally omitted: its dev-only double-mount re-initializes
// the WebGL/WebGPU shader canvas and causes a visible flash on first paint.
createRoot(container).render(<App />)
