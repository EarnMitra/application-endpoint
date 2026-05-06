/**
 * Authentication Routes Index
 * Combines all auth-related routes
 * Base path: /api/auth
 */

const express = require('express');
const router = express.Router();

// Import route modules
const phoneRoutes = require('./phone');
const registrationRoutes = require('./registration');
const statusRoutes = require('./status');

// Documentation
/**
 * Auth API Routes:
 * 
 * Phone OTP (Auto-detects Registration vs Login):
 * - POST /api/auth/phone/initiate
 *   Body: { phone: "9876543210" }
 *   Auto-detects: If phone exists → Login, If not → Registration
 * 
 * - POST /api/auth/phone/verify
 *   Body: { token: "...", otp: "123456", phone: "9876543210" }
 *   Auto-detects: If phone exists → Login with history, If not → Create account
 * 
 * Registration Flow (after phone verification):
 * - POST /api/auth/register/add-email - Add email
 * - POST /api/auth/register/verify-email - Verify email OTP
 * - POST /api/auth/register/complete-profile - Complete profile info
 * 
 * Status Check:
 * - GET /api/auth/status?phone=9876543210 - Check registration progress
 */

// Phone OTP routes - handles both registration and login
router.use('/phone', phoneRoutes);

// Registration routes - all endpoints under /register (after phone verification)
router.use('/register', registrationRoutes);

// Status routes
router.use('/', statusRoutes);

module.exports = router;
