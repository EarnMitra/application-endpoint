# API Middlewares Documentation

Complete guide to the EarnMitra Server middlewares system.

## Table of Contents

1. [Overview](#overview)
2. [Mode Middleware](#mode-middleware)
3. [Response Middleware](#response-middleware)
4. [Timestamp Formats](#timestamp-formats)
5. [Usage Examples](#usage-examples)
6. [API Response Formats](#api-response-formats)

---

## Overview

The middleware system provides two core functionalities:

### **1. Mode Middleware** (`modeMiddleware.js`)
- Detects application mode (DEBUG, TEST, PROD)
- Attaches configuration to every request
- Makes mode constants available throughout the app

### **2. Response Middleware** (`responseMiddleware.js`)
- Standardizes all API responses
- Handles pagination, filtering, searching, bulk operations
- Provides 15+ response methods
- Supports multiple timestamp formats

---

## Mode Middleware

### Initialization

The app mode is initialized when the server starts:

```javascript
const appConfig = require('./src/config/appConfig');
const config = appConfig.initialize(NODE_ENV, PORT, 'json');
```

### Mode Constants

```
DEBUG      → 'debug'
TEST       → 'test'
PROD       → 'production'
```

### Request Properties

Every request includes:

```javascript
req.appMode              // Current mode string ('debug', 'test', 'production')
req.appConfig            // Full configuration object
req.isDebugMode          // Boolean
req.isTestMode           // Boolean
req.isProductionMode     // Boolean
req.MODES                // { DEBUG: 'debug', TEST: 'test', PROD: 'production' }
req.OUTPUT_TYPES         // { JSON: 'json', XML: 'xml', TEXT: 'text' }
```

### Configuration Object

The `req.appConfig` contains:

```json
{
  "mode": "debug",
  "port": 5000,
  "outputType": "json",
  "nodeEnv": "debug",
  "timestamp": "2026-05-03T12:45:00.000Z",
  "isDebug": true,
  "isTest": false,
  "isProd": false,
  "version": "1.0.0",
  "name": "EarnMitra Server",
  "author": "SK Sharma"
}
```

### Environment Configuration

Set in `.env`:

```env
PORT=5000
# Modes: debug, test, production
NODE_ENV=development
TIMESTAMP_FORMAT=readable
```

### Access Config in Routes

```javascript
// Basic check
if (req.isDebugMode) {
  console.log('Debug mode enabled');
}

// Use mode constants
if (req.appMode === req.MODES.DEBUG) {
  // Enable detailed logging
}

// Access full config
console.log(req.appConfig.version);
console.log(req.appConfig.port);
```

---

## Response Middleware

### Success Responses

#### Basic Success Response
```javascript
res.success(data, message, statusCode, metadata)

// Example
res.success({ userId: 1, name: 'John' }, 'User retrieved', 200);
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "User retrieved",
  "data": { "userId": 1, "name": "John" },
  "timestamp": "2026-05-03 12:45:00",
  "mode": "debug"
}
```

---

#### Paginated Response
```javascript
res.paginated(items, total, page, pageSize, message, statusCode, filters)

// Example
res.paginated(users, 150, 2, 10, 'Users retrieved', 200, { role: 'admin' });
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Users retrieved",
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 2,
    "pageSize": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": true,
    "startIndex": 11,
    "endIndex": 20
  },
  "filters": { "role": "admin" },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### List Response
```javascript
res.list(items, total, message, statusCode, metadata)

// Example
res.list(products, 250, 'Products retrieved');
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Products retrieved",
  "data": [...],
  "count": 10,
  "total": 250,
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Filtered Response
```javascript
res.filtered(data, filterInfo, sortInfo, message, statusCode)

// Example
res.filtered(
  results,
  { category: 'electronics', priceMin: 100, priceMax: 500 },
  { field: 'price', order: 'asc' },
  'Filtered results'
);
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Filtered results",
  "data": [...],
  "metadata": {
    "filters": { "category": "electronics", "priceMin": 100, "priceMax": 500 },
    "sorting": { "field": "price", "order": "asc" },
    "resultCount": 45
  },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### CRUD Operations

#### Created Response (201)
```javascript
res.created(data, message, resourceId)

// Example
res.created(newUser, 'User created successfully', '/api/users/123');
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 201,
  "message": "User created successfully",
  "data": { "id": 123, "name": "John", "email": "john@example.com" },
  "resourceId": "/api/users/123",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Updated Response
```javascript
res.updated(data, message)

// Example
res.updated(updatedUser, 'User updated successfully');
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "User updated successfully",
  "data": { "id": 123, "name": "John Updated" },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Deleted Response
```javascript
res.deleted(message, deletedData)

// Example
res.deleted('User deleted successfully', deletedUser);
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "User deleted successfully",
  "data": { "id": 123, "name": "John" },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### Search & Bulk Operations

#### Search Response
```javascript
res.search(results, total, query, message, statusCode)

// Example
res.search(searchResults, 25, 'john', 'Search results retrieved');
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Search results retrieved",
  "search": {
    "query": "john",
    "resultsCount": 5,
    "totalResults": 25
  },
  "data": [...],
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Bulk Operation Response
```javascript
res.bulk(successfulItems, failedItems, message)

// Example
res.bulk(
  [{ id: 1, status: 'created' }, { id: 2, status: 'created' }],
  [{ id: 3, error: 'Invalid email' }],
  'Bulk operation completed'
);
```

**Response:**
```json
{
  "status": "partial",
  "statusCode": 200,
  "message": "Bulk operation completed",
  "results": {
    "successful": 2,
    "failed": 1,
    "total": 3
  },
  "data": {
    "successful": [...],
    "failed": [{ "id": 3, "error": "Invalid email" }]
  },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### Error Responses

#### Basic Error (400)
```javascript
res.error(message, statusCode, errors, errorCode)

// Example
res.error('Invalid request data', 400);
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 400,
  "message": "Invalid request data",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Validation Error (422)
```javascript
res.validationError(errors, message)

// Example
res.validationError({
  email: 'Invalid email format',
  password: 'Password must be at least 8 characters'
});
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 422,
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email format",
    "password": "Password must be at least 8 characters"
  },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Not Found (404)
```javascript
res.notFound(message, resource)

// Example
res.notFound('User not found', 'user');
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 404,
  "message": "User not found",
  "resource": "user",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Unauthorized (401)
```javascript
res.unauthorized(message)

// Example
res.unauthorized('Please login first');
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 401,
  "message": "Please login first",
  "errorCode": "UNAUTHORIZED",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Forbidden (403)
```javascript
res.forbidden(message)

// Example
res.forbidden('You do not have permission');
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 403,
  "message": "You do not have permission",
  "errorCode": "FORBIDDEN",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Server Error (500)
```javascript
res.serverError(message, errorDetails)

// Example (only shows details in debug/test mode)
res.serverError('Internal server error', err);
```

**Response (Debug Mode):**
```json
{
  "status": "error",
  "statusCode": 500,
  "message": "Internal server error",
  "errorCode": "INTERNAL_SERVER_ERROR",
  "details": { "stack": "..." },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Rate Limited (429)
```javascript
res.rateLimited(retryAfter)

// Example
res.rateLimited(60);  // Retry after 60 seconds
```

**Response:**
```json
{
  "status": "error",
  "statusCode": 429,
  "message": "Too many requests",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "timestamp": "2026-05-03 12:45:00"
}
```

---

#### Custom Response
```javascript
res.custom(statusCode, responseBody)

// Example
res.custom(200, {
  status: 'success',
  data: customData,
  customField: 'customValue'
});
```

---

## Timestamp Formats

### Available Formats

The response middleware automatically adds timestamps in your preferred format.

| Format | Example | Usage |
|--------|---------|-------|
| `readable` (DEFAULT) | `2026-05-03 12:45:00` | `?timestamp_format=readable` |
| `iso` | `2026-05-03T12:45:00.123Z` | `?timestamp_format=iso` |
| `unix` | `1714756500123` | `?timestamp_format=unix` |
| `unix_seconds` | `1714756500` | `?timestamp_format=unix_seconds` |
| `readable_ms` | `2026-05-03 12:45:00.123` | `?timestamp_format=readable_ms` |
| `date_only` | `2026-05-03` | `?timestamp_format=date_only` |
| `time_only` | `12:45:00` | `?timestamp_format=time_only` |

### Set Globally

In `.env`:
```env
TIMESTAMP_FORMAT=iso
```

### Set Per Request

```bash
GET /api/users?timestamp_format=unix
GET /api/products?timestamp_format=readable_ms
GET /api/orders?timestamp_format=date_only
```

---

## Usage Examples

### Example 1: Get Users with Pagination

**Route:**
```javascript
app.get('/api/users', (req, res) => {
  const page = req.query.page || 1;
  const pageSize = req.query.pageSize || 10;
  const filters = {
    role: req.query.role,
    status: req.query.status
  };

  // Fetch users from database
  const users = [...]; // Your data
  const totalUsers = 150;

  res.paginated(
    users,
    totalUsers,
    page,
    pageSize,
    'Users retrieved successfully',
    200,
    filters
  );
});
```

**Request:**
```bash
GET /api/users?page=2&pageSize=10&role=admin&timestamp_format=readable
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Users retrieved successfully",
  "data": [...],
  "pagination": {
    "total": 150,
    "page": 2,
    "pageSize": 10,
    "totalPages": 15,
    "hasNextPage": true,
    "hasPrevPage": true,
    "startIndex": 11,
    "endIndex": 20
  },
  "filters": { "role": "admin", "status": null },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### Example 2: Create User

**Route:**
```javascript
app.post('/api/users', (req, res) => {
  try {
    // Validate request
    if (!req.body.email || !req.body.name) {
      return res.validationError({
        email: 'Email is required',
        name: 'Name is required'
      });
    }

    // Create user in database
    const newUser = { id: 123, name: req.body.name, email: req.body.email };

    res.created(
      newUser,
      'User created successfully',
      `/api/users/${newUser.id}`
    );
  } catch (error) {
    res.serverError('Failed to create user', error);
  }
});
```

**Request:**
```bash
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 201,
  "message": "User created successfully",
  "data": {
    "id": 123,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "resourceId": "/api/users/123",
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### Example 3: Search Products

**Route:**
```javascript
app.get('/api/products/search', (req, res) => {
  const query = req.query.q;

  // Search in database
  const results = searchDatabase(query);
  const totalResults = getTotalCount(query);

  res.search(
    results,
    totalResults,
    query,
    'Search results retrieved'
  );
});
```

**Request:**
```bash
GET /api/products/search?q=laptop&timestamp_format=unix_seconds
```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Search results retrieved",
  "search": {
    "query": "laptop",
    "resultsCount": 5,
    "totalResults": 25
  },
  "data": [...],
  "timestamp": 1714756500
}
```

---

### Example 4: Bulk Import Users

**Route:**
```javascript
app.post('/api/users/bulk', (req, res) => {
  const users = req.body.users;
  const successful = [];
  const failed = [];

  users.forEach((user, index) => {
    try {
      // Validate and create
      if (!user.email || !user.name) {
        failed.push({
          index,
          email: user.email,
          error: 'Missing required fields'
        });
      } else {
        successful.push(createUser(user));
      }
    } catch (error) {
      failed.push({
        index,
        email: user.email,
        error: error.message
      });
    }
  });

  res.bulk(successful, failed, 'Bulk import completed');
});
```

**Request:**
```bash
POST /api/users/bulk
Content-Type: application/json

{
  "users": [
    { "name": "John", "email": "john@example.com" },
    { "name": "Jane", "email": "jane@example.com" },
    { "name": "Invalid" }
  ]
}
```

**Response:**
```json
{
  "status": "partial",
  "statusCode": 200,
  "message": "Bulk import completed",
  "results": {
    "successful": 2,
    "failed": 1,
    "total": 3
  },
  "data": {
    "successful": [...],
    "failed": [
      {
        "index": 2,
        "error": "Missing required fields"
      }
    ]
  },
  "timestamp": "2026-05-03 12:45:00"
}
```

---

### Example 5: Check Mode in Route

**Route:**
```javascript
app.get('/api/debug-info', (req, res) => {
  // Only available in debug mode
  if (!req.isDebugMode) {
    return res.forbidden('Debug info only available in debug mode');
  }

  res.success({
    config: req.appConfig,
    modes: req.MODES,
    environment: process.env,
    uptime: process.uptime()
  }, 'Debug information retrieved');
});
```

---

## API Response Formats

### Response Structure

All responses follow this structure:

```json
{
  "status": "success|error|partial",
  "statusCode": 200,
  "message": "Human readable message",
  "data": {},
  "timestamp": "2026-05-03 12:45:00",
  "mode": "debug"
}
```

### Status Values

- `success` - Operation completed successfully
- `error` - Operation failed
- `partial` - Operation partially completed (bulk operations)

### Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Server Error |

---

## Configuration

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Modes: debug, test, production
# debug    - Shows all details, stack traces
# test     - For testing, controlled output
# production - Minimal output, no debug info

# Timestamp format
TIMESTAMP_FORMAT=readable
# Options: iso, unix, unix_seconds, readable, readable_ms, date_only, time_only
```

### Mode-Specific Behavior

**Debug Mode:**
- Shows full stack traces
- Includes mode info in responses
- Adds `X-App-Mode` header
- Logs available endpoints

**Test Mode:**
- Shows detailed error information
- Includes mode info in responses
- Adds `X-App-Mode` header

**Production Mode:**
- Minimal error information
- No debug details
- No mode info in responses
- No debug headers

---

## Best Practices

1. **Always use appropriate response methods** - Use `res.created()` for POST, `res.updated()` for PUT, etc.

2. **Include filters in paginated responses** - Helps clients understand what data was filtered

3. **Use validation errors for form validation** - `res.validationError()` instead of `res.error()`

4. **Check mode before exposing sensitive data**:
   ```javascript
   if (req.isProductionMode) {
     // Don't expose sensitive details
   }
   ```

5. **Use consistent timestamp formats** - Set globally or document per endpoint

6. **Include resource IDs in created responses** - Helps clients track created resources

7. **Provide clear error messages** - Helps API consumers debug issues

8. **Use bulk operations for batch updates** - More efficient than multiple requests

---

## Troubleshooting

### Timestamps not showing correct format

Check `.env` for `TIMESTAMP_FORMAT` setting or pass `?timestamp_format=` in query string.

### Debug info showing in production

Ensure `NODE_ENV=production` in `.env`. Debug info only shows when mode is not production.

### Stack traces not showing

Set `NODE_ENV=debug` or `NODE_ENV=test` to see full error details.

### Pagination numbers incorrect

Verify `pageSize` is being passed correctly and page numbers are 1-based.

---

## Related Files

- [modeMiddleware.js](modeMiddleware.js) - Mode detection and config
- [responseMiddleware.js](responseMiddleware.js) - All response methods
- [appConfig.js](../config/appConfig.js) - Configuration management
- [timestampUtil.js](../utils/timestampUtil.js) - Timestamp utilities

---

**Version:** 1.0.0  
**Last Updated:** May 3, 2026  
**Author:** SK Sharma
