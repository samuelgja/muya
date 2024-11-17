import { Component } from 'react'

export function longPromise(time = 200): Promise<number> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(0)
    }, time)
  })
}

// ErrorBoundary Component
export class ErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can log the error to an error reporting service here
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return this.props.fallback
    }

    return this.props.children
  }
}
