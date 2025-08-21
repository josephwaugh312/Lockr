const request = require('supertest');
const app = require('../../src/app');

describe('Admin Routes', () => {
  describe('GET /api/v1/admin/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/admin/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('message', 'Admin service is running');
      expect(response.body).toHaveProperty('security_status', 'Database 100% secure ✅');
      expect(response.body).toHaveProperty('security_upgrades', 'Completed successfully');
      expect(response.body).toHaveProperty('deployment_date', '2025-08-02');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/v1/admin/security-status', () => {
    it('should return security status information', async () => {
      const response = await request(app)
        .get('/api/v1/admin/security-status')
        .expect(200);

      expect(response.body).toHaveProperty('zero_knowledge_architecture', true);
      expect(response.body).toHaveProperty('master_passwords_stored', false);
      expect(response.body).toHaveProperty('account_passwords_hashed', true);
      expect(response.body).toHaveProperty('two_factor_secrets_encrypted', true);
      expect(response.body).toHaveProperty('phone_numbers_encrypted', true);
      expect(response.body).toHaveProperty('notification_content_encrypted', true);
      expect(response.body).toHaveProperty('ip_addresses_hashed', true);
      expect(response.body).toHaveProperty('user_agents_hashed', true);
      expect(response.body).toHaveProperty('gdpr_compliant', true);
      expect(response.body).toHaveProperty('encryption_algorithm', 'AES-256-GCM');
      expect(response.body).toHaveProperty('password_hashing', 'Argon2id');
      expect(response.body).toHaveProperty('ssl_enabled', true);
      expect(response.body).toHaveProperty('domain', 'lockrr.app');
      expect(response.body).toHaveProperty('security_score', '100/100');
      expect(response.body).toHaveProperty('security_verified', '2025-08-02');
      expect(response.body).toHaveProperty('database_security_complete', true);
      expect(response.body).toHaveProperty('timestamp');
    });
  });
});