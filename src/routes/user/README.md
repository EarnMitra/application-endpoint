# User Routes

User profile and account management endpoints.

## Endpoints

### 1. Get All User Details
- **Route**: `GET /api/user/details`
- **Authentication**: Required (Bearer Token)
- **Headers**: 
  ```
  Authorization: Bearer <session_token>
  ```

**Response (User Complete):**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "User details fetched successfully",
  "data": {
    "user": {
      "uid": "user123",
      "username": "john_doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "firstName": "John",
      "lastName": "Doe",
      "middleName": "Michael",
      "gender": "male",
      "dateOfBirth": "1990-01-15",
      "profilePicture": "url",
      "phoneVerified": true,
      "emailVerified": true,
      "registrationStep": 5,
      "status": "active",
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-15T15:30:00Z"
    },
    "profile": {
      "referralCode": "AB12CD34",
      "occupation": "self-employed",
      "yearsOfExperience": 5,
      "languages": "English, Hindi",
      "cityOfOperation": "Delhi",
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-15T15:30:00Z"
    },
    "wallet": {
      "walletId": "wallet123",
      "balance": 5000.00,
      "currency": "INR",
      "totalCredited": 10000.00,
      "totalDebited": 5000.00,
      "coinsBalance": 500,
      "totalCoinsEarned": 1000,
      "totalCoinsSpent": 500,
      "pendingWithdrawal": 1000.00,
      "totalWithdrawn": 2000.00,
      "monthlyBonus": 500.00,
      "freezeAmount": 0,
      "status": "active",
      "statusMessage": null,
      "lastTransactionAt": "2025-01-15T15:30:00Z"
    },
    "bankAccount": {
      "bid": "bank123",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234",
      "bankName": "State Bank of India",
      "branchName": "Delhi Main",
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-15T15:30:00Z"
    },
    "kyc": {
      "kycId": "kyc123",
      "panNumber": "ABCDE1234F",
      "panImageUrl": "url",
      "aadhaarNumber": "123456789012",
      "aadhaarFrontImageUrl": "url",
      "aadhaarBackImageUrl": "url",
      "kycSelfieUrl": "url",
      "kycVideoUrl": "url",
      "faceMatchScore": 95.5,
      "fullAddress": "123 Main St, Delhi",
      "city": "Delhi",
      "state": "Delhi",
      "postalCode": "110001",
      "country": "India",
      "kycStatus": "verified",
      "verificationNotes": null,
      "verifiedAt": "2025-01-15T15:30:00Z",
      "submittedAt": "2025-01-01T10:00:00Z",
      "createdAt": "2025-01-01T10:00:00Z",
      "updatedAt": "2025-01-15T15:30:00Z"
    },
    "lastLogin": {
      "loginHistoryId": "lh123",
      "status": "success",
      "ipAddress": "192.168.1.1",
      "deviceName": "iPhone 14",
      "osType": "iOS",
      "browserType": "Safari",
      "location": "Delhi, India",
      "latitude": 28.6139,
      "longitude": 77.2090,
      "loginAt": "2025-01-15T15:30:00Z",
      "logoutAt": null
    },
    "verificationHistory": [
      {
        "vid": "v1",
        "type": "mobile",
        "targetValue": "9876543210",
        "isVerified": true,
        "deviceName": "iPhone 14",
        "osType": "iOS",
        "browserType": "Safari",
        "ipAddress": "192.168.1.1",
        "location": "Delhi, India",
        "verifiedAt": "2025-01-01T10:00:00Z"
      }
    ]
  },
  "timestamp": "2025-01-16T10:30:00Z"
}
```

**Response (User Stuck at Step):**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Registration incomplete. User stuck at 2",
  "data": {
    "uid": "user123",
    "registration_status": {
      "currentStep": 2,
      "stepInfo": {
        "step": "email_added",
        "description": "Email added",
        "nextStep": "verify_email",
        "required": ["email_verified"]
      },
      "isStuck": true,
      "status": "pending",
      "phoneVerified": true,
      "emailVerified": false,
      "message": "User is at step 2: Email added"
    }
  },
  "timestamp": "2025-01-16T10:30:00Z"
}
```

**Error Response:**
```json
{
  "status": "error",
  "statusCode": 401,
  "message": "Invalid or expired session token",
  "errors": {
    "field": "Authorization"
  },
  "timestamp": "2025-01-16T10:30:00Z"
}
```

---

### 2. Get Registration Status
- **Route**: `GET /api/user/registration-status`
- **Authentication**: Required (Bearer Token)
- **Headers**: 
  ```
  Authorization: Bearer <session_token>
  ```

**Response:**
```json
{
  "status": "success",
  "statusCode": 200,
  "message": "Registration status fetched successfully",
  "data": {
    "currentStep": 5,
    "stepInfo": {
      "step": "kyc_submitted",
      "description": "KYC submitted",
      "nextStep": "kyc_verification"
    },
    "isStuck": false,
    "status": "active",
    "phoneVerified": true,
    "emailVerified": true,
    "message": "User registration is complete"
  },
  "timestamp": "2025-01-16T10:30:00Z"
}
```

---

## Registration Steps

| Step | Status | Description | Requirements |
|------|--------|-------------|--------------|
| 0 | not_started | Registration not started | - |
| 1 | phone_verified | Phone verified | phone_verified = true |
| 2 | email_added | Email added | email exists |
| 3 | email_verified | Email verified | email_verified = true |
| 4 | profile_completed | Profile completed | first_name, last_name, gender, date_of_birth |
| 5 | kyc_submitted | KYC submitted | KYC document submitted |

---

## Helper Functions

### `validateSessionToken(db, token)`
Validates a session token and returns the user ID if valid.

### `getRegistrationStatus(user)`
Determines the current registration step and whether the user is stuck.

### `fetchUserProfile(db, userId)`
Fetches user profile information including referral code and provider details.

### `fetchWalletInfo(db, userId)`
Fetches wallet information including balance, coins, and transaction history.

### `fetchBankAccount(db, userId)`
Fetches user's bank account details.

### `fetchKYCInfo(db, userId)`
Fetches KYC document information and verification status.

### `fetchLastLogin(db, userId)`
Fetches the most recent login record.

### `fetchVerificationHistory(db, userId)`
Fetches up to 10 most recent verification records (phone/email).

---

## Error Codes

| Code | Status | Message |
|------|--------|---------|
| 401 | Unauthorized | Invalid or expired session token |
| 404 | Not Found | User not found |
| 500 | Server Error | Failed to fetch user details |

---

## Notes

- Device information is tracked during phone verification and stored in `user_verified` table
- User status can be: `active`, `inactive`, `suspended`, `deleted`, `pending`, `inreview`
- When a user is stuck at any registration step, the endpoint returns step information instead of complete user details
- All monetary values are in the specified currency (default: INR)
- Sensitive information like password hashes and security tokens are not returned
