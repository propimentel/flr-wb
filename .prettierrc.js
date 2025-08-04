module.exports = {
  // Print width - line will wrap at this length
  printWidth: 80,
  
  // Tab width - number of spaces per indentation level
  tabWidth: 2,
  
  // Use tabs instead of spaces
  useTabs: false,
  
  // Add semicolons at the end of statements
  semi: true,
  
  // Use single quotes instead of double quotes
  singleQuote: true,
  
  // Quote properties in objects only when necessary
  quoteProps: 'as-needed',
  
  // Use single quotes in JSX
  jsxSingleQuote: true,
  
  // Add trailing commas where valid in ES5 (objects, arrays, etc.)
  trailingComma: 'es5',
  
  // Add spaces inside object literals' curly braces
  bracketSpacing: true,
  
  // Put the `>` of a multi-line JSX element at the end of the last line
  bracketSameLine: false,
  
  // Include parentheses around a sole arrow function parameter
  arrowParens: 'avoid',
  
  // Format only a segment of a file
  rangeStart: 0,
  rangeEnd: Infinity,
  
  // Which parser to use
  parser: undefined,
  
  // Path to prettier config file
  filepath: undefined,
  
  // Whether to require pragma comments
  requirePragma: false,
  
  // Whether to add pragma comments
  insertPragma: false,
  
  // How to handle whitespace in prose
  proseWrap: 'preserve',
  
  // How to handle whitespace in HTML
  htmlWhitespaceSensitivity: 'css',
  
  // Which end of line characters to apply
  endOfLine: 'lf',
  
  // Control whether Prettier formats quoted code embedded in the file
  embeddedLanguageFormatting: 'auto',
  
  // Enforce single attribute per line in HTML, Vue and JSX
  singleAttributePerLine: false,
};
