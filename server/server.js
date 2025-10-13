const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const CONSTANTS = require("./custom-lib/websocket-constants"); 
const METHODS = require("./custom-lib/websocket-methods");
const { WebsocketReceiver } = require("./custom-lib/websocket-receiver");

const server = http.createServer((req , res) => {
    // Serve the demo page with inline CSS and JS
    if (req.url === '/') {
        const demoPath = path.join(__dirname, '../client/demo.html');
        const cssPath = path.join(__dirname, '../client/demo-styles.css');
        const jsPath = path.join(__dirname, '../client/demo-script.js');
        
        // Read all three files
        fs.readFile(demoPath, 'utf8', (err, htmlData) => {
            if (err) {
                res.writeHead(404);
                res.end('Demo not found');
                return;
            }
            
            fs.readFile(cssPath, 'utf8', (err, cssData) => {
                if (err) {
                    res.writeHead(404);
                    res.end('CSS not found');
                    return;
                }
                
                fs.readFile(jsPath, 'utf8', (err, jsData) => {
                    if (err) {
                        res.writeHead(404);
                        res.end('JS not found');
                        return;
                    }
                    
                    // Replace external references with inline content
                    let finalHtml = htmlData
                        .replace('<link rel="stylesheet" href="demo-styles.css">', `<style>${cssData}</style>`)
                        .replace('<script src="demo-script.js"></script>', `<script>${jsData}</script>`);
                    
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(finalHtml);
                });
            });
        });
    } else {
        res.write("Hola from potential websocket server\n");
        res.end();
    }
});

server.listen(CONSTANTS.PORT , CONSTANTS.HOST , () => {
    console.log(`Websocket Server is up`);
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
    console.log(clientOrigin);
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

