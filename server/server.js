const http = require("node:http");

const CONSTANTS = require("./custom-lib/websocket-constants"); 
const METHODS = require("./custom-lib/websocket-methods");

const server = http.createServer((req , res) => {
    console.log(req.headers);
    res.write("Hola from potential websocket server\n");
});

server.listen(CONSTANTS.PORT , CONSTANTS.HOST , () => {
    console.log(`Server is up`);
    console.log(server.address());
});

CONSTANTS.CUSTOME_ERRORS.forEach(error => {
    process.on(error, (err) => {
        console.log(`My code caught an error event: ${error}.\nLook at the error object` , err);
        process.exit(1);
    });
});

server.on("upgrade" , (req , socket , head) => {
    //Grap required request headers.
    const upgradeHeaderCheck = req.headers["upgrade"].toLowerCase() === CONSTANTS.UPGRADE; // websocket
    const connectionHeaderCheck = req.headers["connection"].toLowerCase() === CONSTANTS.CONNECTION; // Upgrade
    const methodCheck = req.method === CONSTANTS.METHOD; // GET
    
    //Check origin
    const origin = req.headers["origin"];
    const originCheck = METHODS.isOriginAllowed(origin);

    //Check the whole specefication
    if (METHODS.websocketHeadersRulesCheck(socket , upgradeHeaderCheck , connectionHeaderCheck, methodCheck , originCheck)) {
        const responseHeaders = METHODS.upgradeHeaders(req);
        socket.write(responseHeaders);
        console.log("Websocket Handshake Established Successfully.");
        //lets start communicate.
        startWebSocketCommunication(socket);
    }

});

function startWebSocketCommunication(socket) {};
