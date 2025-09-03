# 🔒 Lockr – Zero-Knowledge Password Manager Backend

## Overview

Lockr is a zero-knowledge password manager backend designed to balance usability and enterprise-grade security. It helps users safely store and manage credentials without exposing plaintext passwords to the server.

## ✨ Key Features

- **Zero-Knowledge Architecture** – Server never sees plaintext passwords
- **End-to-End Security** – Argon2id hashing, AES-256-GCM encryption, JWT authentication
- **Resilient Infrastructure** – Dockerized, CI/CD pipelines, and fault-tolerant services
- **User Protection** – OWASP hardening, brute-force rate limiting, breach monitoring
- **Scalable Design** – PostgreSQL schema with migrations and performance optimizations

## 📚 Documentation

- [**API Reference**](docs/API.md) – Usage examples and endpoint details
- [**Security Guide**](docs/SECURITY.md) – Implementation principles and best practices
- [**Database Guide**](docs/DATABASE.md) – Schema, migrations, and maintenance
- [**Testing Guide**](docs/TESTING.md) – Structure, coverage, and methodology

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/josephwaugh312/Lockr.git
cd Lockr

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run migrations
npm run migrate

# Start development server
npm run dev
```

## 🧪 Testing

- **Unit Tests** – 85% coverage of critical paths
- **Integration Tests** – Database, auth, email/SMS services
- **Security Tests** – 2FA, encryption, token validation

### Coverage Highlights

- **Cryptographic Functions** – 86%
- **Authentication & Authorization** – 83%
- **Security Features** – 92%

### Run Tests

```bash
npm test          # All tests with coverage
npm run test:ci   # Full CI suite
```

## 🛠️ Roadmap / Future Enhancements

- [ ] End-to-end tests (Playwright)
- [ ] Load testing (k6)
- [ ] Mutation testing (Stryker)
- [ ] Enhanced WebSocket resilience
- [ ] Contract testing for API endpoints
- [ ] Security scanning with OWASP ZAP
- [ ] Performance benchmarking

## 🤝 Contributing

1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Update documentation
5. Submit PR

## 📄 License

MIT License – see LICENSE for details