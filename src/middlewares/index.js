const modeMiddleware = require('./modeMiddleware');
const responseMiddleware = require('./responseMiddleware');
const {
  databaseMiddleware,
  asyncDatabaseHandler,
  databaseLoggingMiddleware,
  databaseHealthMiddleware
} = require('./databaseMiddleware');
const otpMiddleware = require('./otpMiddleware');
const sessionMiddleware = require('./sessionMiddleware');

module.exports = {
  modeMiddleware,
  responseMiddleware,
  databaseMiddleware,
  asyncDatabaseHandler,
  databaseLoggingMiddleware,
  databaseHealthMiddleware,
  otpMiddleware,
  sessionMiddleware
};
