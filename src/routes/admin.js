const express = require('express');
const router = express.Router();
const { hashPrivacyData } = require('../../scripts/hash-privacy-data');
const { encryptNotifications } = require('../../scripts/encrypt-notifications');
const { cleanupPlaintextData } = require('../../scripts/cleanup-plaintext-data');

// Temporary admin endpoint for security upgrades
// TODO: Remove this endpoint after security upgrades are complete
router.post('/security-upgrades', async (req, res) => {
  try {
    // Simple admin authentication - in production you'd want proper auth
    const adminKey = req.headers['x-admin-key'];
    if (adminKey !== 'lockr-security-upgrade-2025') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    console.log('🚀 Starting security upgrades deployment...');
    const startTime = Date.now();

    // Step 1: Hash privacy data
    console.log('🔐 Step 1: Hashing privacy data...');
    await hashPrivacyData();
    console.log('✅ Step 1 completed');

    // Step 2: Encrypt notifications
    console.log('🔐 Step 2: Encrypting notifications...');
    await encryptNotifications();
    console.log('✅ Step 2 completed');

    // Step 3: Cleanup plaintext data
    console.log('🧹 Step 3: Cleaning up plaintext data...');
    await cleanupPlaintextData();
    console.log('✅ Step 3 completed');

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('🎉 Security upgrades deployment complete!');

    res.json({
      success: true,
      message: 'Security upgrades completed successfully',
      duration: `${duration} seconds`,
      steps: [
        'Privacy data hashed (IP addresses and user agents)',
        'Notification content encrypted',
        'Plaintext data cleaned up'
      ],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('💥 Security upgrade failed:', error.message);
    res.status(500).json({
      error: 'Security upgrade failed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint for the admin route
router.get('/health', (req, res) => {
  res.json({
    status: 'Admin endpoints active',
    timestamp: new Date().toISOString()
  });
});

module.exports = router; 