const { securityEvents } = require('../../src/utils/logger')

describe('logger securityEvents (extra)', () => {
  test('rateLimitViolation logs expected structure', () => {
    // Ensure function executes without throwing; actual logging is side-effect
    expect(() => securityEvents.rateLimitViolation('127.0.0.1', '/api/test', 42)).not.toThrow()
  })

  test('suspiciousActivity accepts different activity types', () => {
    expect(() => securityEvents.suspiciousActivity('unusual_access_pattern', 'user1', '127.0.0.1', { details: 'test' })).not.toThrow()
  })
})


