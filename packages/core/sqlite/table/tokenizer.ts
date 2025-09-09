export interface FtsTokenizerOptions {
  readonly removeDiacritics?: 0 | 1 | 2
  readonly tokenChars?: string
  readonly separators?: string
}

/**
 * Create a custom FTS5 tokenizer string based on the provided options
 * @param options Options to customize the tokenizer
 * @returns A string representing the FTS5 tokenizer configuration
 */
export function unicodeTokenizer(options: FtsTokenizerOptions = {}): string {
  const { removeDiacritics, tokenChars, separators } = options
  const parts: string[] = []

  if (removeDiacritics !== undefined) {
    parts.push(`"remove_diacritics=${removeDiacritics}"`)
  }
  if (tokenChars && tokenChars.length > 0) {
    parts.push(`"tokenchars='${tokenChars.replaceAll("'", "''")}'"`)
  }
  if (separators && separators.length > 0) {
    parts.push(`"separators='${separators.replaceAll("'", "''")}'"`)
  }

  // 👉 return correct SQLite syntax
  if (parts.length === 0) {
    return '"unicode61"'
  }
  const hasParts = parts.length > 0
  if (!hasParts) {
    return '"unicode61"'
  }
  return `"unicode61", ${parts.join(', ')}`
}
