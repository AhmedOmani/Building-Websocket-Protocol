const http = require("node:http");

const CONSTANTS = require("./custom-lib/websocket-constants"); 
const METHODS = require("./custom-lib/websocket-methods");
const { WebsocketReceiver } = require("./custom-lib/websocket-receiver");

const server = http.createServer((req , res) => {
    res.write("Hola from potential websocket server\n");
    res.end();
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
    // I do it specifically for compatibility issues in goolge chrome the connection header sent like this
    // Connection : <Upgrade>
    // but firefox send the connection header like this:
    // Connection : <keep alive , Upgrade>
    // so i need to handle it
    const ConnectionHeader = req.headers["connection"];
    const hasUpgradeConnectionHeader = ConnectionHeader.includes(CONSTANTS.CONNECTION);
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
    console.log("\n" + "=".repeat(60));
    console.log("[HANDSHAKE] WebSocket connection established successfully");
    console.log("[READY] Listening for incoming messages...");
    console.log("=".repeat(60) + "\n");

    //Create receiver object to manage the data buffer.
    const receiver = new WebsocketReceiver(socket);

    socket.on("data" , (chunk) => {
        console.log(`[DATA] Received chunk: ${chunk.length} bytes`);
        receiver.processBuffer(chunk);
    });

    socket.on("end" , () => {
        console.log("\n[DISCONNECT] Client closed the connection gracefully");
    });

    socket.on("error" , (err) => {
        console.error("[ERROR] Socket error:", err.code || err.message);
        // Don't crash the server on client disconnects
        if (err.code === "ECONNRESET" || err.code === "EPIPE") {
            console.log("[INFO] Client disconnected abruptly");
        }
    });

    socket.on("close" , (hadError) => {
        console.log(`[CLOSED] Connection terminated${hadError ? " (with error)" : " (clean)"}\n`);
    });
};

