const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const SMSService = require('../services/smsService');

/**
 * Handle Twilio SMS webhooks for opt-in, opt-out, and help keywords
 * POST /sms/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const { Body, From, To } = req.body;
    
    if (!Body || !From || !To) {
      logger.error('Missing required webhook parameters', { body: req.body });
      return res.status(400).send('Missing required parameters');
    }

    const smsService = new SMSService();
    await smsService.initialize();

    const messageBody = Body.trim().toUpperCase();
    let responseMessage = '';

    // Handle opt-in keywords
    if (['START', 'OPTIN', 'UNSTOP', 'IN'].includes(messageBody)) {
      logger.info('Opt-in keyword received', { 
        phone: smsService.maskPhoneNumber(From),
        keyword: messageBody 
      });
      
      responseMessage = 'LOCKRR: You are now opted-in to receive security notifications and verification codes. For help, reply HELP. To opt-out, reply STOP. Message and data rates may apply.';
      
      // Send opt-in confirmation
      try {
        await smsService.sendOptInConfirmation(From);
      } catch (error) {
        logger.error('Failed to send opt-in confirmation', { error: error.message });
      }
    }
    // Handle opt-out keywords
    else if (['STOP', 'UNSUBSCRIBE', 'END', 'QUIT', 'HALT', 'OPTOUT', 'CANCEL', 'REVOKE', 'STOPALL'].includes(messageBody)) {
      logger.info('Opt-out keyword received', { 
        phone: smsService.maskPhoneNumber(From),
        keyword: messageBody 
      });
      
      responseMessage = 'You have successfully been unsubscribed. You will not receive any more messages from this number. Reply START to resubscribe.';
      
      // Handle opt-out in database
      try {
        await smsService.handleOptOut(From);
      } catch (error) {
        logger.error('Failed to handle opt-out', { error: error.message });
      }
    }
    // Handle help keywords
    else if (['HELP', 'INFO'].includes(messageBody)) {
      logger.info('Help keyword received', { 
        phone: smsService.maskPhoneNumber(From),
        keyword: messageBody 
      });
      
      responseMessage = 'Reply STOP to unsubscribe. Msg&Data Rates May Apply.';
      
      // Send help message
      try {
        await smsService.sendHelpMessage(From);
      } catch (error) {
        logger.error('Failed to send help message', { error: error.message });
      }
    }
    // Unknown keyword
    else {
      logger.info('Unknown keyword received', { 
        phone: smsService.maskPhoneNumber(From),
        keyword: messageBody 
      });
      
      responseMessage = 'Reply STOP to unsubscribe. Msg&Data Rates May Apply.';
    }

    // Return TwiML response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${responseMessage}</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);

  } catch (error) {
    logger.error('SMS webhook error', { 
      error: error.message,
      body: req.body 
    });

    // Return error response
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Lockr Password Manager: We encountered an error processing your request. For support, visit lockr.app/support or email support@lockr.app. To opt-out, reply STOP.</Message>
</Response>`;

    res.set('Content-Type', 'text/xml');
    res.send(twiml);
  }
});

module.exports = router; 