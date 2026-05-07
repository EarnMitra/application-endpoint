# Utilities Module

This directory contains reusable utility functions and helpers used across the application.

## Files

### `terminalCommands.js`
Terminal/shell command utilities for:
- Executing system commands
- Running shell scripts
- Command execution helpers
- Process management utilities

### `timestampUtil.js`
Timestamp and time-related utility functions:
- Timestamp generation and formatting
- Date/time conversions
- Time calculations
- UTC and local timezone handling

## Usage

Import utilities as needed:

```javascript
const { /* required function */ } = require('./terminalCommands');
const { /* required function */ } = require('./timestampUtil');
```

## Best Practices

- Keep utilities focused and reusable
- Avoid business logic in utility functions
- Document function signatures and parameters
- Handle errors appropriately
- Write unit tests for utility functions

## Contributing

When adding new utilities:
1. Place them in appropriate files or create new utility files
2. Export functions clearly
3. Add JSDoc comments
4. Consider edge cases and error handling
5. Update this README with new utilities
