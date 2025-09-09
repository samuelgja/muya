import { unicodeTokenizer, type FtsTokenizerOptions } from '../table/tokenizer'

describe('tokenizer', () => {
  const items: {
    options: FtsTokenizerOptions
    expected: string
  }[] = [
    { options: {}, expected: '"unicode61"' },
    {
      options: { removeDiacritics: 1 },
      expected: '"unicode61", "remove_diacritics=1"',
    },
    {
      options: { tokenChars: 'abc' },
      expected: '"unicode61", "tokenchars=\'abc\'"',
    },
    {
      options: { separators: 'xyz' },
      expected: '"unicode61", "separators=\'xyz\'"',
    },
    {
      options: { removeDiacritics: 2, tokenChars: 'a-b', separators: 'x,y' },
      expected: '"unicode61", "remove_diacritics=2", "tokenchars=\'a-b\'", "separators=\'x,y\'"',
    },
    {
      options: { tokenChars: "a'b", separators: "c'd" },
      expected: "\"unicode61\", \"tokenchars='a''b'\", \"separators='c''d'\"",
    },
    {
      options: { removeDiacritics: 0, tokenChars: '', separators: '' },
      expected: '"unicode61", "remove_diacritics=0"',
    },
    {
      options: { removeDiacritics: 1, tokenChars: 'abc', separators: 'xyz' },
      expected: '"unicode61", "remove_diacritics=1", "tokenchars=\'abc\'", "separators=\'xyz\'"',
    },
  ]
  for (const item of items) {
    it(`returns expected tokenizer string for options: ${JSON.stringify(item.options)}`, () => {
      expect(unicodeTokenizer(item.options)).toBe(item.expected)
    })
  }
})
