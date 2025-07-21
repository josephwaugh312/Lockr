require('dotenv').config();
const SMSService = require('./src/services/smsService');

async function checkSMSStatus() {
    console.log('🔍 Checking SMS Message Status...\n');
    
    try {
        const sms = new SMSService();
        await sms.initialize();
        
        // Message SIDs from the logs
        const messageSids = [
            'SM1a646daba473b8a41dac3f0e4d66a94b', // Registration verification
            'SMea4ed995ef3b3ba745e39ab2f03ec914'  // New device login
        ];
        
        console.log('📋 Checking status of recent messages:\n');
        
        for (const sid of messageSids) {
            try {
                console.log(`📱 Message SID: ${sid}`);
                const status = await sms.getMessageStatus(sid);
                
                console.log(`   Status: ${status.status}`);
                console.log(`   Error Code: ${status.errorCode || 'None'}`);
                console.log(`   Error Message: ${status.errorMessage || 'None'}`);
                console.log(`   Date Created: ${status.dateCreated}`);
                console.log(`   Date Updated: ${status.dateUpdated}`);
                console.log(`   Price: ${status.price} ${status.priceUnit}`);
                console.log('');
                
                if (status.errorCode) {
                    console.log('❌ This message had an error!');
                    if (status.errorCode === 30034) {
                        console.log('💡 Error 30034: A2P 10DLC compliance issue');
                        console.log('💡 Your Twilio number needs A2P registration');
                        console.log('💡 For trial accounts, verify +12246888097 as a caller ID');
                    }
                }
                
            } catch (error) {
                console.error(`❌ Error checking ${sid}:`, error.message);
            }
        }
        
        console.log('🔍 Checking recent messages to your number...');
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        
        const messages = await client.messages.list({
            to: '+12246888097',
            limit: 5
        });
        
        console.log(`\n📱 Found ${messages.length} recent messages to +12246888097:`);
        messages.forEach((msg, index) => {
            console.log(`   ${index + 1}. ${msg.status} - ${msg.body.substring(0, 60)}...`);
            console.log(`      SID: ${msg.sid}`);
            console.log(`      Created: ${msg.dateCreated}`);
            if (msg.errorCode) {
                console.log(`      Error: ${msg.errorCode} - ${msg.errorMessage}`);
            }
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkSMSStatus().catch(console.error); 