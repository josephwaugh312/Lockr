const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'lockr-backend' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log') 
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Security alert levels
const SECURITY_ALERT_LEVELS = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Security alert notifications (placeholder for webhook/email integration)
const sendSecurityAlert = (level, message, metadata = {}) => {
  const alert = {
    level,
    message,
    metadata,
    timestamp: new Date().toISOString(),
    service: 'lockr-backend'
  };

  // Log the security alert
  logger.warn('SECURITY ALERT', alert);

  // In production, this would send to monitoring systems like:
  // - Slack webhook
  // - Email notifications
  // - Security monitoring tools
  // - PagerDuty for critical alerts
  
  if (level === SECURITY_ALERT_LEVELS.CRITICAL) {
    console.error('🚨 CRITICAL SECURITY ALERT:', alert);
  } else if (level === SECURITY_ALERT_LEVELS.HIGH) {
    console.warn('⚠️ HIGH SECURITY ALERT:', alert);
  } else if (level === SECURITY_ALERT_LEVELS.MEDIUM) {
    console.warn('⚠️ MEDIUM SECURITY ALERT:', alert);
  }
};

// Security event tracking
const securityEvents = {
  // Failed authentication attempts
  failedLogin: (userId, ip, reason) => {
    const metadata = { userId, ip, reason };
    logger.warn('Failed login attempt', metadata);
    
    // Track failed attempts for alerting
    const key = `failed_login_${ip}`;
    const attempts = (securityEvents._failedAttempts[key] || 0) + 1;
    securityEvents._failedAttempts[key] = attempts;
    
    if (attempts >= 5) {
      sendSecurityAlert(SECURITY_ALERT_LEVELS.HIGH, 'Multiple failed login attempts detected', {
        ip,
        attempts,
        timeframe: '15 minutes'
      });
    }
  },

  // Failed vault unlock attempts
  failedVaultUnlock: (userId, ip) => {
    const metadata = { userId, ip };
    logger.warn('Failed vault unlock attempt', metadata);
    
    const key = `failed_vault_${userId}`;
    const attempts = (securityEvents._failedVaultAttempts[key] || 0) + 1;
    securityEvents._failedVaultAttempts[key] = attempts;
    
    if (attempts >= 3) {
      sendSecurityAlert(SECURITY_ALERT_LEVELS.MEDIUM, 'Multiple failed vault unlock attempts', {
        userId,
        ip,
        attempts
      });
    }
  },

  // Suspicious activity
  suspiciousActivity: (type, userId, ip, details) => {
    logger.error('Suspicious activity detected', { type, userId, ip, details });
    sendSecurityAlert(SECURITY_ALERT_LEVELS.HIGH, `Suspicious activity: ${type}`, {
      userId,
      ip,
      details
    });
  },

  // Rate limit violations
  rateLimitViolation: (ip, endpoint, attempts) => {
    logger.warn('Rate limit violation', { ip, endpoint, attempts });
    
    if (attempts > 20) {
      sendSecurityAlert(SECURITY_ALERT_LEVELS.MEDIUM, 'High rate limit violation detected', {
        ip,
        endpoint,
        attempts
      });
    }
  },

  // Data corruption detected
  dataCorruption: (userId, entryId, error) => {
    logger.error('Data corruption detected', { userId, entryId, error });
    sendSecurityAlert(SECURITY_ALERT_LEVELS.HIGH, 'Vault data corruption detected', {
      userId,
      entryId,
      error: error.message
    });
  },

  // Critical system events
  criticalEvent: (event, details) => {
    logger.error('Critical security event', { event, details });
    sendSecurityAlert(SECURITY_ALERT_LEVELS.CRITICAL, `Critical event: ${event}`, details);
  },

  // Master password reset with vault data wipe
  masterPasswordReset: (userId, email, entriesWiped, ip) => {
    logger.error('Master password reset - vault data wiped', { 
      userId, 
      email, 
      entriesWiped, 
      ip,
      timestamp: new Date().toISOString()
    });
    sendSecurityAlert(SECURITY_ALERT_LEVELS.CRITICAL, 'Master password reset completed - all vault data permanently deleted', {
      userId,
      email,
      entriesWiped,
      ip,
      action: 'vault_data_wipe'
    });
  },

  // Storage for tracking attempts
  _failedAttempts: {},
  _failedVaultAttempts: {},

  // Clear old tracking data (call periodically)
  clearOldAttempts: () => {
    securityEvents._failedAttempts = {};
    securityEvents._failedVaultAttempts = {};
  },

  // Clear the cleanup timer (for testing)
  clearTimer: () => {
    if (securityEvents._cleanupTimer) {
      clearInterval(securityEvents._cleanupTimer);
      securityEvents._cleanupTimer = null;
    }
  }
};

// Only start cleanup timer outside of test environment
if (process.env.NODE_ENV !== 'test') {
  // Clear attempt tracking every 15 minutes
  securityEvents._cleanupTimer = setInterval(securityEvents.clearOldAttempts, 15 * 60 * 1000);
}

module.exports = {
  logger,
  securityEvents,
  sendSecurityAlert,
  SECURITY_ALERT_LEVELS
}; 