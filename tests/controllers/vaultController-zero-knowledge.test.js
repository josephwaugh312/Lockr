const express = require('express')
const request = require('supertest')

// Mutable fakes
const mockUserRepository = { findById: jest.fn() }
const mockVaultRepository = {
  getEntries: jest.fn(),
  createSession: jest.fn(),
  clearSession: jest.fn(),
  getSession: jest.fn(),
  getEncryptionKey: jest.fn(),
  batchUpdateEntries: jest.fn(),
}
const mockCryptoImpl = {
  decrypt: jest.fn(async () => ({ any: 'data' })),
  encrypt: jest.fn(async (data) => ({ iv: 'iv', tag: 'tag', data })),
}

// Use literal module ids so jest doesn't hoist unresolved variables
jest.mock('../../src/models/userRepository', () => mockUserRepository, { virtual: false })
jest.mock('../../src/models/vaultRepository', () => mockVaultRepository, { virtual: false })
jest.mock('../../src/services/cryptoService', () => ({ CryptoService: jest.fn(() => mockCryptoImpl) }), { virtual: false })
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  securityEvents: { failedVaultUnlock: jest.fn() },
}), { virtual: false })

// Import controller AFTER mocks
const zkController = require('../../src/controllers/vaultController-zero-knowledge')

function makeApp() {
  const app = express()
  app.use(express.json())
  // Auth shim: allow per-request user id via ?uid=...
  app.use((req, res, next) => {
    req.user = { id: req.query.uid || 'user-1' }
    next()
  })
  app.post('/vault/unlock', zkController.unlockVault)
  app.post('/vault/lock', zkController.lockVault)
  app.post('/vault/change-master-password', zkController.changeMasterPassword)
  return app
}

describe('vaultController-zero-knowledge', () => {
  let app
  beforeEach(() => {
    app = makeApp()
    jest.clearAllMocks()
  })

  describe('unlockVault', () => {
    it('400 when encryptionKey missing', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'user-1' })
      const res = await request(app).post('/vault/unlock')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Encryption key is required/i)
    })

    it('400 when encryptionKey has invalid format', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'user-1' })
      const res = await request(app).post('/vault/unlock').send({ encryptionKey: 'not-base64??' })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Invalid encryption key format/i)
    })

    it('404 when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null)
      const res = await request(app)
        .post('/vault/unlock')
        .send({ encryptionKey: 'QUJDRA==' })
      expect(res.status).toBe(404)
    })

    it('401 when decryption fails on existing entry', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'user-1' })
      mockVaultRepository.getEntries.mockResolvedValue({ entries: [ { id: 'e1', encryptedData: JSON.stringify({}) } ] })
      mockCryptoImpl.decrypt.mockRejectedValueOnce(new Error('bad key'))
      const res = await request(app)
        .post('/vault/unlock')
        .send({ encryptionKey: 'QUJDRA==' })
      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid master password/i)
    })

    it('200 when valid key (or no entries) and session created', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'user-1' })
      mockVaultRepository.getEntries.mockResolvedValue({ entries: [] })
      const res = await request(app)
        .post('/vault/unlock')
        .send({ encryptionKey: 'QUJDRA==' })
      expect(res.status).toBe(200)
      expect(mockVaultRepository.createSession).toHaveBeenCalledWith('user-1', 'QUJDRA==')
    })

    it('429 after too many attempts within window', async () => {
      mockUserRepository.findById.mockResolvedValue({ id: 'rl-user' })
      mockVaultRepository.getEntries.mockResolvedValue({ entries: [ { id: 'e1', encryptedData: '{}' } ] })
      mockCryptoImpl.decrypt.mockRejectedValue(new Error('bad'))
      // 5 attempts to hit limit, 6th should be 429
      for (let i = 0; i < 5; i++) {
        const res = await request(app).post('/vault/unlock?uid=rl-user').send({ encryptionKey: 'QUJDRA==' })
        // these may be 401 until limit reached
        expect([401, 429]).toContain(res.status)
      }
      const res6 = await request(app).post('/vault/unlock?uid=rl-user').send({ encryptionKey: 'QUJDRA==' })
      expect(res6.status).toBe(429)
      expect(res6.body.error).toMatch(/Too many unlock attempts/i)
    })
  })

  describe('lockVault', () => {
    it('200 and clears session', async () => {
      const res = await request(app).post('/vault/lock')
      expect(res.status).toBe(200)
      expect(mockVaultRepository.clearSession).toHaveBeenCalled()
    })

    it('500 on error', async () => {
      mockVaultRepository.clearSession.mockRejectedValueOnce(new Error('db'))
      const res = await request(app).post('/vault/lock')
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/Failed to lock vault/i)
    })
  })

  describe('changeMasterPassword', () => {
    it('403 when vault not unlocked (no session)', async () => {
      mockVaultRepository.getSession.mockResolvedValue(null)
      const res = await request(app)
        .post('/vault/change-master-password')
        .send({ currentEncryptionKey: 'old', newEncryptionKey: 'new' })
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/must be unlocked/i)
    })

    it('400 when missing keys', async () => {
      mockVaultRepository.getSession.mockResolvedValue({})
      const res = await request(app).post('/vault/change-master-password').send({})
      expect(res.status).toBe(400)
    })

    it('403 when current key does not match session', async () => {
      mockVaultRepository.getSession.mockResolvedValue({})
      mockVaultRepository.getEncryptionKey.mockResolvedValue('different')
      const res = await request(app)
        .post('/vault/change-master-password')
        .send({ currentEncryptionKey: 'old', newEncryptionKey: 'new' })
      expect(res.status).toBe(403)
      expect(res.body.error).toMatch(/does not match session/i)
    })

    it('200 re-encrypts entries and creates new session', async () => {
      mockVaultRepository.getSession.mockResolvedValue({})
      mockVaultRepository.getEncryptionKey.mockResolvedValue('old')
      mockVaultRepository.getEntries.mockResolvedValue({ entries: [ { id: 'e1', encryptedData: JSON.stringify({ a: 1 }) } ] })
      const res = await request(app)
        .post('/vault/change-master-password')
        .send({ currentEncryptionKey: 'old', newEncryptionKey: 'new' })
      expect(res.status).toBe(200)
      expect(mockVaultRepository.batchUpdateEntries).toHaveBeenCalled()
      expect(mockVaultRepository.createSession).toHaveBeenCalledWith('user-1', 'new')
      expect(res.body.message).toMatch(/Master password changed successfully/i)
    })

    it('200 even if one entry fails to re-encrypt (logged)', async () => {
      mockVaultRepository.getSession.mockResolvedValue({})
      mockVaultRepository.getEncryptionKey.mockResolvedValue('old')
      // First decrypt ok, second throws
      mockVaultRepository.getEntries.mockResolvedValue({ entries: [
        { id: 'e1', encryptedData: JSON.stringify({ a: 1 }) },
        { id: 'e2', encryptedData: JSON.stringify({ b: 2 }) },
      ] })
      let call = 0
      mockCryptoImpl.decrypt.mockImplementation(async () => {
        call += 1
        if (call === 2) throw new Error('bad entry')
        return { ok: true }
      })
      const res = await request(app)
        .post('/vault/change-master-password')
        .send({ currentEncryptionKey: 'old', newEncryptionKey: 'new' })
      expect(res.status).toBe(200)
      expect(mockVaultRepository.batchUpdateEntries).toHaveBeenCalled()
    })
  })
})


