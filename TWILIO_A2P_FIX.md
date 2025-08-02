# Twilio A2P 10DLC Campaign Registration Guide

## Problem
SMS messages are failing with error code 30034: "US A2P 10DLC - Message from an Unregistered Number"

## Root Cause
Twilio requires US phone numbers to be registered for A2P (Application-to-Person) messaging compliance.

## Quick Fix (Development)
1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Verified Caller IDs**
3. Click **Add a new Caller ID**
4. Enter your phone number: +1-224-688-8097
5. Complete the verification process (you'll receive a call with a code)
6. Once verified, SMS will work to this number

## Production Fix (Required for Live App)

### Step 1: Create a Brand
1. Go to **Messaging** → **Regulatory Compliance** → **A2P 10DLC** in Twilio Console
2. Click **Create a Brand**
3. Fill in the following information:
   - **Business Name**: Lockrr Password Manager
   - **Business Type**: Technology/Software
   - **Website**: https://lockrr.app
   - **Business Address**: [Your business address]
   - **Tax ID/EIN**: [Your business tax ID]
   - **Business Registration Country**: United States
   - **Business Registration State**: [Your state]
   - **Business Registration City**: [Your city]
   - **Business Registration Address**: [Your business address]
   - **Business Registration Postal Code**: [Your postal code]

### Step 2: Create a Campaign
1. After brand approval, click **Create a Campaign**
2. Fill in the following information:

#### Campaign Details
- **Campaign Type**: Mixed (or Security/Authentication)
- **Campaign Name**: Lockrr Security Notifications
- **Campaign Description**: 
  ```
  Messages are sent by Lockrr Password Manager to its existing customers for security and authentication purposes. 
  This includes two-factor authentication codes, security alerts for suspicious login attempts, account lockout notifications, 
  password reset confirmations, new device login alerts, and system maintenance notifications. 
  Customers opt-in during account registration or through account settings to receive these security-critical notifications.
  ```

#### Message Flow/Call-to-Action (CRITICAL - This was the rejection reason)
```
End users opt-in to SMS notifications during account registration at lockrr.app by providing their phone number and checking the SMS notifications checkbox. Users can also add or update their phone number in their account settings after registration. Opt-in occurs when users explicitly agree to receive security notifications and verification codes for their password manager account. Users can opt-out at any time by replying STOP to any message or by updating their notification preferences in their account settings. All messages are transactional and security-focused for password management services.

IMPORTANT: You must provide a screenshot of your opt-in process hosted on a publicly accessible website (like Google Drive, OneDrive, or your own website) and include the URL in this field.

Screenshot URL: [Host a screenshot of your signup form with SMS opt-in checkbox and include the URL here]
```

#### Sample Messages
```
🔐 Lockrr: Your verification code is [123456]. This code expires in 5 minutes. Do not share this code with anyone. Reply STOP to opt out.

🚨 Lockrr Security Alert: Suspicious login attempt detected from [New York, NY]. If this wasn't you, change your password immediately. Reply STOP to opt out.

🔒 Lockrr Alert: Your account has been temporarily locked due to security concerns. Contact support at support@lockrr.app or visit lockrr.app. Reply STOP to opt out.

🔐 Lockrr: New device login detected from [San Francisco, CA]. If this was you, you can ignore this message. Reply STOP to opt out.

🔧 Lockrr: Scheduled maintenance on [2024-01-15]. Service may be temporarily unavailable. Check lockrr.app for updates. Reply STOP to opt out.
```

#### Opt-in Keywords
```
START
```

#### Opt-in Confirmation Message
```
LOCKRR: You are now opted-in to receive security notifications and verification codes. For help, reply HELP. To opt-out, reply STOP. Message and data rates may apply.
```

#### Opt-out Keywords (Twilio Default)
```
STOP, UNSUBSCRIBE, END, QUIT, HALT, OPTOUT, CANCEL, REVOKE, STOPALL
```

#### Opt-out Confirmation Message
```
You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.
```

#### Help Keywords (Twilio Default)
```
HELP, INFO
```

#### Help Message
```
Reply STOP to unsubscribe. Msg&Data Rates May Apply.
```

### Step 3: Associate Phone Number
1. After campaign creation, associate your Twilio phone number with the campaign
2. Submit for review (1-7 business days)

## Code Updates Made
- ✅ Updated all SMS message templates to include consistent "Lockrr:" brand identification
- ✅ Added proper opt-in confirmation message handling
- ✅ Added proper opt-out confirmation message handling  
- ✅ Added help message handling
- ✅ Ensured all messages include "Reply STOP to opt out" language
- ✅ Added support contact information (support@lockrr.app, lockrr.app/support)

## Alternative Solutions
- Use email-only notifications during development
- Use Twilio's WhatsApp API (different compliance rules)
- Use a different SMS provider that handles A2P compliance

## Current Status
- ✅ SMS service code is working correctly
- ✅ Twilio integration is functional
- ✅ Message templates updated for A2P compliance
- ❌ Messages blocked due to A2P compliance
- 🔧 Need to register for A2P campaign

## Next Steps
1. Verify your phone number in Twilio Console (immediate fix for development)
2. **CRITICAL**: Create a screenshot of your signup form with SMS opt-in checkbox
3. Host the screenshot on a publicly accessible website (Google Drive, OneDrive, etc.)
4. Create A2P brand and campaign registration with the screenshot URL
5. Submit campaign for review
6. Test SMS functionality after approval
7. Implement opt-in confirmation sending when users enable SMS notifications

## Important Notes
- **CRITICAL**: The campaign was rejected because Twilio couldn't verify your Call to Action
- You MUST provide a screenshot of your opt-in process hosted publicly
- Campaign review takes 1-7 business days
- Ensure all sample messages match your actual message templates
- Keep brand name consistent across all materials
- Make sure your website has proper opt-in language
- Test all opt-in, opt-out, and help keyword functionality
- Use Twilio's default opt-out and help keyword handling (as shown above) 