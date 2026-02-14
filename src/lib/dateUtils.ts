export function nowISO(): string {
  return new Date().toISOString()
}

export function isExpired(dateStr: string, daysAgo: number): boolean {
  const date = new Date(dateStr)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysAgo)
  return date < cutoff
}
