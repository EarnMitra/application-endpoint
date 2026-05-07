# EarnMitra - Income Generation Platform API

A comprehensive Node.js/Express API server for the EarnMitra income generation platform with multi-step user registration, OTP verification, wallet management, and KYC verification.

## 📋 Project Overview

EarnMitra is a modern income generation platform that enables users to earn money through various tasks, referrals, and training programs. This repository contains the backend API server that powers the platform.

### Key Features
- **Multi-Step User Registration** - Phone OTP → Email Verification → Profile Completion
- **Secure Authentication** - Session-based auth with refresh tokens and device tracking
- **Wallet System** - Balance management with transaction history and coin rewards
- **KYC Verification** - Document upload and face recognition for compliance
- **Referral System** - User referral codes and referral history tracking
- **Provider Management** - Affiliate provider accounts and pitch management
- **Training Module** - Training sessions, videos, and trainer accounts
- **Geographic Features** - State, city, and pincode master data
- **Admin Dashboard** - Role-based admin accounts with permission management
- **Rate Limiting** - Built-in protection against brute force attacks
- **Device Tracking** - Login history with device and location information

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- PostgreSQL 12+
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd earnmitra
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your database and configuration details
```

4. **Initialize the database**
```bash
# Option 1: Using Python script
cd database
python main.py

# Option 2: Direct PostgreSQL
psql -U postgres -d earnmitra_db < database/schema_merged.sql
```

5. **Start the server**
```bash
npm start
```

The API server will be running at `http://localhost:5000`

---

## 📂 Project Structure

```
earnmitra/
├── src/
│   ├── config/              # Configuration files
│   │   ├── appConfig.js      # App initialization
│   │   └── databaseConfig.js # Database setup & pool
│   ├── middlewares/          # Express middlewares
│   │   ├── responseMiddleware.js    # Standardized responses
│   │   ├── modeMiddleware.js        # Mode detection
│   │   ├── sessionMiddleware.js     # Session management
│   │   ├── databaseMiddleware.js    # DB connection
│   │   └── otpMiddleware.js         # OTP handling
│   ├── routes/               # API endpoints
│   │   ├── auth/             # Authentication routes
│   │   │   ├── phone.js           # Phone OTP endpoints
│   │   │   ├── registration.js    # Registration endpoints
│   │   │   ├── refresh.js         # Token refresh
│   │   │   └── status.js          # Registration status
│   │   └── user/             # User profile routes
│   │       ├── details.js         # User profile endpoint
│   │       └── status.js          # Registration status
│   └── utils/                # Utility functions
│       ├── timestampUtil.js       # Timestamp formatting
│       └── terminalCommands.js    # CLI commands
├── database/                 # Database schema
│   ├── 01_functions_and_extensions.sql
│   ├── 02_users.sql
│   ├── 03_admin_accounts.sql
│   ├── 04_kyc_bank_wallet.sql
│   ├── 05_transactions_and_coins.sql
│   └── ... (more schema files)
├── server.js                 # Main server entry point
├── package.json              # Dependencies
└── .env                      # Environment variables
```

---

## 🔌 API Endpoints

### Authentication

#### Phone OTP
- `POST /api/auth/phone/initiate` - Initiate phone OTP
- `POST /api/auth/phone/verify` - Verify phone OTP

#### Registration
- `POST /api/auth/register/addEmail` - Add email to account
- `POST /api/auth/register/verifyEmail` - Verify email OTP
- `POST /api/auth/register/completeProfile` - Complete profile

#### Token Management
- `POST /api/auth/refreshToken` - Refresh session token
- `GET /api/auth/status` - Check registration status

### User Profile
- `GET /api/user/details` - Get user profile details
- `GET /api/user/registrationStatus` - Get registration progress

---

## 📝 API Documentation

Detailed API documentation available in respective README files:

- [Authentication Routes](./src/routes/auth/README.md) - Phone OTP, registration, token refresh
- [User Routes](./src/routes/user/README.md) - User profile and registration status
- [Middlewares](./src/middlewares/README.md) - Mode, response, session middlewares
- [Database Schema](./database/README.md) - Database structure and setup
- [Testing Guide](./TESTING_GUIDE.md) - Manual and automated API testing

---

## 🧪 Testing

### Automated Testing
Open `TEST_FLOW.html` in your browser for automated full flow testing with automatic token management.

### Manual Testing
Use `API_TESTER.html` for manual endpoint testing with quick selection and request building.

### cURL Testing
```bash
# Initiate phone OTP
curl -X POST http://localhost:5000/api/auth/phone/initiate \
  -H "Content-Type: application/json" \
  -d '{"phone": "9876543210"}'

# Verify phone OTP
curl -X POST http://localhost:5000/api/auth/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "...", "otp": "123456", "phone": "9876543210"}'
```

---

## ⚙️ Configuration

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=earnmitra_db
DB_USER=postgres
DB_PASSWORD=your_password
DB_POOL_MIN=2
DB_POOL_MAX=10

# OTP
OTP_EXPIRATION_SECONDS=600          # 10 minutes
OTP_RESEND_DELAY_SECONDS=60         # 1 minute

# Session
SESSION_EXPIRATION_SECONDS=86400    # 1 day
SESSION_INACTIVITY_TIMEOUT=604800   # 7 days

# Rate Limiting
RATE_LIMIT_WINDOW_MS=3600000        # 1 hour
RATE_LIMIT_MAX_ATTEMPTS=5           # Per window
```

---

## 🔒 Security Features

- **Rate Limiting** - Protects against brute force attacks
- **Session Tokens** - JWT-like tokens with expiration
- **Refresh Tokens** - Long-lived tokens for session renewal
- **Device Tracking** - Detects and logs login devices
- **Email & Phone Verification** - OTP-based verification
- **Password Hashing** - Secure password storage with bcrypt
- **CORS Configuration** - Controlled cross-origin access
- **SQL Injection Protection** - Parameterized queries

---

## 📊 Database

The platform uses PostgreSQL with a modular schema split into 17 organized files:

- **Core**: Functions, extensions, utilities
- **Users**: User accounts, sessions, verification
- **Admin**: Admin accounts and role management
- **Financial**: Wallets, KYC, bank accounts, transactions
- **Providers**: Provider management and affiliate system
- **Geo**: Geographic master tables
- **Products**: Product and service data
- **Training**: Training sessions and videos
- **Referral**: User referral system
- **Support**: FAQ, feedback, notifications

---

## 🛠️ Development

### Terminal Commands

While the server is running, you can use these commands:

```
> help                  # Show all available commands
> health                # Server health status
> db                    # Database connection status
> mem                   # Memory usage details
> quit                  # Gracefully shutdown
```

### Logging

- Debug logs in development mode
- Request/response logging
- Database query logging
- Error tracking with context

---

## 📈 Performance Optimizations

- **Connection Pooling** - PostgreSQL connection pool (2-10 connections)
- **Query Caching** - 5-second cache for SELECT queries
- **Keep-Alive** - TCP keep-alive for connection stability
- **Response Compression** - Gzip compression for bandwidth
- **Health Checks** - Periodic database health monitoring

---

## 🤝 Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 👥 Author

**SK Sharma** - Lead Developer

---

## 📞 Support

For issues, questions, or feature requests, please contact the development team.

---

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Phone OTP authentication
- Multi-step registration
- User profile management
- Wallet system
- KYC verification
