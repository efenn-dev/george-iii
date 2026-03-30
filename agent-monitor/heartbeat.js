const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'state.json');
const LOG_FILE = path.join(__dirname, 'events.log');

function logEvent(message) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, entry);
  console.log(entry.trim());
}

function updateState(status, sessionKey = null) {
  const state = {
    lastHeartbeat: new Date().toISOString(),
    status,
    sessionKey: sessionKey || process.env.OPENCLAW_SESSION_KEY || 'unknown',
    pid: process.pid
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  return state;
}

function checkState() {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { status: 'new' };
    }
    const data = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { status: 'error', error: e.message };
  }
}

// Main action based on command
const action = process.argv[2];

switch (action) {
  case 'ping':
    const prevState = checkState();
    const wasOffline = prevState.status === 'offline' || prevState.status === 'unknown';
    const newState = updateState('online');
    
    if (wasOffline) {
      logEvent('AGENT_ONLINE: George III is back online');
    }
    logEvent('HEARTBEAT: Agent is healthy');
    break;
    
  case 'check':
    const state = checkState();
    const lastPing = state.lastHeartbeat ? new Date(state.lastHeartbeat) : null;
    const now = new Date();
    
    if (!lastPing) {
      logEvent('CHECK: No previous heartbeat found');
      process.exit(1);
    }
    
    const minutesSincePing = (now - lastPing) / 1000 / 60;
    
    if (minutesSincePing > 5) {
      logEvent(`CHECK: Agent appears offline (last ping ${minutesSincePing.toFixed(1)}m ago)`);
      updateState('offline');
      process.exit(1);
    } else {
      console.log(`Agent is online (last ping ${minutesSincePing.toFixed(1)}m ago)`);
      process.exit(0);
    }
    break;
    
  case 'mark-offline':
    logEvent('AGENT_OFFLINE: George III has gone offline');
    updateState('offline');
    break;
    
  default:
    console.log('Usage: node heartbeat.js [ping|check|mark-offline]');
    process.exit(1);
}
