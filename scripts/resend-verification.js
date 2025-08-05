require('dotenv').config();
const database = require('../src/config/database');
const emailVerificationService = require('../src/services/emailVerificationService');
const userRepository = require('../src/models/userRepository');

async function resendVerificationEmails() {
  try {
    // Connect to database
    await database.connect();

    // Get all unverified users
    const result = await database.query(`
      SELECT id, email, name, email_verification_token 
      FROM users 
      WHERE email_verified = false 
      AND email_verification_token IS NOT NULL
    `);

    console.log(`Found ${result.rows.length} unverified users`);

    // Send verification email to each user
    for (const user of result.rows) {
      try {
        const emailResult = await emailVerificationService.sendVerificationEmail(
          user.id,
          user.email,
          user.name
        );
        console.log(`✅ Sent verification email to: ${user.email}`, emailResult);
      } catch (error) {
        console.error(`❌ Failed to send verification email to ${user.email}:`, error.message);
      }
    }

    console.log('Done sending verification emails');
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await database.close();
  }
}

// Run the script
resendVerificationEmails(); 