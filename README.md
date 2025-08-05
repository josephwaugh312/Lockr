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

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

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