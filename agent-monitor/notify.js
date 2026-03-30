// Notification script - sends Discord messages via webhook or gateway
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANNEL_ID = '1486617069498925088'; // #snapi-george

function sendDiscordMessage(message, mentionUser = true) {
  // Use openclaw CLI to send message to the channel
  const fullMessage = mentionUser ? `<@241453535001051137> ${message}` : message;
  
  try {
    // Try to use openclaw sessions send if we have a session key
    const cmd = `openclaw sessions send --channel discord:${CHANNEL_ID} "${fullMessage.replace(/"/g, '\\"')}"`;
    execSync(cmd, { stdio: 'pipe', timeout: 10000 });
    console.log('Notification sent via openclaw sessions');
    return true;
  } catch (e) {
    console.error('Failed to send via openclaw:', e.message);
    
    // Fallback: try using the message tool through a subprocess
    // This requires openclaw message tool availability
    try {
      const fallbackCmd = `openclaw message send discord ${CHANNEL_ID} "${fullMessage.replace(/"/g, '\\"')}"`;
      execSync(fallbackCmd, { stdio: 'pipe', timeout: 10000 });
      console.log('Notification sent via openclaw message');
      return true;
    } catch (e2) {
      console.error('Failed to send notification:', e2.message);
      return false;
    }
  }
}

// Main
const event = process.argv[2];
const details = process.argv[3] || '';

switch (event) {
  case 'online':
    sendDiscordMessage('👑 **George III is back online**\nAgent has recovered and is ready for commands.', true);
    break;
    
  case 'offline':
    sendDiscordMessage('⚠️ **George III appears to have crashed**\nAgent has not responded for over 5 minutes.', true);
    break;
    
  case 'warning':
    sendDiscordMessage(`⚡ Agent health warning: ${details}`, false);
    break;
    
  default:
    console.log('Usage: node notify.js [online|offline|warning] [details]');
    process.exit(1);
}
