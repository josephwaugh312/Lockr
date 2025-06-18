require('dotenv').config();

async function simpleSMSTest() {
    console.log('🧪 Simple SMS Test\n');
    
    try {
        // Test direct SMS
        const SMSService = require('./src/services/smsService');
        const sms = new SMSService();
        await sms.initialize();
        
        console.log('📱 Sending direct SMS...');
        const result = await sms.sendCustomSMS({
            to: '+12246888097',
            message: 'Simple SMS test - this should work!'
        });
        console.log('✅ SMS sent:', result.success);
        
        // Test notification service
        console.log('\n📧 Testing notification service...');
        const NotificationService = require('./src/services/notificationService');
        await NotificationService.initialize();
        
        console.log('📋 Enabled channels:', NotificationService.enabledChannels);
        
        console.log('\n✅ Tests completed - check your phone!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

simpleSMSTest(); 