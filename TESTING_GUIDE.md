# API Testing Guide

## Files Overview

### 1. **API_TESTER.html** (Updated)
Manual endpoint testing interface with:
- **New User Endpoints**:
  - `GET /api/user/details` - Fetch all user details
  - `GET /api/user/registrationStatus` - Check registration status

- **Features**:
  - Quick endpoint selector
  - Auto-injection of Bearer tokens
  - Request/Response logging
  - Session token management
  - Cookie capture and replay

**How to use**: Open in browser and manually test endpoints with session handling

---

### 2. **TEST_FLOW.html** (New) - Automated Full Flow
Comprehensive automated testing that goes through the entire user lifecycle with **automatic session and bearer token management**.

---

## TEST_FLOW.html - Automated Testing

### Features
✅ **Automatic OTP Handling** - Waits for manual OTP entry at each step  
✅ **Session Auto-Management** - Captures and injects bearer tokens automatically  
✅ **Bearer Token Auto-Injection** - Uses stored tokens for protected endpoints  
✅ **Request/Response Logging** - Console logging of all requests and responses  
✅ **Step-by-Step Execution** - Runs through complete registration and data retrieval flow  
✅ **Session Info Display** - Shows current token, user ID, and status in real-time  

### Complete Flow (7 Steps)

| Step | Endpoint | Method | Description | Requires OTP |
|------|----------|--------|-------------|--------------|
| 1 | `/api/auth/phone/initiate` | POST | Initiate phone verification | No |
| 2 | `/api/auth/phone/verify` | POST | Verify phone with OTP | **YES** |
| 3 | `/api/auth/register/addEmail` | POST | Add email to account | No |
| 4 | `/api/auth/register/verifyEmail` | POST | Verify email with OTP | **YES** |
| 5 | `/api/auth/register/completeProfile` | POST | Complete user profile | No |
| 6 | `/api/user/registrationStatus` | GET | Check registration status | No |
| 7 | `/api/user/details` | GET | Fetch all user details | No |

### How to Use

1. **Open TEST_FLOW.html** in your browser
2. **Configure Settings**:
   - Base URL: `http://127.0.0.1:5000` (adjust if needed)
   - Phone Number: `9876543210` (or your test number)
   - Email: `testuser@example.com`
   - First Name: `John`

3. **Click "▶ Start Full Flow"**

4. **When OTP Modal Appears**:
   - Check your email or app console for OTP
   - Enter 6-digit OTP
   - Click Submit or press Enter

5. **Monitor Progress**:
   - Each step shows status (pending/completed/failed)
   - Session token and user ID displayed in real-time
   - Full request/response logged to browser console

### Response Handling

#### If User is Stuck in Registration
**Step 6 Response**:
```json
{
  "status": "success",
  "data": {
    "uid": "user123",
    "registration_status": {
      "currentStep": 3,
      "stepInfo": {
        "step": "email_verified",
        "description": "Email verified",
        "nextStep": "complete_profile"
      },
      "isStuck": true,
      "message": "User is at step 3: Email verified"
    }
  }
}
```

#### If User is Complete
**Step 7 Response**:
```json
{
  "status": "success",
  "data": {
    "user": {
      "uid": "user123",
      "email": "testuser@example.com",
      "phone": "9876543210",
      "registrationStep": 5,
      "status": "active"
    },
    "profile": {
      "referralCode": "AB12CD34",
      "occupation": "self-employed",
      "yearsOfExperience": 5
    },
    "wallet": {
      "balance": 5000.00,
      "coinsBalance": 500,
      "status": "active"
    },
    "bankAccount": {
      "accountNumber": "1234567890",
      "bankName": "State Bank of India"
    },
    "kyc": {
      "kycStatus": "verified",
      "faceMatchScore": 95.5
    }
  }
}
```

---

## Session & Bearer Token Flow

### Auto-Capture Mechanism

**Step 2 (Phone Verify)**:
```
Response includes: session_token, refresh_token, uid
↓
Automatically stored in flowState
↓
Used in all subsequent requests as Bearer token
```

### Request Headers Auto-Generated

```javascript
// Steps 1-2 (Phone verification)
Headers: {
  'Content-Type': 'application/json'
}

// Steps 3-7 (After phone verification)
Headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIs...' // Auto-injected
}
```

---

## OTP Handling

### Automatic OTP Prompts

The system will pause and show an OTP modal at:
1. **Step 2**: Phone verification OTP
2. **Step 4**: Email verification OTP

### Where to Find OTP

- **Phone OTP**: Check server console/terminal (printed when OTP is sent)
- **Email OTP**: Check your email inbox

### Manual Entry

1. Wait for OTP modal to appear
2. Enter 6-digit code
3. Click "Submit" or press Enter
4. Flow continues automatically

---

## Console Logging

All requests/responses are logged to browser console:

```javascript
📨 POST /api/auth/phone/initiate
Request Headers: {Content-Type: "application/json"}
Request Body: {phone: "9876543210"}
Response Status: 200
Response Data: {status: "success", token: "..."}

📨 POST /api/auth/phone/verify
Request Headers: {
  Content-Type: "application/json"
}
Request Body: {token: "...", otp: "123456", phone: "9876543210"}
Response Status: 200
Response Data: {session_token: "...", uid: "user123", ...}
```

---

## Troubleshooting

### Issue: OTP Modal Doesn't Appear
- **Cause**: Flow might have failed on previous step
- **Solution**: Check status of previous step; look for error message

### Issue: "Bearer Token Not Injected"
- **Cause**: Phone verification failed or token wasn't captured
- **Solution**: Complete phone verification successfully first

### Issue: Step 7 Returns "User Stuck at Step X"
- **Cause**: User is in the middle of registration
- **Solution**: This is expected behavior - user hasn't completed all steps yet

### Issue: Database Connection Error
- **Cause**: Backend server not running
- **Solution**: Start the server with `yarn dev` in another terminal

---

## API Endpoint Details

### GET /api/user/details
Requires: Bearer token  
Returns: Complete user profile including:
- User basic info
- Profile details
- Wallet information
- Bank account
- KYC status
- Last login info
- Verification history

**Check Status**:
- If `isStuck: true` → User in middle of registration
- If `status: "active"` → User fully registered

### GET /api/user/registration-status
Requires: Bearer token  
Returns: Current step, step info, and whether user is stuck

---

## Testing Checklist

- [ ] Flow starts successfully
- [ ] Phone OTP modal appears after step 1
- [ ] Phone OTP submitted and verified
- [ ] Session token captured and displayed
- [ ] Email OTP modal appears after step 3
- [ ] Email OTP submitted and verified
- [ ] Registration status endpoint returns correct step
- [ ] User details endpoint returns full profile
- [ ] All request/response logged to console
- [ ] Bearer token auto-injected for protected endpoints

---

## Files Structure

```
/src/routes/user/
├── index.js          (Main router - connects all routes)
├── details.js        (User details endpoint)
├── status.js         (Registration status endpoint)
├── helpers.js        (Helper functions & database queries)
└── README.md         (Endpoint documentation)

/
├── API_TESTER.html   (Manual testing interface)
├── TEST_FLOW.html    (Automated flow tester)
└── index.js          (Updated with user routes)
```

---

## Quick Commands

**Start Server**:
```bash
yarn dev
```

**Test Manual**:
- Open `API_TESTER.html` in browser

**Test Automated**:
- Open `TEST_FLOW.html` in browser

**Check Logs**:
- Open browser DevTools (F12)
- Go to Console tab
- Trigger flow and watch real-time logs
