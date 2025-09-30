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

function upgradeConnection(req , socket , head) {

};

module.exports = {
    isOriginAllowed,
    websocketHeadersRulesCheck,
    upgradeConnection
}