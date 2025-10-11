const CONSTANTS = require("./websocket-constants"); 
const METHODS = require("./websocket-methods");

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
    _maskKey = Buffer.alloc(CONSTANTS.MASK_LENGTH) ; // maskKey is a key with size of 4 bytes = 2 ^ 32 value.

    //These specially for handling fragmentation
    _acualPayloadLength = 0 ;
    _maxPayload = 1024 * 1024; // 1MiB
    _totalPayloadLength = 0;
    _framesReceived = 0; //Number of frames have been received for send websocker message.
    _fragments = [];

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
                case CONSTANTS.GET_MASK_KEY: // In this step we know that each message from client is masked , so we need to extract the mask key.
                    this._getMaskKey();
                    break;
                case CONSTANTS.GET_PAYLOAD: // In this step finally we get the message and unmask it.
                    this._getPayload();
                    break;
                case CONSTANTS.RESPONSE_MESSAGE:
                    this._responseMessage();
                    this._shouldContinueParsing = false;
                    this._parserState = CONSTANTS.GET_INFO;
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
       
        // minimum size is 2
        if (this._totalBufferedLength < CONSTANTS.MIN_FRAME_SIZE)  {
            this._shouldContinueParsing = false;
            return;
        }
        const frameHeaderBuffer = this._consumeHeaders(CONSTANTS.FIRST_FRAME_SIZE);  
        const firstByte = frameHeaderBuffer[0] //First byte contains the FIN (1bit) | RSV1 (1bit) | RSV2 (1bit) | RSV3 (1bit) | opcode (4bits) = 8 bits
        const secondByte = frameHeaderBuffer[1] //Second byte contains the Mask (1bit) | InitialPayloadLength (7bits) = 8 bits 

        this._isFinalFragment = !!(firstByte & (1 << 7)); // equivalent to (firstByte & 0b10000000) === 0b10000000.
        this._frameOpcode = (firstByte & ((1 << 4) - 1)); // Extracting the 4 bits of the opcode by ADNING the 4 bits with (1111) and get the value .
        this._isPayloadMasked = !!(secondByte & (1 << 7)); // Extracing the last bit of the second byte to know if the message masked or not.
        this._initialPayloadLength = (secondByte & ( (1 << 7) - 1 ));

        /** 
        console.log(this._isFinalFragment);
        console.log(this._frameOpcode);
        console.log(this._isPayloadMasked);
        console.log(this._initialPayloadLength);
        */
        // if data is not masked throw an error
        if (!this._isPayloadMasked) {
            //TODO: send a close frame back to the client.
            throw new Error("The messeage sent from client is not MASKED!");
        }
        // LETS MOVE TO THE NEXT STEP OF PARSING 
        this._parserState = CONSTANTS.GET_LENGTH;

    };

    _getLength() {

        // We dont do anything in this case because in that case the payload is considered small and the acual length already sent and extracted.
        if (this._initialPayloadLength < CONSTANTS.MEDUIM_FRAME_FLAG) {
            this._acualPayloadLength = this._initialPayloadLength;
            this._processLength();
            console.log(this._bufferedChunks);
            return;
        }

        else if (this._initialPayloadLength === CONSTANTS.MEDUIM_FRAME_FLAG) {
            let payloadLengthBuffer = this._consumeHeaders(CONSTANTS.MEDUIM_SIZE_CONSUMPTION); // consume next 2 bytes
            this._acualPayloadLength = payloadLengthBuffer.readUInt16BE(); 
            this._processLength();
        }
        
        else if (this._initialPayloadLength === CONSTANTS.LARGE_FRAME_FLAG) {
            let payloadLengthBuffer = this._consumeHeaders(CONSTANTS.LARGE_SIZE_CONSUMPTION); // consume next 8 bytes
            //In this case we will have such a big number the js number system cant handle , so we must deal with it as a BigInt number .
            let buf8BigInt = payloadLengthBuffer.readBigUInt64BE();
            this._acualPayloadLength = Number(buf8BigInt);
            this._processLength() 
        }
        
    }

    _getMaskKey() {
        this._maskKey = this._consumeHeaders(CONSTANTS.MASK_LENGTH) ;
        this._parserState = CONSTANTS.GET_PAYLOAD;
    }

    // The big trouble here is the payload itself maybe sent on different fragments , that mean we want to wait until all fragments received 
    // so this function -getPayload- will just do its logic when it make sure that total bytes on buffer are greater that the acualPayloadLength 
    // AKA waiting for another data events fired.
    _getPayload() {
        // in this case we will stop the parser engine and wait for another data event

        if (this._totalBufferedLength < this._acualPayloadLength) {
            this._shouldContinueParsing = false;
            return ;
        }

        this._framesReceived += 1 ;

        let fullMaskedPayloadBuffer = this._consumePayload(this._acualPayloadLength);
        //unmask the full data
        let fullUnmaskedPayloadBuffer = METHODS.unmaskPayload(fullMaskedPayloadBuffer , this._maskKey);
        
        if (this._frameOpcode === CONSTANTS.OPCODE_CLOSE) {
            // TODO: Send closure frame
        }

        if ([CONSTANTS.OPCODE_BINARY , CONSTANTS.OPCODE_PING , CONSTANTS.OPCODE_PONG].includes(this._frameOpcode)) {
            throw new Error("Server has not dealt with a this type of frame yet!\n");
        }

        if (fullUnmaskedPayloadBuffer.length) {
            this._fragments.push(fullUnmaskedPayloadBuffer);
        }

        //Check for FIN state is false , go and start the parsing operation form begining, else stop parsing and send data back to client.
        if (this._isFinalFragment === false) {
            this._parserState = CONSTANTS.GET_INFO; 
        } else {
            console.log("FINAL DEBUG: ");
            console.log("Total frame received: " , this._framesReceived);
            console.log("Totola payload message length: ", this._totalPayloadLength);
            this._parserState = CONSTANTS.RESPONSE_MESSAGE;
            // TODO: send data back to the client.
        }
    }

    _responseMessage() {
        // the fragments array contain the whole message sent through multiple frames
        const fullMessage = Buffer.concat(this._fragments); // complete payload 
        let payloadLength = fullMessage.length;
        let sizePayloadType ;
        // we know that websocket protocol categorize the size of payload sent , so we need to determine the number of bytes we need to add to represent the size of payload correctly
        switch (true) {
            case (payloadLength <= 125):
                sizePayloadType = 0; //0 bytes more added
                break;
            case (payloadLength <= 65535):
                sizePayloadType = 2; //2 bytes more added
                break;
            default: // 
                sizePayloadType = 8; //8 bytes more added
                break;
        }
        //the complete buffer frame size is :
        // the first 2 mandatory bytes (FIN + RSVs + OPCODE + ISMASK + INITIALPAYLOADLENGTH)
        // the second number bytes determined by the size type
        // the third number of bytes is the acual payload length 
        const frame = Buffer.alloc(CONSTANTS.MIN_FRAME_SIZE + sizePayloadType + payloadLength);

        //now populate the HEADERS of frame, starting with first byte
        let FIN = 0x01;
        let RSV1 = 0x00;
        let RSV2 = 0x00;
        let RSV3 = 0x00;
        let OPCODE = this._frameOpcode; // Use the same opcode as the received message
        let firstByte = (FIN << 7) | (RSV1 << 6) | (RSV2 << 5) | (RSV3 << 4) | OPCODE;
        frame[0] = firstByte;
        console.log(frame[0].toString(2));

        //lets build the second portion
        let MASK_BIT = 0x00;
        
        if (payloadLength <= 125) {
            frame[1] = (MASK_BIT | payloadLength);
        } else if (payloadLength <= 65535) {
            frame[1] = (MASK_BIT | CONSTANTS.MEDUIM_FRAME_FLAG) ;// 0b00000000 | 0b01111110
            //NEXT 2 BYTES FOR THE SIZE
            frame.writeUInt16BE(payloadLength, 2);
        } else {
            frame[1] = (MASK_BIT | CONSTANTS.LARGE_FRAME_FLAG); // 0b00000000 | 0b01111111
            frame.writeBigInt64BE(BigInt(payloadLength), 2);
        }

        // last but not least is appending fullMessage to the frame buffer
        const messageStartOffset = CONSTANTS.MIN_FRAME_SIZE + sizePayloadType;
        fullMessage.copy(frame , messageStartOffset);

        //send the message back to the client
        this._socket.write(frame);
        console.log("CLIENT...");
        this._fragments = [];
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

    _consumePayload(bytes) {
    
        this._totalBufferedLength -= bytes;
        const payloadBuffer = Buffer.alloc(bytes);

        let totalBytesRead = 0 ;

        while(totalBytesRead < bytes) {
            const curBuffer = this._bufferedChunks[0];
            const bytesToRead = Math.min(bytes - totalBytesRead , curBuffer.length);
            curBuffer.copy(payloadBuffer ,  totalBytesRead , 0 , bytesToRead)
            
            //maitain the main buffer , erase the whole buffer if we read all of it , if not just the erase the read chunk .
            if (bytesToRead === curBuffer.length) this._bufferedChunks.shift();
            else this._bufferedChunks[0] = curBuffer.slice(bytesToRead);
            
            totalBytesRead += bytesToRead ;
        }

        return payloadBuffer;

    }

    _processLength () {
        this._totalPayloadLength += this._acualPayloadLength;
        if (this._totalPayloadLength > this._maxPayload) {
            throw new Error("Data is too large");
        }
        //Lets move to the next task.
        this._parserState = CONSTANTS.GET_MASK_KEY;
    }
    
};

module.exports = {
    WebsocketReceiver
};