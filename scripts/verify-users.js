const database = require('../src/config/database');
const userRepository = require('../src/models/userRepository');

async function verifyUsers() {
  try {
    // Connect to database
    await database.connect();

    // Get all unverified users
    const result = await database.query(`
      SELECT id, email, email_verification_token 
      FROM users 
      WHERE email_verified = false 
      AND email_verification_token IS NOT NULL
    `);

    console.log(`Found ${result.rows.length} unverified users`);

    // Verify each user
    for (const user of result.rows) {
      try {
        await userRepository.markEmailAsVerified(user.id);
        console.log(`✅ Verified user: ${user.email}`);
      } catch (error) {
        console.error(`❌ Failed to verify user ${user.email}:`, error.message);
      }
    }

    console.log('Done verifying users');
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await database.close();
  }
}

// Run the script
verifyUsers(); 