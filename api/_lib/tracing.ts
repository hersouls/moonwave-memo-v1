// ─── LangSmith Tracing Configuration ────────────────
// Auto-enabled when LANGSMITH_API_KEY is set in Vercel environment.
// LangChain automatically reads these env vars:
//   LANGCHAIN_TRACING_V2=true
//   LANGCHAIN_API_KEY=<langsmith-api-key>
//   LANGCHAIN_PROJECT=moonwave-memo

export function ensureTracing(): void {
  if (process.env.LANGSMITH_API_KEY && !process.env.LANGCHAIN_TRACING_V2) {
    process.env.LANGCHAIN_TRACING_V2 = 'true'
    process.env.LANGCHAIN_API_KEY = process.env.LANGSMITH_API_KEY
    process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || 'moonwave-memo'
  }
}
