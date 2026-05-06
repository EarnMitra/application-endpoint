const modeMiddleware = require('./modeMiddleware');
const responseMiddleware = require('./responseMiddleware');
const {
  databaseMiddleware,
  asyncDatabaseHandler,
  databaseLoggingMiddleware,
  databaseHealthMiddleware
} = require('./databaseMiddleware');

module.exports = {
  modeMiddleware,
  responseMiddleware,
  databaseMiddleware,
  asyncDatabaseHandler,
  databaseLoggingMiddleware,
  databaseHealthMiddleware
};
