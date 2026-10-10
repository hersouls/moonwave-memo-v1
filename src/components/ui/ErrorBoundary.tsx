import { Component, type ErrorInfo, type ReactNode } from 'react'
import { IcLineUndo, IcLineWarning } from '@/mw/icons'

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
              <IcLineWarning size={32} className="text-danger-500" />
            </div>

            <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              화면을 보여 주지 못했어요
            </h2>

            <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
              예상하지 못한 문제가 생겼어요.
              <br />
              다시 시도해 주세요.
            </p>

            {this.state.error && (
              <p className="mb-6 rounded-lg bg-zinc-100 p-3 text-left text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {this.state.error.message}
              </p>
            )}

            <button type="button"
              onClick={this.handleRetry}
              className="mw-button mw-button--primary mw-button--medium mw-button--icon-left"
            >
              <IcLineUndo size={16} />
              다시 시도
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
