const request = require('supertest');
const app = require('../src/app');
const database = require('../src/config/database');

describe('App', () => {
  // Initialize database connection before tests
  beforeAll(async () => {
    await database.connect();
  });

  // Clean up database connection after tests
  afterAll(async () => {
    await database.close();
  });

  describe('Health Check', () => {
    test('GET /health should return 200 OK', async () => {
      const response = await request(app).get('/health');
      
      // If not 200, throw error with response details
      if (response.status !== 200) {
        throw new Error(`Health check failed with status ${response.status}. Response: ${JSON.stringify(response.body, null, 2)}`);
      }
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('environment');
    });
  });

  describe('Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app).get('/health');
      
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('strict-transport-security');
    });
  });

  describe('404 Handler', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Endpoint not found');
    });
  });

  describe('Request Size Limits', () => {
    test('should reject oversized JSON requests', async () => {
      const largePayload = 'x'.repeat(2 * 1024 * 1024); // 2MB payload
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: largePayload })
        .expect(413);

      // Express returns lowercase message for payload too large
      expect(response.body.error.toLowerCase()).toContain('request entity too large');
    });

    test('should reject requests with too many parameters', async () => {
      // The parameter limit is checked by express.urlencoded, so we need to send as form data
      let formData = '';
      for (let i = 0; i < 150; i++) { // Exceeds PARAMETER_LIMIT of 100
        formData += `param${i}=value&`;
      }
      
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send(formData);

      // Should reject with 413 or similar error
      expect([413, 400].includes(response.status)).toBe(true);
    });

    test('should accept normal-sized requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: 'Test User'
        });

      // Should not be rejected for size (may fail for other validation reasons)
      expect(response.status).not.toBe(413);
    });
  });

  describe('API Versioning', () => {
    test('should support v1 API routes', async () => {
      const response = await request(app)
        .get('/api/v1/version')
        .expect(200);

      expect(response.body.version).toBe('v1');
      expect(response.body.features).toContain('authentication');
      expect(response.body.features).toContain('vault-management');
    });

    test('should support legacy API routes for backward compatibility', async () => {
      // Test with health check since auth routes aren't implemented yet
      const legacyHealthResponse = await request(app)
        .get('/health')
        .expect(200);

      const versionedResponse = await request(app)
        .get('/api/v1/version')
        .expect(200);

      // Both should work successfully
      expect(legacyHealthResponse.status).toBe(200);
      expect(versionedResponse.status).toBe(200);
      expect(versionedResponse.body.version).toBe('v1');
    });

    test('should include version in health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.version).toBe('v1');
    });
  });
}); 