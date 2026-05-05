/**
 * Response Middleware
 * Handles all types of API responses including:
 * - Success/Error responses
 * - Pagination with metadata
 * - Different data formats (list, object, nested)
 * - Filtering, sorting, search
 * - Rate limiting, caching headers
 * - Custom response formats
 */

const TimestampUtil = require('../utils/timestampUtil');

const responseMiddleware = (req, res, next) => {
  // Get timestamp format preference from query or env
  const timestampFormat = req.query.timestamp_format || process.env.TIMESTAMP_FORMAT || 'readable';
  
  // Helper function to get timestamp
  const getTimestamp = () => {
    switch (timestampFormat) {
      case 'iso':
        return TimestampUtil.getISO();
      case 'unix':
        return TimestampUtil.getUnix();
      case 'unix_seconds':
        return TimestampUtil.getUnixSeconds();
      case 'readable':
        return TimestampUtil.getReadable();
      case 'readable_ms':
        return TimestampUtil.getReadableWithMs();
      case 'date_only':
        return TimestampUtil.getDateOnly();
      case 'time_only':
        return TimestampUtil.getTimeOnly();
      default:
        return TimestampUtil.getReadable();
    }
  };

  res.success = (data, message = 'Success', statusCode = 200, meta = {}) => {
    return res.status(statusCode).json({
      status: 'success',
      statusCode,
      message,
      data,
      ...(Object.keys(meta).length > 0 && { meta }),
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.paginated = (items, total, page = 1, pageSize = 10, message = 'Data retrieved successfully', statusCode = 200, filters = {}) => {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.status(statusCode).json({
      status: 'success',
      statusCode,
      message,
      data: items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage,
        hasPrevPage,
        startIndex: (page - 1) * pageSize + 1,
        endIndex: Math.min(page * pageSize, total)
      },
      ...(Object.keys(filters).length > 0 && { filters }),
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.filtered = (data, filterInfo = {}, sortInfo = {}, message = 'Filtered data retrieved', statusCode = 200) => {
    return res.status(statusCode).json({
      status: 'success',
      statusCode,
      message,
      data,
      metadata: {
        filters: filterInfo,
        sorting: sortInfo,
        resultCount: Array.isArray(data) ? data.length : 1
      },
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.list = (items, total = null, message = 'List retrieved successfully', statusCode = 200, metadata = {}) => {
    const response = {
      status: 'success',
      statusCode,
      message,
      data: items,
      count: Array.isArray(items) ? items.length : 0,
      ...(total !== null && { total }),
      ...(Object.keys(metadata).length > 0 && { metadata }),
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    };
    return res.status(statusCode).json(response);
  };

  res.error = (message = 'Error', statusCode = 400, errors = null, errorCode = null) => {
    const response = {
      status: 'error',
      statusCode,
      message,
      timestamp: getTimestamp(),
      ...(errorCode && { errorCode }),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    };
    if (errors) {
      response.errors = errors;
    }
    return res.status(statusCode).json(response);
  };

  res.validationError = (validationErrors, message = 'Validation failed') => {
    return res.status(422).json({
      status: 'error',
      statusCode: 422,
      message,
      errors: validationErrors,
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.created = (data, message = 'Resource created successfully', resourceId = null) => {
    const response = {
      status: 'success',
      statusCode: 201,
      message,
      data,
      timestamp: getTimestamp(),
      ...(resourceId && { resourceId }),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    };
    return res.status(201).json(response);
  };

  res.updated = (data, message = 'Resource updated successfully') => {
    return res.status(200).json({
      status: 'success',
      statusCode: 200,
      message,
      data,
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.deleted = (message = 'Resource deleted successfully', deletedData = null) => {
    const response = {
      status: 'success',
      statusCode: 200,
      message,
      timestamp: getTimestamp(),
      ...(deletedData && { data: deletedData }),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    };
    return res.status(200).json(response);
  };

  res.search = (results, total, query, message = 'Search results retrieved', statusCode = 200) => {
    return res.status(statusCode).json({
      status: 'success',
      statusCode,
      message,
      search: {
        query,
        resultsCount: results.length,
        totalResults: total
      },
      data: results,
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.bulk = (successful = [], failed = [], message = 'Bulk operation completed') => {
    return res.status(200).json({
      status: failed.length > 0 ? 'partial' : 'success',
      statusCode: 200,
      message,
      results: {
        successful: successful.length,
        failed: failed.length,
        total: successful.length + failed.length
      },
      data: {
        successful,
        ...(failed.length > 0 && { failed })
      },
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.notFound = (message = 'Resource not found', resource = null) => {
    return res.status(404).json({
      status: 'error',
      statusCode: 404,
      message,
      ...(resource && { resource }),
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.unauthorized = (message = 'Unauthorized access') => {
    return res.status(401).json({
      status: 'error',
      statusCode: 401,
      message,
      errorCode: 'UNAUTHORIZED',
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.forbidden = (message = 'Access forbidden') => {
    return res.status(403).json({
      status: 'error',
      statusCode: 403,
      message,
      errorCode: 'FORBIDDEN',
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.serverError = (message = 'Internal server error', errorDetails = null) => {
    const response = {
      status: 'error',
      statusCode: 500,
      message,
      errorCode: 'INTERNAL_SERVER_ERROR',
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    };
    if (errorDetails && req.appMode !== 'production') {
      response.details = errorDetails;
    }
    return res.status(500).json(response);
  };

  res.rateLimited = (retryAfter = 60) => {
    res.set('Retry-After', retryAfter);
    return res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter,
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  res.custom = (statusCode, responseBody) => {
    return res.status(statusCode).json({
      ...responseBody,
      timestamp: getTimestamp(),
      ...(req.appMode !== 'production' && { mode: req.appMode })
    });
  };

  next();
};

module.exports = responseMiddleware;
