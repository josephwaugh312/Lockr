const passwordGenerator = require('../../src/utils/passwordGenerator')

describe('passwordGenerator', () => {
  test('generates default password with required types', () => {
    const { password, options, strength } = passwordGenerator.generatePassword()
    expect(password).toHaveLength(options.length)
    expect(/[A-Z]/.test(password)).toBe(true)
    expect(/[a-z]/.test(password)).toBe(true)
    expect(/\d/.test(password)).toBe(true)
  })

  test('respects length and flags (no symbols)', () => {
    const { password, options } = passwordGenerator.generatePassword({ length: 20, includeSymbols: false })
    expect(password).toHaveLength(20)
    expect(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/\?]/.test(password)).toBe(false)
    expect(options.includeSymbols).toBe(false)
  })

  test('excludes similar chars when requested', () => {
    const { password } = passwordGenerator.generatePassword({ excludeSimilar: true })
    expect(/[il1Lo0O]/.test(password)).toBe(false)
  })

  test('excludes ambiguous chars when requested', () => {
    const { password } = passwordGenerator.generatePassword({ 
      excludeAmbiguous: true,
      length: 50  // Longer password to ensure we can check for absence
    })
    // Check that ambiguous characters are not present
    expect(/[{}[\]()\/\\'"~,;.<>]/.test(password)).toBe(false)
  })

  test('throws when no character types selected', () => {
    expect(() => passwordGenerator.generatePassword({ includeUppercase: false, includeLowercase: false, includeNumbers: false, includeSymbols: false })).toThrow()
  })

  test('generateMultiple returns requested count', () => {
    const results = passwordGenerator.generateMultiple(3, { includeSymbols: false })
    expect(results).toHaveLength(3)
    results.forEach(r => expect(r.options.includeSymbols).toBe(false))
  })

  test('passphrase generation basic behavior', () => {
    const { passphrase, options } = passwordGenerator.generatePassphrase({ wordCount: 3, includeNumbers: true })
    expect(passphrase.split(options.separator)).toHaveLength(3)
  })
})


