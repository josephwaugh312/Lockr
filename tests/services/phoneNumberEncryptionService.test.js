const PhoneNumberEncryptionService = require('../../src/services/phoneNumberEncryptionService')

describe('PhoneNumberEncryptionService', () => {
  const svc = new PhoneNumberEncryptionService()
  const phone = '+15551234567'
  const password = 'UserPassword123!'

  test('encrypts and decrypts phone number (happy path)', () => {
    const { encryptedData, salt } = svc.encryptPhoneNumber(phone, password)
    expect(typeof encryptedData).toBe('string')
    expect(typeof salt).toBe('string')

    const decrypted = svc.decryptPhoneNumber(encryptedData, password, salt)
    expect(decrypted).toBe(phone)
  })

  test('verifyEncryptedPhoneNumber returns true for valid bundle', () => {
    const { encryptedData, salt } = svc.encryptPhoneNumber(phone, password)
    expect(svc.verifyEncryptedPhoneNumber(encryptedData, password, salt)).toBe(true)
  })

  test('throws on invalid phone format', () => {
    expect(() => svc.encryptPhoneNumber('abc', password)).toThrow('Failed to encrypt phone number')
  })

  test('decrypt fails with wrong password', () => {
    const { encryptedData, salt } = svc.encryptPhoneNumber(phone, password)
    expect(() => svc.decryptPhoneNumber(encryptedData, 'WrongPass!', salt)).toThrow('Failed to decrypt phone number')
  })

  test('decrypt fails with wrong salt', () => {
    const { encryptedData } = svc.encryptPhoneNumber(phone, password)
    expect(() => svc.decryptPhoneNumber(encryptedData, password, 'deadbeefdeadbeefdeadbeefdeadbeef')).toThrow('Failed to decrypt phone number')
  })
})


