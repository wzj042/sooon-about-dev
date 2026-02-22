import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

import './index.css'
import App from './app/App'

interface RootErrorBoundaryState {
  hasError: boolean
  message: string
}

class RootErrorBoundary extends Component<{ children: ReactNode }, RootErrorBoundaryState> {
  state: RootErrorBoundaryState = {
    hasError: false,
    message: '',
  }

  static getDerivedStateFromError(error: unknown): RootErrorBoundaryState {
    const message = error instanceof Error ? error.message : String(error)
    return {
      hasError: true,
      message,
    }
  }

  override componentDidCatch(error: unknown): void {
    // Keep a visible fallback for production while preserving stack in devtools.
    console.error('Root render error:', error)
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main style={{ padding: 16, fontFamily: 'sans-serif', lineHeight: 1.6 }}>
          <h1>页面加载失败</h1>
          <p>应用初始化时发生错误，请刷新后重试。</p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{this.state.message}</pre>
        </main>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
)
