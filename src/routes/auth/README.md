# Authentication API Routes Documentation

## Base URL
```
/api/auth
```

## Overview
This directory contains all authentication-related endpoints for the EarnMitra application. The authentication system supports both registration and login flows with phone OTP verification, email verification, and multi-step user profile completion.

### Key Features:
- **Phone OTP Authentication**: Auto-detects registration vs login
- **Email Verification**: Separate OTP-based email verification
- **Rate Limiting**: Built-in protection against brute force attacks
- **Device Tracking**: Tracks login devices and location information
- **Session Management**: JWT-like session tokens for authenticated requests

---

## API Endpoints

### 1. Phone OTP - Initiate

**Endpoint:** `POST /api/auth/phone/initiate`

**Description:** Initiate phone OTP for authentication (auto-detects registration vs login)

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `phone` | string | body | Yes | Phone number (Indian format, 10 digits) |

**Request Example:**
```json
{
  "phone": "9876543210"
}
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "purpose": "registration",
    "message": "OTP sent for registration",
    "expiresIn": 600
  },
  "message": "OTP sent successfully"
}
```

**Field Descriptions:**
- `token` (string): Token to be used in `/verify` endpoint
- `purpose` (string): Either "registration" or "login"
- `expiresIn` (number): OTP validity period in seconds (default 600 = 10 minutes)

#### Error Responses

**Missing Phone (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "required": ["phone"]
  },
  "message": "Phone number is required"
}
```

**Invalid Phone Format (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "phone"
  },
  "message": "Please enter a valid phone number"
}
```

**Rate Limit Exceeded (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "phone",
    "rateLimitResetIn": 3456
  },
  "message": "Too many OTP requests. Please try again in 3456 seconds."
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "errors": {
    "code": "UNKNOWN_ERROR"
  },
  "message": "Failed to send OTP. Please try again."
}
```

#### Rate Limiting
- **Limit**: 5 attempts per hour per phone number
- **Window**: 3600000 milliseconds (1 hour)
- **Response**: 429 Too Many Requests with reset time

---

### 2. Phone OTP - Verify

**Endpoint:** `POST /api/auth/phone/verify`

**Description:** Verify phone OTP and authenticate user (auto-creates account on first-time registration)

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `token` | string | body | Yes | Token from `/initiate` endpoint |
| `otp` | string | body | Yes | 6-digit OTP sent to phone |
| `phone` | string | body | Yes | Phone number (must match `/initiate` request) |
| `deviceInfo` | object | body | No | Device information (see details below) |

**DeviceInfo Object (Optional):**
```json
{
  "deviceName": "iPhone 13 Pro",
  "osType": "iOS",
  "browserType": "Safari",
  "screenResolution": "1170x2532",
  "timezone": "Asia/Kolkata",
  "deviceMemory": 4,
  "language": "en-US",
  "platform": "MacIntel",
  "vendor": "Apple",
  "hardwareConcurrency": 6,
  "location": "Delhi",
  "latitude": 28.7041,
  "longitude": 77.1025
}
```

**Request Example:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "otp": "123456",
  "phone": "9876543210",
  "deviceInfo": {
    "deviceName": "Samsung Galaxy A12",
    "osType": "Android",
    "browserType": "Chrome"
  }
}
```

#### Response

**Success Response (200 OK) - New User (Registration):**
```json
{
  "success": true,
  "data": {
    "uid": "a1b2c3d4e5f6g7h8i9j0",
    "phone": "9876543210",
    "sessionToken": "session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "refreshToken": "refresh_a1b2c3d4e5f6g7h8",
    "isLogin": false,
    "referralCode": "12345678",
    "step": 1,
    "message": "User created, phone verified",
    "nextStep": "addEmail"
  },
  "message": "Phone verified successfully"
}
```

**Success Response (200 OK) - Existing User (Login):**
```json
{
  "success": true,
  "data": {
    "uid": "a1b2c3d4e5f6g7h8i9j0",
    "phone": "9876543210",
    "sessionToken": "session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "refreshToken": "refresh_a1b2c3d4e5f6g7h8",
    "isLogin": true,
    "registrationStep": 4,
    "firstName": "John",
    "email": "john@example.com",
    "message": "Login successful",
    "loginHistory": {
      "previousLogin": "2026-05-04T10:30:00Z",
      "deviceCount": 2,
      "recentDevices": [
        {
          "deviceName": "iPhone 13",
          "osType": "iOS",
          "lastUsed": "2026-05-04T10:30:00Z"
        }
      ]
    }
  },
  "message": "Login successful"
}
```

**Field Descriptions:**
- `uid` (string): Unique user identifier (18 hex characters)
- `sessionToken` (string): Bearer token for authenticated requests (64 hex chars)
- `refreshToken` (string): Token for refreshing session (16 hex chars)
- `isLogin` (boolean): True if existing user, false if new registration
- `referralCode` (string): Unique 8-digit referral code (new users only)
- `registrationStep` (number): Current step in registration (1-4)

#### Error Responses

**Missing Required Fields (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "required": ["token", "otp", "phone"]
  },
  "message": "Token, OTP, and phone are required"
}
```

**Invalid Phone Format (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "phone"
  },
  "message": "Please enter a valid phone number"
}
```

**Invalid Device Info (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "deviceInfo"
  },
  "message": "Device info must be a valid JSON object"
}
```

**Rate Limit Exceeded (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "phone",
    "rateLimitResetIn": 2156
  },
  "message": "Too many verification attempts. Please try again in 2156 seconds."
}
```

**Invalid OTP (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "otp"
  },
  "message": "Invalid OTP"
}
```

**OTP Expired (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "token"
  },
  "message": "OTP has expired. Please request a new one."
}
```

**Too Many Attempts (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "otp"
  },
  "message": "Too many failed attempts. Please try again later."
}
```

#### Rate Limiting
- **Limit**: 10 verify attempts per hour per phone number
- **Window**: 3600000 milliseconds (1 hour)
- **Response**: 429 Too Many Requests with reset time

---

### 3. Registration - Add Email

**Endpoint:** `POST /api/auth/register/addEmail`

**Description:** Add email to user account and send verification OTP (Step 1 of registration)

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `email` | string | body | Yes | Email address to verify |
| `Authorization` | string | header | Yes | Bearer session token from `/verify` |

**Request Example:**
```json
{
  "email": "user@example.com"
}
```

**Headers:**
```
Authorization: Bearer session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "token": "email_token_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "step": 1,
    "message": "Email OTP sent",
    "expiresIn": 600
  },
  "message": "Email added and OTP sent"
}
```

**Field Descriptions:**
- `email` (string): Normalized email (lowercase, trimmed)
- `token` (string): Token to be used in `/verifyEmail` endpoint
- `step` (number): Registration step number (1)
- `expiresIn` (number): OTP validity period in seconds

#### Error Responses

**Missing Email (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "required": ["email"]
  },
  "message": "Email is required"
}
```

**Missing Authorization Header (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Valid session token required in Authorization header"
}
```

**Invalid Email Format (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Invalid email format"
}
```

**Invalid or Expired Session Token (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Invalid or expired session token"
}
```

**User Not Found or Phone Not Verified (404 Not Found):**
```json
{
  "success": false,
  "errors": {
    "field": "user"
  },
  "message": "User not found or phone not verified"
}
```

**Registration Already Complete (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "registration"
  },
  "message": "Registration already completed"
}
```

**Email Already Added (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Email already added for this account"
}
```

**Email Already Registered (409 Conflict):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Email already registered"
}
```

**Rate Limit Exceeded (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Too many addEmail attempts. Try again in 1234 seconds."
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "errors": {
    "code": "UNKNOWN_ERROR"
  },
  "message": "Failed to add email. Please try again."
}
```

#### Rate Limiting
- **Limit**: 5 attempts per hour per email
- **Window**: 3600000 milliseconds (1 hour)
- **Response**: 429 Too Many Requests

---

### 4. Registration - Verify Email

**Endpoint:** `POST /api/auth/register/verifyEmail`

**Description:** Verify email OTP and mark email as verified (Step 2 of registration)

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `token` | string | body | Yes | Email OTP token from `/addEmail` |
| `otp` | string | body | Yes | 6-digit OTP sent to email |
| `email` | string | body | Yes | Email address being verified |
| `Authorization` | string | header | Yes | Bearer session token |

**Request Example:**
```json
{
  "token": "email_token_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "otp": "123456",
  "email": "user@example.com"
}
```

**Headers:**
```
Authorization: Bearer session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "verified": true,
    "step": 2,
    "message": "Email verified",
    "nextStep": "completeProfile"
  },
  "message": "Email verified successfully"
}
```

**Field Descriptions:**
- `email` (string): Verified email address
- `verified` (boolean): Confirmation that email is verified
- `step` (number): Registration step number (2)

#### Error Responses

**Missing Required Fields (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "required": ["token", "otp", "email"]
  },
  "message": "Token, OTP, and email are required"
}
```

**Missing Authorization Header (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Valid session token required in Authorization header"
}
```

**Invalid or Expired Session Token (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Invalid or expired session token"
}
```

**Registration Already Complete (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "registration"
  },
  "message": "Registration already completed"
}
```

**Email Already Verified (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Email already verified for this account"
}
```

**Invalid OTP (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "otp"
  },
  "message": "Invalid OTP"
}
```

**OTP Expired (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "token"
  },
  "message": "OTP has expired. Please request a new one."
}
```

**Too Many Attempts (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "otp"
  },
  "message": "Too many failed attempts. Please try again later."
}
```

**Rate Limit Exceeded (429 Too Many Requests):**
```json
{
  "success": false,
  "errors": {
    "field": "email"
  },
  "message": "Too many verifyEmail attempts. Try again in 1234 seconds."
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "errors": {
    "code": "UNKNOWN_ERROR"
  },
  "message": "Failed to verify email. Please try again."
}
```

#### Rate Limiting
- **Limit**: 10 verify attempts per hour per email
- **Window**: 3600000 milliseconds (1 hour)
- **Response**: 429 Too Many Requests

---

### 5. Registration - Complete Profile

**Endpoint:** `POST /api/auth/register/completeProfile`

**Description:** Complete user profile information (Step 3 of registration, final step)

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `firstName` | string | body | Yes | User's first name (1-50 characters) |
| `lastName` | string | body | Yes | User's last name (1-50 characters) |
| `dob` | string | body | No | Date of birth (YYYY-MM-DD format) |
| `address` | string | body | No | Residential address |
| `city` | string | body | No | City name |
| `state` | string | body | No | State code |
| `pincode` | string | body | No | PIN code (6 digits) |
| `referralCode` | string | body | No | Referral code from existing user |
| `Authorization` | string | header | Yes | Bearer session token |

**Request Example:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "dob": "1990-01-15",
  "address": "123 Main Street",
  "city": "Delhi",
  "state": "DL",
  "pincode": "110001",
  "referralCode": "REF123456"
}
```

**Headers:**
```
Authorization: Bearer session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "uid": "a1b2c3d4e5f6g7h8i9j0",
    "firstName": "John",
    "lastName": "Doe",
    "email": "user@example.com",
    "phone": "9876543210",
    "dob": "1990-01-15",
    "address": "123 Main Street",
    "city": "Delhi",
    "state": "DL",
    "pincode": "110001",
    "registrationComplete": true,
    "step": 4,
    "message": "Profile completed"
  },
  "message": "Profile completed successfully"
}
```

#### Error Responses

**Missing Required Fields (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "required": ["firstName", "lastName"]
  },
  "message": "First name and last name are required"
}
```

**Invalid Name Length (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "firstName"
  },
  "message": "First name must be between 1-50 characters"
}
```

**Missing Authorization Header (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Valid session token required in Authorization header"
}
```

**Invalid or Expired Session Token (401 Unauthorized):**
```json
{
  "success": false,
  "errors": {
    "field": "Authorization"
  },
  "message": "Invalid or expired session token"
}
```

**Invalid Date Format (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "dob"
  },
  "message": "Invalid date format. Use YYYY-MM-DD"
}
```

**Invalid Pincode (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "pincode"
  },
  "message": "Pincode must be 6 digits"
}
```

**Invalid Referral Code (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "referralCode"
  },
  "message": "Invalid referral code"
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "errors": {
    "code": "UNKNOWN_ERROR"
  },
  "message": "Failed to complete profile. Please try again."
}
```

---

### 6. Registration Status Check

**Endpoint:** `GET /api/auth/status`

**Description:** Check user's current registration progress

#### Request Parameters

| Parameter | Type | Location | Required | Description |
|-----------|------|----------|----------|-------------|
| `phone` | string | query | Yes | Phone number to check status |

**Request Example:**
```
GET /api/auth/status?phone=9876543210
```

#### Response

**Success Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "uid": "a1b2c3d4e5f6g7h8i9j0",
    "currentStep": 4,
    "stepName": "profile_complete",
    "phoneVerified": true,
    "emailVerified": true,
    "email": "user@example.com",
    "firstName": "John",
    "isRegistrationComplete": true
  },
  "message": "Registration status retrieved"
}
```

**Field Descriptions:**
- `currentStep` (number): Registration step (0-4)
  - 0: not_started
  - 1: phone_verified
  - 2: email_added
  - 3: email_verified
  - 4: profile_complete
- `stepName` (string): Human-readable step name
- `phoneVerified` (boolean): Phone verification status
- `emailVerified` (boolean): Email verification status
- `isRegistrationComplete` (boolean): True if step 4 is complete

#### Error Responses

**Missing Phone (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "phone"
  },
  "message": "Phone number is required"
}
```

**Invalid Phone Format (400 Bad Request):**
```json
{
  "success": false,
  "errors": {
    "field": "phone"
  },
  "message": "Invalid phone number format"
}
```

**User Not Found (404 Not Found):**
```json
{
  "success": false,
  "errors": {
    "field": "phone"
  },
  "message": "User not found"
}
```

**Server Error (500 Internal Server Error):**
```json
{
  "success": false,
  "errors": {
    "code": "UNKNOWN_ERROR"
  },
  "message": "Failed to check status. Please try again."
}
```

---

## Authentication Flow Diagram

### Registration Flow:
```
1. POST /api/auth/phone/initiate
   ↓ (Returns token + purpose: "registration")
2. POST /api/auth/phone/verify
   ↓ (Returns sessionToken + uid)
3. POST /api/auth/register/addEmail
   ↓ (Returns email OTP token)
4. POST /api/auth/register/verifyEmail
   ↓ (Confirms email verification)
5. POST /api/auth/register/completeProfile
   ↓ (Completes registration)
6. Registration Complete ✓
```

### Login Flow:
```
1. POST /api/auth/phone/initiate
   ↓ (Returns token + purpose: "login")
2. POST /api/auth/phone/verify
   ↓ (Returns sessionToken + isLogin: true)
3. Login Complete ✓
```

### Status Check:
```
GET /api/auth/status?phone=9876543210
Returns current registration step
```

---

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| UNKNOWN_ERROR | 500 | Server error |
| OTP_EXPIRED | 400 | OTP validity period exceeded |
| INVALID_OTP | 400 | OTP does not match |
| TOO_MANY_ATTEMPTS | 429 | Too many failed attempts |
| INVALID_TOKEN | 400 | Token invalid or not found |

---

## Rate Limiting Summary

| Endpoint | Limit | Window | Status Code |
|----------|-------|--------|-------------|
| `/phone/initiate` | 5/hour | 1 hour | 429 |
| `/phone/verify` | 10/hour | 1 hour | 429 |
| `/register/addEmail` | 5/hour | 1 hour | 429 |
| `/register/verifyEmail` | 10/hour | 1 hour | 429 |

**Rate Limit Response Headers:**
- `Retry-After`: Seconds until retry is allowed
- Response includes `resetIn` field with remaining seconds

---

## Authentication Headers

All authenticated requests (after phone verification) require:

```
Authorization: Bearer <sessionToken>
```

**Example:**
```
GET /api/auth/status
Authorization: Bearer session_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Validation Rules

### Phone Number
- **Format**: Indian phone numbers only
- **Length**: Exactly 10 digits
- **Example**: 9876543210

### Email
- **Format**: Valid email format (RFC 5322)
- **Normalization**: Lowercase + trimmed
- **Example**: user@example.com

### OTP
- **Format**: 6-digit numeric string
- **Validity**: 10 minutes (600 seconds) from generation
- **Example**: "123456"

### Names
- **Length**: 1-50 characters
- **Allowed**: Letters, spaces, hyphens
- **Example**: "John", "Mary-Jane"

### PIN Code
- **Format**: 6-digit numeric string
- **Example**: "110001"

### DOB
- **Format**: YYYY-MM-DD
- **Example**: "1990-01-15"

---

## Testing with cURL

### 1. Initiate Phone OTP
```bash
curl -X POST http://localhost:3000/api/auth/phone/initiate \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'
```

### 2. Verify Phone OTP
```bash
curl -X POST http://localhost:3000/api/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "token_from_initiate",
    "otp": "123456",
    "phone": "9876543210"
  }'
```

### 3. Add Email
```bash
curl -X POST http://localhost:3000/api/auth/register/addEmail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sessionToken" \
  -d '{"email": "user@example.com"}'
```

### 4. Verify Email OTP
```bash
curl -X POST http://localhost:3000/api/auth/register/verifyEmail \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sessionToken" \
  -d '{
    "token": "token_from_add_email",
    "otp": "123456",
    "email": "user@example.com"
  }'
```

### 5. Complete Profile
```bash
curl -X POST http://localhost:3000/api/auth/register/completeProfile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sessionToken" \
  -d '{
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### 6. Check Status
```bash
curl -X GET "http://localhost:3000/api/auth/status?phone=9876543210"
```

---

## Response Format

All endpoints follow a consistent response format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Human-readable message"
}
```

**Error Response:**
```json
{
  "success": false,
  "errors": { /* error details */ },
  "message": "Error description"
}
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Phone numbers are automatically cleaned and normalized
- Email addresses are normalized to lowercase
- Session tokens expire after 7 days of inactivity (configurable)
- OTP tokens expire after 10 minutes (600 seconds)
- All database operations are transactional to prevent race conditions
- Device information is captured for security and login history
