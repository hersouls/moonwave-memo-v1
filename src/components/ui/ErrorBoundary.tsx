import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-900">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-50 dark:bg-danger-500/10">
              <AlertTriangle className="h-8 w-8 text-danger-500" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              오류가 발생했습니다
            </h2>

            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              예상치 못한 문제가 발생했습니다.
              <br />
              다시 시도해 주세요.
            </p>

            {this.state.error && (
              <p className="mb-6 rounded-lg bg-zinc-100 p-3 text-left text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {this.state.error.message}
              </p>
            )}

            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 active:bg-primary-700"
            >
              <RotateCcw className="h-4 w-4" />
              다시 시도
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
