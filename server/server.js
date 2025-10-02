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

class WebsocketReceiver {
    constructor(socket) {
        this._socket = socket;
    };

    /** Define properties **/
    _buffersArray = [] // array containing the chunks of data received.
    _bufferedBytesLength = 0 ; // keep track of the total bytes in the buffer after each chunk added.
    _taskLoop = false ;
    _task = CONSTANTS.GET_INFO;

    /** Define methods**/
    processBuffer(chunk) {
        console.log("chunk: " , chunk);
        this._buffersArray.push(chunk);
        this._bufferedBytesLength += chunk.length;
        console.log("lenght: " , this._bufferedBytesLength);
        this._startParsingEngine();
    };

    _startParsingEngine() {
        this._taskLoop = true;
        do {
            switch (this._task) {
                case CONSTANTS.GET_INFO:
                    this._getInfo();
                    this._taskLoop = false;
                    break;
            }

        } while(this._taskLoop) ;
    };

    _getInfo() {
        const infoBuffer = this._consumeHeaders(CONSTANTS.FIRST_FRAME_SIZE);  
        console.log(infoBuffer);
        /*
            //JUST in case i want to debug and see the binary resprestation of the buffer.
            const binaryRepresentation = Array.from(infoBuffer)
            .map(byte => byte.toString(2).padStart(8, "0")) 
            .join(" "); 
            console.log("Binary:", binaryRepresentation);
        */
    };

    _consumeHeaders(bytes) {
        this._bufferedBytesLength -= bytes;

        if (bytes === this._buffersArray[0].length) {
            return this._buffersArray.shift();
        }

        if (bytes < this._buffersArray[0].length) {
            const infoBuffer = this._buffersArray[0];
            this._buffersArray[0] = this._buffersArray[0].slice(bytes);
            return infoBuffer.slice(0 , bytes);
        }

        throw Error("You cannot extrac data from a ws frame that the acual frame size.")
    }
    
};