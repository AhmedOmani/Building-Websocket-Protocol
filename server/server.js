const http = require("node:http");

const CONSTANTS = require("./custom-lib/websocket-constants"); 
const METHODS = require("./custom-lib/websocket-methods");
const { WebsocketReceiver } = require("./custom-lib/websocket-receiver");

const server = http.createServer((req , res) => {
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
    const hasWebsocketUpgradeHeader = req.headers["upgrade"].toLowerCase() === CONSTANTS.UPGRADE; // websocket
    const hasUpgradeConnectionHeader = req.headers["connection"].toLowerCase() === CONSTANTS.CONNECTION; // Upgrade
    const isRequestMethodGet = req.method === CONSTANTS.METHOD; // GET
    
    //Check origin
    const clientOrigin = req.headers["origin"];
    const isOriginAllowed = METHODS.isOriginAllowed(clientOrigin);

    //Check the whole specefication
    if (METHODS.websocketHeadersRulesCheck(socket , hasWebsocketUpgradeHeader , hasUpgradeConnectionHeader, isRequestMethodGet , isOriginAllowed)) {
        const responseHeaders = METHODS.upgradeHeaders(req);
        socket.write(responseHeaders);
        //lets start communicate.
        startWebSocketCommunication(socket);
    }

});

function startWebSocketCommunication(socket) {
    console.log("Websocket Handshake Established Successfully.");

    //Create receiver object to manage the data buffer.
    const receiver = new WebsocketReceiver(socket);

    socket.on("data" , (chunk) => {
        console.log("chunk received.");
        receiver.processBuffer(chunk);
    });

    socket.on("end" , () => {
        console.log("TRANSIMISION END: the we connection is closed.");
    });
};

