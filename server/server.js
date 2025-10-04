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

class WebsocketReceiver {
    constructor(socket) {
        this._socket = socket;
    };

    /** Define properties **/
    _bufferedChunks = [] // array containing the chunks of data received.
    _totalBufferedLength = 0 ; // keep track of the total bytes in the buffer after each chunk added.
    _parserState = CONSTANTS.GET_INFO;
    _shouldContinueParsing = false ;

    //**Define the frame variables*/
    _isFinalFragment = false ; // responsible for indicating if its the final fragment of a message has been received.
    _frameOpcode = null ; // represent the type of receieved data (1 -> TEXT message , 2 -> BINARY message , etc...)
    _isPayloadMasked = false ; // each message from client must be masked, This bit indicate if the message masked or not (boolean value). 
    _initialPayloadLength = 0 ; // indicate to the initial payload length (2 ^ 7 the maximum size of the initial size).
    _acualPayloadLength = 0 ;

    /** Define methods**/
    processBuffer(chunk) {
        this._bufferedChunks.push(chunk);
        this._totalBufferedLength += chunk.length;
        this._startParsingEngine();
    };

    _startParsingEngine() {
        this._shouldContinueParsing = true;
        do {
            switch (this._parserState) {
                case CONSTANTS.GET_INFO: // In this step our job is to extract the first 2 bytes of the message frame (FIN , OPCODE , MASK , INIT_PAYLOAD_LENGTH).
                    this._getInfo();
                    break;
                case CONSTANTS.GET_LENGTH: // In this step we extract the acual -not initial- payload length 
                    this._getLength();
                    break;
            }

        } while(this._shouldContinueParsing) ;
    };

    //Main functions
    _getInfo() {
        /*
            //JUST in case i want to debug and see the binary resprestation of the buffer.
            const binaryRepresentation = Array.from(frameHeaderBuffer)
            .map(byte => byte.toString(2).padStart(8, "0")) 
            .join(" "); 
            console.log("Binary:", binaryRepresentation);
        */

        const frameHeaderBuffer = this._consumeHeaders(CONSTANTS.FIRST_FRAME_SIZE);  
        const firstByte = frameHeaderBuffer[0] //First byte contains the FIN (1bit) | RSV1 (1bit) | RSV2 (1bit) | RSV3 (1bit) | opcode (4bits) = 8 bits
        const secondByte = frameHeaderBuffer[1] //Second byte contains the Mask (1bit) | InitialPayloadLength (7bits) = 8 bits 

        this._isFinalFragment = !!(firstByte & (1 << 7)); // equivalent to (firstByte & 0b10000000) === 0b10000000.
        this._frameOpcode = (firstByte & ((1 << 4) - 1)); // Extracting the 4 bits of the opcode by ADNING the 4 bits with (1111) and get the value .
        this._isPayloadMasked = !!(secondByte & (1 << 7)); // Extracing the last bit of the second byte to know if the message masked or not.
        this._initialPayloadLength = (secondByte & ( (1 << 7) - 1 ));

        console.log(this._isFinalFragment);
        console.log(this._frameOpcode);
        console.log(this._isPayloadMasked);
        console.log(this._initialPayloadLength);
        // if data is not masked throw an error
        if (!this._isPayloadMasked) {
            //TODO: send a close frame back to the client.
            throw new Error("The messeage sent from client is not MASKED!");
        }
        // LETS MOVE TO THE NEXT STEP OF PARSING 
        this._parserState = CONSTANTS.GET_LENGTH

    };

    _getLength() {

        // We dont do anything in this case because in that case the payload is considered small and the acual length already sent and extracted.
        if (this._initialPayloadLength < CONSTANTS.MEDUIM_FRAME_FLAG) {
            this._acualPayloadLength = this._initialPayloadLength;
            this.processLength();
            return;
        }

        else if (this._initialPayloadLength === CONSTANTS.MEDUIM_FRAME_FLAG) {
            let payloadLengthBuffer = this._consumeHeaders(CONSTANTS.MEDUIM_SIZE_CONSUMPTION); // consume next 2 bytes
            console.log("BOFER: " , payloadLengthBuffer);
            this._acualPayloadLength = payloadLengthBuffer.readUInt16BE(); 
            this.processLength() // TODO
            console.log("Holaaaaa" , this._acualPayloadLength);
        }
        
        else if (this._initialPayloadLength === CONSTANTS.LARGE_FRAME_FLAG) {
            let payloadLengthBuffer = this._consumeHeaders(CONSTANTS.LARGE_SIZE_CONSUMPTION); // consume next 8 bytes
            console.log("BOFER: " , payloadLengthBuffer);
            //In this case we will have such a big number the js number system cant handle , so we must deal with it as a BigInt number .
            let buf8BigInt = payloadLengthBuffer.readUInt64BE();
            this._acualPayloadLength = Number(buf8BigInt);
            this.processLength() // TODO
        }
        
    }

    //Helper functions.
    _consumeHeaders(bytes) {
        this._totalBufferedLength -= bytes;

        if (bytes === this._bufferedChunks[0].length) {
            return this._bufferedChunks.shift();
        }

        if (bytes < this._bufferedChunks[0].length) {
            const frameHeaderBuffer = this._bufferedChunks[0];
            this._bufferedChunks[0] = this._bufferedChunks[0].slice(bytes);
            return frameHeaderBuffer.slice(0 , bytes);
        }

        throw Error("You cannot extrac data from a ws frame that the acual frame size.")
    }
    
};