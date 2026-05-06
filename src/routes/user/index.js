/**
 * User Routes
 * Main router file that connects all user-related routes
 */

const express = require('express');
const router = express.Router();
const detailsRoutes = require('./details');
const statusRoutes = require('./status');

// Mount route handlers
router.use(detailsRoutes);
router.use(statusRoutes);

module.exports = router;
