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
    _messageOpcode = null ; // The opcode from the FIRST frame (used when sending response) - CRITICAL for fragmented messages!
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
                    break;
                case CONSTANTS.GET_CLOSE_INFO:
                    this._getCloseInfo();
                    this._shouldContinueParsing = false;
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
        this._initialPayloadLength = (secondByte & ( (1 << 7) - 1 )); //Get the initial payload lenght (<= 125 small , 126 flag = meduim , 127 flag = large)

        // Continuation frames have Opcode = 0 , so I need to save the opcode from the first frame only/
        if (this._frameOpcode !== 0x00) {
            // This is either a non-fragmented message OR the first frame of a fragmented message
            this._messageOpcode = this._frameOpcode;
        }

        /** 
        console.log(this._isFinalFragment);
        console.log(this._frameOpcode);
        console.log(this._messageOpcode);
        console.log(this._isPayloadMasked);
        console.log(this._initialPayloadLength);
        */
        
        // Validate: data MUST be masked from client
        if (!this._isPayloadMasked) {
            this.sendClose(1002, "Client didnt send <Masking key>");
            this._shouldContinueParsing = false;
            return;
        }

        // Validate: Check the opcode (our server only handles text/binary data)
        if ([CONSTANTS.OPCODE_PING, CONSTANTS.OPCODE_PONG].includes(this._frameOpcode)) {
            this.sendClose(1003, "Server doesnt accept ping or pong");
            this._shouldContinueParsing = false;
            return;
        }

        // LETS MOVE TO THE NEXT STEP OF PARSING 
        this._parserState = CONSTANTS.GET_LENGTH;

    };

    _getLength() {

        // We dont do anything in this case because in that case the payload is considered small and the acual length already sent and extracted.
        if (this._initialPayloadLength < CONSTANTS.MEDUIM_FRAME_FLAG) {
            this._acualPayloadLength = this._initialPayloadLength;
            this._processLength();
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
        console.log(`[FRAME ${this._framesReceived}] Received: ${this._acualPayloadLength} bytes | FIN: ${this._isFinalFragment ? 'YES (Final)' : 'NO (Continuation)'} | OPCODE: ${this._frameOpcode}`);

        let fullMaskedPayloadBuffer = this._consumePayload(this._acualPayloadLength);
        //unmask the full data
        let fullUnmaskedPayloadBuffer = METHODS.unmaskPayload(fullMaskedPayloadBuffer , this._maskKey);

        if (fullUnmaskedPayloadBuffer.length) {
            this._fragments.push(fullUnmaskedPayloadBuffer);
        }
        
        if (this._frameOpcode === CONSTANTS.OPCODE_CLOSE) {
            this._parserState = CONSTANTS.GET_CLOSE_INFO;
            return;
        }

        //Check for FIN state is false , go and start the parsing operation form begining, else stop parsing and send data back to client.
        if (this._isFinalFragment === false) {
            this._parserState = CONSTANTS.GET_INFO; 
        } else {
            console.log(`\n[MESSAGE COMPLETE] Total frames: ${this._framesReceived} | Total payload: ${this._totalPayloadLength} bytes`);
            console.log(`[PROCESSING] Reassembling fragments and preparing echo response...`);
            this._parserState = CONSTANTS.RESPONSE_MESSAGE;
           
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
        let OPCODE = this._messageOpcode; //Using the very first opcode from the first frame, because continuation frames have opcode = 0.
        let firstByte = (FIN << 7) | (RSV1 << 6) | (RSV2 << 5) | (RSV3 << 4) | OPCODE;
        frame[0] = firstByte;
        console.log(`[SENDING] Echo response: ${payloadLength} bytes | FIN: 1 | OPCODE: ${OPCODE}`);

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
        this._sendFrame(frame);
    }

    _getCloseInfo() {
        // control/closed frame cant be fragmanted so we have only one complete frame
        let closeFramePayload = this._fragments[0];
        //no body/payload send with close frame
        if (!closeFramePayload) {
            this.sendClose(1008 , "Set the status code");
            return;
        }

        //first 2 bytes contain close code
        let closeCode = closeFramePayload.readUInt16BE();
        let closeReason = closeFramePayload.toString("utf-8" , 2);

        console.log(`Received close frame with code ${closeCode} and reason: ${closeReason}`);

        let serverResponse = `Closing connection...`;
        this.sendClose(closeCode , serverResponse);
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
        // Check if payload exceeds max size BEFORE adding
        if (this._totalPayloadLength + this._acualPayloadLength > this._maxPayload) {
            console.log(`[LIMIT EXCEEDED] Message size: ${this._totalPayloadLength + this._acualPayloadLength} bytes | Server limit: ${this._maxPayload} bytes`);
            this.sendClose(1009, "Payload exceeds 1 MiB limit");
            this._shouldContinueParsing = false;
            return;
        }
        
        this._totalPayloadLength += this._acualPayloadLength;
        
        // Check for empty payload
        if (this._totalPayloadLength === 0) {
            console.log("[EMPTY] No payload data");
            this.sendClose(1000, "Empty message not allowed");
            this._shouldContinueParsing = false;
            return;
        }
        
        //Lets move to the next task.
        this._parserState = CONSTANTS.GET_MASK_KEY;
    }

    _sendFrame(frame) {
        // Check if socket is still writable
        if (!this._socket || this._socket.destroyed || !this._socket.writable) {
            console.log("Socket is not writable, cannot send frame");
            this.reset();
            return;
        }

        const canContinue = this._socket.write(frame, (err) => {
            if (err) {
                console.error("[ERROR] Failed to send frame:", err.message);
                this.reset();
                return;
            }
            console.log(`[SUCCESS] Echo sent successfully\n${'='.repeat(60)}\n`);
            this.reset();
        });

        // If write buffer is full, we need to wait for drain
        if (!canContinue) {
            console.log("[BACKPRESSURE] Socket buffer full, waiting for drain event...");
        }
    }

    sendClose(closeCode, closeReason) {
        // Check if socket is still writable
        if (!this._socket || this._socket.destroyed || !this._socket.writable) {
            console.log("[CLOSE] Socket already closed, skipping close frame");
            this.reset();
            return;
        }

        // extract and/or construct the closure code & reason
        let closureCode = (typeof closeCode !== 'undefined' && closeCode) ? closeCode : 1000;
        let closureReason = (typeof closeReason !== 'undefined' && closeReason) ? closeReason : "";

        console.log(`[CLOSING] Sending close frame | Code: ${closureCode} | Reason: ${closureReason}`);

        const closureReasonBuffer = Buffer.from(closureReason, 'utf8');
        const closureReasonLength = closureReasonBuffer.length; 

       
        const closeFramePayload = Buffer.alloc(2 + closureReasonLength);
        // write the close code into the payload
        closeFramePayload.writeInt16BE(closureCode, 0); 
        closureReasonBuffer.copy(closeFramePayload, 2);

        // final step: create the first byte and second byte, and then create the final frame to send back the client
        const firstByte = 0b10000000 | 0b00000000 | 0b00001000; // FIN (1) + RSV (0) + OPCODE (8)
        const secondByte = closeFramePayload.length;
        const mandatoryCloseHeaders = Buffer.from([firstByte, secondByte]);

        // create the final close frame
        const closeFrame = Buffer.concat([mandatoryCloseHeaders, closeFramePayload]);

        // send the close frame, and reset the receiver properties
        this._socket.write(closeFrame);
        this._socket.end(); // ending the TCP websocket connection in compliance with the RFC (server must be send the FIN -ending signal- first)

        this.reset();
    }

    reset() {
        /** reset the properties **/
        this._bufferedChunks = [] 
        this._totalBufferedLength = 0 ; 
        this._parserState = CONSTANTS.GET_INFO;
        this._shouldContinueParsing = false ;
        this._isFinalFragment = false ; 
        this._frameOpcode = null ;
        this._messageOpcode = null ; // Reset the message opcode for next message
        this._isPayloadMasked = false ; 
        this._initialPayloadLength = 0 ; 
        this._maskKey = Buffer.alloc(CONSTANTS.MASK_LENGTH) ; 
        this._acualPayloadLength = 0 ;
        this._maxPayload = 1024 * 1024;
        this._totalPayloadLength = 0;
        this._framesReceived = 0;
        this._fragments = [];
    }
    
};

module.exports = {
    WebsocketReceiver
};