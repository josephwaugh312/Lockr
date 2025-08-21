/** @jest-environment node */
const request = require('supertest')

// Ensure we control module registry for this file
jest.resetModules()

// Mock SMSService internals to avoid external calls (must be defined BEFORE requiring app)
const mockImpl = {
  initialize: jest.fn(async () => {}),
  sendOptInConfirmation: jest.fn(async () => {}),
  handleOptOut: jest.fn(async () => {}),
  sendHelpMessage: jest.fn(async () => {}),
  maskPhoneNumber: (p) => p.replace(/\d(?=\d{2})/g, '*'),
}
jest.doMock('../../src/services/smsService', () => {
  return jest.fn().mockImplementation(() => ({ ...mockImpl }))
})

const app = require('../../src/app')

describe('SMS routes - webhook', () => {
  const agent = request(app)

  const xml = (text) => `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Message>${text}</Message>\n</Response>`

  it('returns 400 on missing parameters', async () => {
    const res = await agent.post('/api/v1/sms/webhook').type('form').send({})
    expect(res.status).toBe(400)
  })

  it('handles START opt-in', async () => {
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=START&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/You are now opted-in|We encountered an error/i)
    expect(mockImpl.sendOptInConfirmation).toHaveBeenCalled()
  })

  it('handles STOP opt-out', async () => {
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=STOP&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/unsubscribed|We encountered an error/i)
    expect(mockImpl.handleOptOut).toHaveBeenCalled()
  })

  it('handles HELP', async () => {
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=HELP&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/Reply STOP|We encountered an error/i)
    expect(mockImpl.sendHelpMessage).toHaveBeenCalled()
  })

  it('handles unknown keyword', async () => {
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=xyz&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/Reply STOP|We encountered an error/i)
  })

  it('logs but still responds when service methods throw', async () => {
    mockImpl.sendOptInConfirmation.mockRejectedValueOnce(new Error('fail'))
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=START&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<?xml')
  })

  it('returns error TwiML on unhandled exception', async () => {
    // Force router handler to throw by breaking initialize
    mockImpl.initialize.mockRejectedValueOnce(new Error('boom'))
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=START&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toMatch(/We encountered an error processing your request/i)
  })

  it('logs error when handleOptOut fails but still responds', async () => {
    mockImpl.handleOptOut.mockRejectedValueOnce(new Error('opt-out failed'))
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=STOP&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<?xml')
    expect(res.text).toContain('You have successfully been unsubscribed')
  })

  it('logs error when sendHelpMessage fails but still responds', async () => {
    mockImpl.sendHelpMessage.mockRejectedValueOnce(new Error('help failed'))
    const res = await agent
      .post('/api/v1/sms/webhook')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('Body=HELP&From=%2B15551234567&To=%2B15550000000')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<?xml')
    expect(res.text).toContain('Reply STOP to unsubscribe')
  })
})


