module.exports = {
  // Overrides from defaults to match standard js.
  // see: https://prettier.io/docs/en/options.html
  // see: https://standardjs.com/rules-en.html

  // Specified in standard
  // tabWidth: 2 // default: 2
  // tabs: false // default: false
  semi: false, // default: true
  singleQuote: true, // default: false
  trailingComma: 'all', // default: 'none'
  // bracketSpacing: true, // default: true
  endOfLine: 'lf', // default: 'auto'

  // arrowParens: 'avoid' // default: 'avoid'

  // Not specified in standard
  printWidth: 130, // default: 80
  // quoteProps: 'as-needed', // default: 'as-needed'
  // requirePragma: false, // default: false
  // insertPragma: false, // default: false

  // For .md
  // proseWrap: 'preserve', // default: 'preserve'

  // For .html
  // htmlWhitespaceSensitivity: 'css', // default: 'css'

  // For JSX
  // jsxSingleQuote: false // default: false,
  jsxBracketSameLine: true, // defaults: false // NOTE: Kept this as in the file was overriding the default
}
