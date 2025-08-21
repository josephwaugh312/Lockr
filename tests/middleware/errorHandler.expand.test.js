const express = require('express')
const request = require('supertest')
const { errorHandler } = require('../../src/middleware/errorHandler')

function createApp(thrower) {
  const app = express()
  app.get('/test', (req, res, next) => {
    try {
      thrower()
    } catch (e) {
      next(e)
    }
  })
  app.use(errorHandler)
  return app
}

describe('errorHandler middleware', () => {
  it('returns 503 for ECONNREFUSED/ENOTFOUND', async () => {
    const app = createApp(() => {
      const err = new Error('db down')
      err.code = 'ECONNREFUSED'
      throw err
    })
    const res = await request(app).get('/test')
    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('Database connection unavailable')

    const app2 = createApp(() => {
      const err = new Error('dns')
      err.code = 'ENOTFOUND'
      throw err
    })
    const res2 = await request(app2).get('/test')
    expect(res2.statusCode).toBe(503)
  })

  it('returns 504 for ETIMEDOUT', async () => {
    const app = createApp(() => {
      const err = new Error('timeout')
      err.code = 'ETIMEDOUT'
      throw err
    })
    const res = await request(app).get('/test')
    expect(res.statusCode).toBe(504)
    expect(res.body.error).toBe('Database connection timeout')
  })

  it('maps PG errors 23505 and 23503', async () => {
    const app1 = createApp(() => {
      const err = new Error('unique')
      err.code = '23505'
      throw err
    })
    const r1 = await request(app1).get('/test')
    expect(r1.statusCode).toBe(409)
    expect(r1.body.error).toBe('Conflict')

    const app2 = createApp(() => {
      const err = new Error('fk')
      err.code = '23503'
      throw err
    })
    const r2 = await request(app2).get('/test')
    expect(r2.statusCode).toBe(400)
    expect(r2.body.error).toBe('Invalid reference')
  })

  it('uses provided status or defaults to 500; exposes message in non-prod', async () => {
    const app = createApp(() => {
      const err = new Error("I'm a teapot")
      err.status = 418
      throw err
    })
    const res = await request(app).get('/test')
    expect(res.statusCode).toBe(418)
    expect(res.body.error).toBe("I'm a teapot")
  })

  it('masks error message in production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const app = createApp(() => {
        throw new Error('sensitive')
      })
      const res = await request(app).get('/test')
      expect(res.statusCode).toBe(500)
      expect(res.body.error).toBe('Internal server error')
      expect(res.body.stack).toBeUndefined()
    } finally {
      process.env.NODE_ENV = originalEnv
    }
  })
})


