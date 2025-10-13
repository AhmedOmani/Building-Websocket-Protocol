// WebSocket Demo Script
let ws = null;
let isConnected = false;
let stats = {
    messagesSent: 0,
    messagesReceived: 0,
    bytesSent: 0,
    framesReceived: 0
};
let currentMessageSize = 5000;
let lastSentMessage = '';

// DOM Elements
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const sendTestBtn = document.getElementById('sendTestBtn');
const statusBadge = document.getElementById('statusBadge');
const messagesSentEl = document.getElementById('messagesSent');
const messagesReceivedEl = document.getElementById('messagesReceived');
const bytesSentEl = document.getElementById('bytesSent');
const framesReceivedEl = document.getElementById('framesReceived');
const fragmentationResults = document.getElementById('fragmentationResults');
const messagesDisplay = document.getElementById('messagesDisplay');
const liveLog = document.getElementById('liveLog');
const clearLog = document.getElementById('clearLog');
const clearAnalyzer = document.getElementById('clearAnalyzer');
const clearMessages = document.getElementById('clearMessages');
const customSizeInput = document.getElementById('customSize');
const sizeButtons = document.querySelectorAll('.size-btn');

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    if (i === 0) {
        return bytes + ' B';
    } else {
        const value = bytes / Math.pow(k, i);
        // Show more precision for large numbers
        return Math.round(value * 1000) / 1000 + ' ' + sizes[i];
    }
}

function formatNumber(num) {
    return num.toLocaleString();
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
}

function addLog(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry log-${type}`;
    logEntry.innerHTML = `
        <span class="log-time">${getTimestamp()}</span>
        <span class="log-message">${message}</span>
    `;
    liveLog.appendChild(logEntry);
    liveLog.scrollTop = liveLog.scrollHeight;
    
    // Keep only last 50 entries
    while (liveLog.children.length > 50) {
        liveLog.removeChild(liveLog.firstChild);
    }
}

function addMessageDisplay(type, size, frames, content) {
    const messageItem = document.createElement('div');
    messageItem.className = `message-item message-item-${type}`;
    
    // Create preview from actual content
    const preview = content.substring(0, 100);
    
    messageItem.innerHTML = `
        <div class="message-header-bar">
            <span class="message-type-label message-type-${type}">${type.toUpperCase()}</span>
            <span class="message-timestamp">${getTimestamp()}</span>
        </div>
        <div class="message-details">
            <div class="message-detail">
                <div class="message-detail-label">Size</div>
                <div class="message-detail-value">${formatBytes(size)}<br><small style="color: var(--text-secondary);">(${formatNumber(size)} bytes)</small></div>
            </div>
            <div class="message-detail">
                <div class="message-detail-label">Frames</div>
                <div class="message-detail-value">${frames}</div>
            </div>
            <div class="message-detail">
                <div class="message-detail-label">Direction</div>
                <div class="message-detail-value">${type === 'sent' ? 'OUT' : 'IN'}</div>
            </div>
        </div>
        <div class="message-preview">${preview}${content.length > 100 ? '...' : ''}</div>
    `;
    
    // Remove empty state if exists
    const emptyState = messagesDisplay.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    messagesDisplay.insertBefore(messageItem, messagesDisplay.firstChild);
    
    // Keep only last 20 messages
    while (messagesDisplay.children.length > 20) {
        messagesDisplay.removeChild(messagesDisplay.lastChild);
    }
}

function updateStats() {
    messagesSentEl.textContent = formatNumber(stats.messagesSent);
    messagesReceivedEl.textContent = formatNumber(stats.messagesReceived);
    bytesSentEl.textContent = formatBytes(stats.bytesSent);
    framesReceivedEl.textContent = formatNumber(stats.framesReceived);
}

function updateStatus(connected) {
    isConnected = connected;
    statusBadge.textContent = connected ? 'Connected' : 'Disconnected';
    statusBadge.className = `status-badge ${connected ? 'connected' : 'disconnected'}`;
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    sendTestBtn.disabled = !connected;
}

function addFragmentationAnalysis(messageSize, receivedSize, estimatedFrames) {
    const analysis = document.createElement('div');
    analysis.className = 'message-analysis';
    
    // Calculate frame info
    const avgFrameSize = Math.round(receivedSize / estimatedFrames);
    
    analysis.innerHTML = `
        <div class="analysis-header">
            <span class="analysis-title">Message #${stats.messagesReceived}</span>
            <span class="analysis-time">${getTimestamp()}</span>
        </div>
        <div class="analysis-stats">
            <div class="analysis-stat">
                <div class="analysis-stat-value">${formatBytes(messageSize)}</div>
                <div class="analysis-stat-label">Sent</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${formatBytes(receivedSize)}</div>
                <div class="analysis-stat-label">Received</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${estimatedFrames}</div>
                <div class="analysis-stat-label">Frames</div>
            </div>
            <div class="analysis-stat">
                <div class="analysis-stat-value">${formatBytes(avgFrameSize)}</div>
                <div class="analysis-stat-label">Avg Frame</div>
            </div>
        </div>
        <div class="frames-visualization">
            ${generateFrameBlocks(estimatedFrames)}
        </div>
    `;
    
    // Remove empty state if exists
    const emptyState = fragmentationResults.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    fragmentationResults.insertBefore(analysis, fragmentationResults.firstChild);
    
    // Keep only last 10 analyses
    while (fragmentationResults.children.length > 10) {
        fragmentationResults.removeChild(fragmentationResults.lastChild);
    }
}

function generateFrameBlocks(count) {
    let html = '';
    for (let i = 1; i <= count; i++) {
        const isFinal = i === count;
        html += `
            <div class="frame-block ${isFinal ? 'frame-block-final' : ''}">
                Frame ${i}${isFinal ? ' (FIN)' : ''}
            </div>
        `;
    }
    return html;
}

function estimateFrames(size) {
    // Chrome's fragmentation behavior (approximate)
    if (size <= 32768) return 1;  // 32KB
    return Math.ceil(size / 65536); // ~64KB per frame for larger messages
}

// WebSocket Functions
function connect() {
    // Determine WebSocket URL based on environment
    let wsUrl;
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        wsUrl = 'ws://localhost:3001';
    } else if (window.location.protocol === 'file:') {
        wsUrl = 'ws://localhost:3001';
    } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}`;
    }
    
    addLog(`Connecting to ${wsUrl}...`, 'info');
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        updateStatus(true);
        addLog('✓ WebSocket connection established', 'success');
        addLog('Protocol: RFC 6455 (Custom Implementation)', 'info');
    };
    
    ws.onmessage = (event) => {
        stats.messagesReceived++;
        const receivedMessage = event.data;
        const receivedSize = new Blob([receivedMessage]).size;
        stats.framesReceived = estimateFrames(receivedSize);
        
        updateStats();
        addLog(`Received ${formatBytes(receivedSize)} echo response`, 'success');
        addMessageDisplay('received', receivedSize, stats.framesReceived, receivedMessage);
        
        // Add fragmentation analysis
        addFragmentationAnalysis(receivedSize, receivedSize, stats.framesReceived);
    };
    
    ws.onerror = (error) => {
        addLog('WebSocket error occurred', 'error');
    };
    
    ws.onclose = (event) => {
        updateStatus(false);
        addLog(`Connection closed (Code: ${event.code})`, 'warning');
        if (event.reason) {
            addLog(`Reason: ${event.reason}`, 'info');
        }
    };
}

function disconnect() {
    if (ws) {
        addLog('Disconnecting...', 'info');
        ws.close(1000, 'User requested disconnect');
    }
}

function sendTestMessage() {
    if (!isConnected || !ws) {
        addLog('Cannot send: Not connected', 'error');
        return;
    }
    
    const size = currentMessageSize;
    const message = 'A'.repeat(size);
    lastSentMessage = message;
    
    stats.messagesSent++;
    stats.bytesSent += size;
    const estimatedFrames = estimateFrames(size);
    stats.framesReceived = estimatedFrames;
    
    ws.send(message);
    
    updateStats();
    addLog(`Sent ${formatBytes(size)} | ${formatNumber(size)} bytes | ${estimatedFrames} frame${estimatedFrames > 1 ? 's' : ''}`, 'info');
    addMessageDisplay('sent', size, estimatedFrames, message);
}

// Event Listeners
connectBtn.addEventListener('click', connect);
disconnectBtn.addEventListener('click', disconnect);
sendTestBtn.addEventListener('click', sendTestMessage);

clearLog.addEventListener('click', () => {
    liveLog.innerHTML = '<div class="log-entry log-info"><span class="log-time">--:--:--</span><span class="log-message">Log cleared</span></div>';
});

clearAnalyzer.addEventListener('click', () => {
    fragmentationResults.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-cube"></i>
            <p>Send a message to see fragmentation analysis</p>
        </div>
    `;
});

clearMessages.addEventListener('click', () => {
    messagesDisplay.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-comments"></i>
            <p>No messages yet. Send a test message to begin.</p>
        </div>
    `;
});

// Size button handlers
sizeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        sizeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const size = btn.getAttribute('data-size');
        if (size === 'custom') {
            currentMessageSize = parseInt(customSizeInput.value);
        } else {
            currentMessageSize = parseInt(size);
            customSizeInput.value = currentMessageSize;
        }
        
        addLog(`Message size: ${formatBytes(currentMessageSize)}`, 'info');
    });
});

customSizeInput.addEventListener('input', () => {
    currentMessageSize = parseInt(customSizeInput.value) || 5000;
    sizeButtons.forEach(b => {
        if (b.getAttribute('data-size') === 'custom') {
            b.classList.add('active');
        } else {
            b.classList.remove('active');
        }
    });
});

// Initialize
updateStats();
addLog('Demo ready! Click "Connect" to start', 'info');

