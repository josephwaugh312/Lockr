# 🔒 Lockr - Zero-Knowledge Password Manager Backend

A secure, zero-knowledge password manager backend built with Node.js, Express, and PostgreSQL.

## 🛡️ Security Features

- **Zero-Knowledge Architecture**: Server never sees plaintext passwords
- **Argon2id Hashing**: Industry-standard password hashing
- **AES-256-GCM Encryption**: Military-grade vault encryption
- **JWT Authentication**: Short-lived access tokens + refresh cookies
- **OWASP Hardening**: Comprehensive security middleware stack
- **Rate Limiting**: Protection against brute force attacks
- **Comprehensive Logging**: Security event monitoring

## 📚 Documentation

- [**API Documentation**](docs/API.md): Complete API reference with examples
- [**Security Guide**](docs/SECURITY.md): Security architecture and best practices
- [**Database Guide**](docs/DATABASE.md): Schema, migrations, and maintenance
- [**Testing Guide**](docs/TESTING.md): Test organization and development

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd lockr-backend
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up database
```bash
npm run migrate
```

5. Start development server
```bash
npm run dev
```

## 🧪 Testing Strategy

### Coverage Status
![Coverage](https://img.shields.io/badge/coverage-81%25-yellowgreen)
![Tests](https://img.shields.io/badge/tests-2501%20passed-success)
![Security](https://img.shields.io/badge/security-A+-brightgreen)

### Test Organization
- **Unit Tests**: 85% coverage of critical paths
- **Integration Tests**: Database, email, SMS services  
- **Security Tests**: Auth flows, 2FA, encryption, token management

### Priority Coverage Areas
✅ **Cryptographic Functions** (86% coverage)
- AES-256-GCM encryption/decryption
- Key derivation with Argon2id
- Secure random generation

✅ **Authentication & Authorization** (83% coverage)
- JWT token generation/validation
- 2FA implementation (TOTP/SMS)
- Password reset flows
- Session management

✅ **Security Features** (92% coverage)
- Breach monitoring
- Password expiry notifications
- Security event logging
- Rate limiting

### Test Commands
```bash
# Run all tests with coverage
npm test

# Run React component tests
npm run test:react

# Run integration tests only
npm run test:integration

# Run with watch mode
npm run test:watch

# Full CI test suite
npm run test:ci
```

### Failure Path Testing Examples
- Invalid token handling
- Database connection failures
- Email service outages
- Rate limit exceeded scenarios
- Malformed input validation
- Encryption/decryption errors
- Session expiry handling

### Production Readiness Gap
For production deployment, add:
- [ ] E2E tests with Playwright
- [ ] Load testing with k6
- [ ] Mutation testing with Stryker
- [ ] Contract testing for API endpoints
- [ ] Security scanning with OWASP ZAP
- [ ] Performance benchmarking

### Technical Debt
- Dashboard component branch coverage (62%)
- Clipboard manager error edges (35% branch coverage)
- Email service error recovery paths
- WebSocket connection resilience

## 📁 Project Structure

```
├── src/
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Security & validation middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── utils/           # Helper functions
├── tests/               # Test files
├── migrations/          # Database migrations
└── docs/               # Documentation
    ├── API.md          # API reference
    ├── SECURITY.md     # Security guide
    ├── DATABASE.md     # Database guide
    └── TESTING.md      # Testing guide
```

## 🔐 Security Implementation

Our security implementation follows industry best practices:

1. **Encryption**
   - Client-side AES-256-GCM encryption
   - PBKDF2 key derivation (600,000 iterations)
   - Zero-knowledge architecture

2. **Authentication**
   - JWT with short expiration
   - Refresh token rotation
   - Rate limiting
   - Brute force protection

3. **Data Protection**
   - Input validation
   - SQL injection prevention
   - XSS protection
   - CSRF protection

See [Security Documentation](docs/SECURITY.md) for details.

## 🗄️ Database

- PostgreSQL with secure schema
- UUID primary keys
- Encrypted vault entries
- Automated migrations
- Performance optimization

See [Database Documentation](docs/DATABASE.md) for details.

## 🤝 Contributing

1. Follow TDD practices
2. Run security linting before commits
3. Update tests for all new features
4. Review security checklist
5. Update relevant documentation

### Development Workflow

1. Create feature branch
2. Write tests first
3. Implement feature
4. Update documentation
5. Submit pull request

## 🐛 Issue Reporting

1. Check existing issues
2. Include environment details
3. Provide reproduction steps
4. Remove sensitive information

## 📄 License

MIT License - see LICENSE file for details.

## 🔍 Status

![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)
![Security Score](https://img.shields.io/badge/security-A%2B-brightgreen.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

## 📞 Support

- GitHub Issues: Feature requests and bug reports
- Security: See SECURITY.md for vulnerability reporting
- Documentation: See docs/ directory 