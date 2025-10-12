# Omani WebSocket Protocol

A custom WebSocket protocol implementation built from scratch without external libraries, fully compliant with RFC 6455.

## Features

- **Custom Implementation**: Built from scratch without external WebSocket libraries
- **RFC 6455 Compliant**: Full adherence to WebSocket protocol specification
- **Fragmentation Handling**: Properly handles message fragmentation across multiple frames
- **Real-time Demo**: Interactive dashboard showing WebSocket communication
- **Professional UI**: Clean, modern interface for demonstrations

## Architecture

```
server/
├── custom-lib/
│   ├── websocket-constants.js    # Protocol constants
│   ├── websocket-methods.js      # Utility methods
│   └── websocket-receiver.js     # Frame parser and handler
└── server.js                     # Main server

client/
├── demo.html                     # Demo interface
├── demo-styles.css              # Styling
└── demo-script.js               # Client-side logic
```

## Quick Start

### Local Development

1. **Clone and install**:
```bash
git clone <your-repo>
cd Building-Websocket-Protocol
npm install  # (if needed)
```

2. **Start server**:
```bash
npm start
# Server runs on http://localhost:3001
```

3. **Open demo**:
   - Open `client/demo.html` in your browser
   - Click "Connect" to establish WebSocket connection
   - Test different message sizes and fragmentation

### Deployment


## Demo Features

- **Connection Management**: Real-time connection status
- **Message Testing**: Send messages of various sizes (1KB to 1MB+)
- **Fragmentation Analysis**: Visual breakdown of frame handling
- **Live Statistics**: Real-time metrics and frame counts
- **Message History**: Complete log of sent/received messages

## Protocol Implementation

### Frame Structure
- **FIN Bit**: Handles message fragmentation
- **OPCODE**: Text, Binary, Close, Ping, Pong support
- **Masking**: Client-to-server message masking (RFC requirement)
- **Payload Length**: Variable length encoding (125B, 64KB, 16MB)

### Fragmentation
- Automatic handling of multi-frame messages
- Proper opcode preservation across fragments
- Memory-efficient buffer management

### Error Handling
- Graceful connection closure
- Proper close codes and reasons
- Backpressure management

## Technical Details

- **Language**: Node.js (JavaScript)
- **Protocol**: WebSocket (RFC 6455)
- **Transport**: TCP sockets
- **No External Dependencies**: Pure Node.js implementation

