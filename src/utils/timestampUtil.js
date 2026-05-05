/**
 * Timestamp Utility
 * Provides various timestamp formats for API responses
 */

class TimestampUtil {
  /**
   * Get ISO format timestamp (default)
   * Format: 2026-05-03T12:45:00.000Z
   */
  static getISO() {
    return new Date().toISOString();
  }

  /**
   * Get Unix timestamp (milliseconds)
   * Format: 1714756500000
   */
  static getUnix() {
    return Date.now();
  }

  /**
   * Get Unix timestamp (seconds)
   * Format: 1714756500
   */
  static getUnixSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  /**
   * Get readable format
   * Format: 2026-05-03 12:45:00
   */
  static getReadable() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get full readable format with milliseconds
   * Format: 2026-05-03 12:45:00.123
   */
  static getReadableWithMs() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');

    return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}.${ms}`;
  }

  /**
   * Get date only
   * Format: 2026-05-03
   */
  static getDateOnly() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${date}`;
  }

  /**
   * Get time only
   * Format: 12:45:00
   */
  static getTimeOnly() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Get custom format
   * @param {string} format - Format string (YYYY, MM, DD, HH, mm, ss, ms)
   */
  static getCustom(format = 'YYYY-MM-DD HH:mm:ss') {
    const now = new Date();
    
    let result = format;
    result = result.replace('YYYY', now.getFullYear());
    result = result.replace('MM', String(now.getMonth() + 1).padStart(2, '0'));
    result = result.replace('DD', String(now.getDate()).padStart(2, '0'));
    result = result.replace('HH', String(now.getHours()).padStart(2, '0'));
    result = result.replace('mm', String(now.getMinutes()).padStart(2, '0'));
    result = result.replace('ss', String(now.getSeconds()).padStart(2, '0'));
    result = result.replace('ms', String(now.getMilliseconds()).padStart(3, '0'));

    return result;
  }

  /**
   * Get all timestamp formats
   */
  static getAll() {
    return {
      iso: this.getISO(),
      unix: this.getUnix(),
      unixSeconds: this.getUnixSeconds(),
      readable: this.getReadable(),
      readableWithMs: this.getReadableWithMs(),
      dateOnly: this.getDateOnly(),
      timeOnly: this.getTimeOnly()
    };
  }
}

module.exports = TimestampUtil;
