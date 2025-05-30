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
```

## 🔐 Security Checklist

See [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md) for our comprehensive security implementation progress.

## 📖 API Documentation

Coming soon...

## 🤝 Contributing

1. Follow TDD practices
2. Run security linting before commits
3. Update tests for all new features
4. Review security checklist

## 📄 License

MIT License - see LICENSE file for details. 