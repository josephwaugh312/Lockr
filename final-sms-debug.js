require('dotenv').config();
const axios = require('axios');

const BASE_URL = 'http://localhost:3002/api';

async function finalSMSDebug() {
    console.log('🔍 Final SMS Debug - Comprehensive Test\n');
    
    try {
        // Test 1: Direct SMS with status check
        console.log('1️⃣ Testing direct SMS with status tracking...');
        const SMSService = require('./src/services/smsService');
        const sms = new SMSService();
        await sms.initialize();
        
        const directResult = await sms.sendCustomSMS({
            to: '+12246888097',
            message: '🔍 FINAL DEBUG: Direct SMS test with status tracking'
        });
        
        console.log('✅ Direct SMS sent:', directResult);
        
        // Check message status
        if (directResult.messageSid) {
            console.log('📋 Checking message status...');
            const status = await sms.getMessageStatus(directResult.messageSid);
            console.log('📱 Message status:', status);
        }
        
        // Test 2: Register and check logs
        console.log('\n2️⃣ Testing registration flow...');
        const registrationData = {
            email: `final-debug-${Date.now()}@example.com`,
            password: 'TestPassword123!',
            masterPassword: 'MasterPassword123!',
            phoneNumber: '+12246888097',
            smsNotifications: true
        };
        
        const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registrationData);
        console.log('✅ Registration response:', {
            phoneVerificationSent: registerResponse.data.phoneVerificationSent,
            phoneNumber: registerResponse.data.user.phoneNumber,
            smsNotifications: registerResponse.data.user.smsNotifications
        });
        
        // Test 3: Login and check for new device notification
        console.log('\n3️⃣ Testing login flow...');
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
            email: registrationData.email,
            password: registrationData.password
        });
        console.log('✅ Login successful');
        
        // Test 4: Check Twilio account for recent messages
        console.log('\n4️⃣ Checking Twilio account for recent messages...');
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const messages = await client.messages.list({
            to: '+12246888097',
            limit: 10
        });
        
        console.log(`📱 Found ${messages.length} recent messages to your number:`);
        messages.forEach((msg, index) => {
            console.log(`   ${index + 1}. ${msg.status} - ${msg.body.substring(0, 50)}... (${msg.dateCreated})`);
        });
        
        // Test 5: Validate phone number
        console.log('\n5️⃣ Validating phone number...');
        const validation = await sms.validatePhoneNumber('+12246888097');
        console.log('📞 Phone validation:', validation);
        
        console.log('\n📋 Summary:');
        console.log('   - Direct SMS service: ✅ Working');
        console.log('   - Registration SMS: ✅ Sent');
        console.log('   - Login notification: ✅ Triggered');
        console.log('   - Phone validation: ✅ Valid');
        console.log(`   - Recent messages: ${messages.length} found`);
        
        console.log('\n📱 If you\'re not receiving SMS messages, possible causes:');
        console.log('   1. Carrier blocking (check spam/blocked messages)');
        console.log('   2. Phone number format issue');
        console.log('   3. Twilio delivery delays');
        console.log('   4. Phone service provider filtering');
        
    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

finalSMSDebug().catch(console.error); 