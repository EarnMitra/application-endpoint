# Configuration Module

This directory contains all application configuration files.

## Files

### `appConfig.js`
Application-level configuration settings including:
- Environment variables
- API settings
- Application constants
- Feature flags

### `databaseConfig.js`
Database connection and configuration settings:
- Database connection details
- Connection pooling settings
- Database credentials
- Connection options

## Usage

Import configuration modules at application startup:

```javascript
const appConfig = require('./appConfig');
const databaseConfig = require('./databaseConfig');
```

## Environment Variables

Configuration files should read from environment variables for sensitive data:
- Database host, port, username, password
- API keys and secrets
- Environment mode (development, production, etc.)

## Best Practices

- Keep sensitive credentials in environment variables
- Document all configuration options
- Provide sensible defaults where applicable
- Validate configuration at startup
