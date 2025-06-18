const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Import database
const database = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const vaultRoutes = require('./routes/vault');
const notificationRoutes = require('./routes/notifications');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  },
  hsts: {
    maxAge: parseInt(process.env.HSTS_MAX_AGE) || 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// Body parsing middleware with secure size limits
const jsonLimit = process.env.JSON_LIMIT || '1mb';  // Reduced from 10mb for security
const urlencodedLimit = process.env.URLENCODED_LIMIT || '1mb';  // More reasonable default

app.use(express.json({ 
  limit: jsonLimit,
  verify: (req, res, buf, encoding) => {
    // Additional validation for request size
    if (buf.length > (parseInt(process.env.MAX_REQUEST_SIZE) || 1024 * 1024)) { // 1MB default
      const error = new Error('Request entity too large');
      error.status = 413;
      throw error;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: urlencodedLimit,
  parameterLimit: parseInt(process.env.PARAMETER_LIMIT) || 100, // Limit number of parameters
  verify: (req, res, buf, encoding) => {
    // Additional validation for request size
    if (buf.length > (parseInt(process.env.MAX_REQUEST_SIZE) || 1024 * 1024)) { // 1MB default
      const error = new Error('Request entity too large');
      error.status = 413;
      throw error;
    }
  }
}));

app.use(cookieParser());
app.use(compression());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 50000, // Dramatically increased from 5000 to 50000 for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
// TEMPORARILY DISABLED FOR DEVELOPMENT - RATE LIMITING
// app.use(globalLimiter);

// Routes with API versioning
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/vault', vaultRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Legacy routes (for backward compatibility during transition)
app.use('/api/auth', authRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint with database status
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const health = {
      status: dbHealth.status === 'healthy' ? 'OK' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: 'v1',
      database: dbHealth,
      uptime: process.uptime()
    };

    // Return 503 if database is unhealthy
    const statusCode = dbHealth.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      version: 'v1',
      error: 'Health check failed',
      database: { status: 'unhealthy', error: error.message },
      uptime: process.uptime()
    });
  }
});

// API version endpoint
app.get('/api/v1/version', (req, res) => {
  res.status(200).json({
    version: 'v1',
    timestamp: new Date().toISOString(),
    features: [
      'authentication',
      'vault-management',
      'encryption',
      'rate-limiting'
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested resource does not exist'
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app; 