const PORT = 3001 ;
const HOST = "127.0.0.1" ;
module.exports = {
    PORT,
    HOST,
    CUSTOME_ERRORS: [
        "uncaughtException",
        "unhandledRejection",
        "SIGINT", // Triggered when press 'Ctrl + C'
    ],
    METHOD: "GET",
    VERSION: 13 ,
    CONNECTION: "Upgrade",
    UPGRADE: "websocket",
    ALLOWED_ORIGINS: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http:localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5501",
        "ws://127.0.0.1:8080",
        "null" // This allow me to use the file protocol to view my html and establish a ws connection.
    ],
    GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
    //define engine task status.
    GET_INFO: 1,
    GET_LENGTH: 2,
    GET_MASK_KEY: 3,
    GET_PAYLOAD: 4,
    RESPONSE_MESSAGE: 5,
    GET_CLOSE_INFO: 6,
    //Websocket rules.
    FIRST_FRAME_SIZE: 2, //size in bytes -> refer to image.png

    // Websocket Payload Fields
    MIN_FRAME_SIZE: 2,
    MEDUIM_FRAME_FLAG: 126,
    LARGE_FRAME_FLAG: 127,
    MEDUIM_SIZE_CONSUMPTION: 2,
    LARGE_SIZE_CONSUMPTION: 8,
    MASK_LENGTH: 4,

    // Websocket opcodes
    OPCODE_TEXT: 0x01,    // text frame
    OPCODE_BINARY: 0x02,  // binary frame
    OPCODE_CLOSE: 0x08,   // closure frame
    OPCODE_PING: 0x09,
    OPCODE_PONG: 0x0A,


};