/** @jest-environment node */
const crypto = require('crypto')

// Silence logger output in this file
jest.mock('../../src/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const TwoFactorEncryptionService = require('../../src/services/twoFactorEncryptionService')

describe('twoFactorEncryptionService', () => {
  let svc
  beforeEach(() => {
    jest.restoreAllMocks()
    svc = new TwoFactorEncryptionService()
  })

  test('encrypts and decrypts a base32 TOTP secret successfully and verifyEncryptedSecret returns true', () => {
    const secret = 'JBSWY3DPEHPK3PXP' // valid base32
    const password = 'P@ssw0rd!'
    const { encryptedData, salt } = svc.encryptTwoFactorSecret(secret, password)
    expect(typeof encryptedData).toBe('string')
    expect(typeof salt).toBe('string')

    const decrypted = svc.decryptTwoFactorSecret(encryptedData, password, salt)
    expect(decrypted).toBe(secret)
    expect(svc.verifyEncryptedSecret(encryptedData, password, salt)).toBe(true)
  })

  test('verifyEncryptedSecret returns false when decryption fails (tampered data)', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const password = 'P@ssw0rd!'
    const { encryptedData, salt } = svc.encryptTwoFactorSecret(secret, password)
    // Tamper the payload
    const tampered = encryptedData.slice(0, -2) + 'ab'
    expect(svc.verifyEncryptedSecret(tampered, password, salt)).toBe(false)
  })

  test('deriveKeyFromPassword error path when pbkdf2Sync throws', () => {
    const spy = jest.spyOn(crypto, 'pbkdf2Sync').mockImplementation(() => { throw new Error('bad') })
    expect(() => svc.deriveKeyFromPassword('x', 'y')).toThrow('Failed to derive encryption key')
    spy.mockRestore()
  })

  test('generateSalt error path when randomBytes throws', () => {
    const spy = jest.spyOn(crypto, 'randomBytes').mockImplementation(() => { throw new Error('rng') })
    expect(() => svc.generateSalt()).toThrow('Failed to generate salt')
    spy.mockRestore()
  })

  test('encryptTwoFactorSecret error path when cipher creation fails', () => {
    const rb = jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.alloc(12))
    const createCipher = jest.spyOn(crypto, 'createCipheriv').mockImplementation(() => { throw new Error('cipher') })
    expect(() => svc.encryptTwoFactorSecret('ABCDEF234567', 'pw', 'a1'.repeat(16))).toThrow('Failed to encrypt 2FA secret')
    createCipher.mockRestore()
    rb.mockRestore()
  })

  test('decryptTwoFactorSecret error path when auth tag invalid', () => {
    const secret = 'JBSWY3DPEHPK3PXP'
    const password = 'P@ssw0rd!'
    const { encryptedData, salt } = svc.encryptTwoFactorSecret(secret, password)
    // Corrupt authTag portion (bytes 12..27)
    const buf = Buffer.from(encryptedData, 'base64')
    buf[15] = buf[15] ^ 0xff
    const corrupted = buf.toString('base64')
    expect(() => svc.decryptTwoFactorSecret(corrupted, password, salt)).toThrow('Failed to decrypt 2FA secret')
  })
})


