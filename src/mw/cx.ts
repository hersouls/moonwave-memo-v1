/** Joins class names, skipping anything falsy. The whole kit uses this instead of a class-name library. */
export type ClassValue = string | false | null | undefined
export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}
