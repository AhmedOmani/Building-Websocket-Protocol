const crypto = require("node:crypto");
const CONSTANTS = require("./websocket-constants"); 

function isOriginAllowed(origin) {
    return CONSTANTS.ALLOWED_ORIGINS.includes(origin);
};

function websocketHeadersRulesCheck(socket , upgradeHeaderCheck , connectionHeaderCheck , methodCheck , originCheck) {
    const finalCheck = upgradeHeaderCheck && connectionHeaderCheck && methodCheck && originCheck;

    if (!finalCheck) {
        const message = "400 Bad Request. The HTTP headers dont comply with the RFC6455 spec.";
        const messageLength = message.length;
        
        const response = 
        `HTTP/1.1 400 Bad Request\r\n` +
        `Content-Type: text/plain\r\n` +
        `Content-Length: ${messageLength}\r\n` + 
        `\r\n` + 
        message; 
        
        socket.end(response);
        return false;
    }
    return true;
};

function generateKey(secWebsocketKey) {
    //Concat client-key with guid to generate server accept key.
    const combinedKey = secWebsocketKey + CONSTANTS.GUID;
    const hashObject = crypto.createHash("sha1");
    hashObject.update(combinedKey);
    let serverKey = hashObject.digest("base64");
    return serverKey;
};

function upgradeHeaders(req) {
    const secWebsocketKey = req.headers["sec-websocket-key"];
    const serverAcceptKey = generateKey(secWebsocketKey);
    let headers = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${serverAcceptKey}`
    ];
    const upgradeHeaders = headers.join("\r\n") + "\r\n\r\n";
    return upgradeHeaders;
};


function unmaskPayload(payloadBuffer , maskKey) {
    for (let i = 0; i < payloadBuffer.length ; i++) {
        payloadBuffer[i] = payloadBuffer[i] ^ maskKey[i % 4];
    }
    return payloadBuffer;
};

module.exports = {
    isOriginAllowed,
    websocketHeadersRulesCheck,
    upgradeHeaders,
    unmaskPayload
}