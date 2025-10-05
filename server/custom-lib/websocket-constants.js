const PORT = 3000 ;
const HOST = "localhost" ;
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
    CONNECTION: "upgrade",
    UPGRADE: "websocket",
    ALLOWED_ORIGINS: [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http:localhost:5500",
        "http://127.0.0.1:5500",
        "ws://127.0.0.1:8080",
        "null" // This allow me to use the file protocol to view my html and establish a ws connection.
    ],
    GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
    //define engine task status.
    GET_INFO: 1,
    GET_LENGTH: 2,
    GET_MASK_KEY: 3,
    GET_PAYLOAD: 4,
    SEND_ECHO: 5,
    //Websocket rules.
    FIRST_FRAME_SIZE: 2, //size in bytes -> refer to image.png

    // Websocket Payload Fields
    MEDUIM_FRAME_FLAG: 126,
    LARGE_FRAME_FLAG: 127,
    MEDUIM_SIZE_CONSUMPTION: 2,
    LARGE_SIZE_CONSUMPTION: 8,
    MASK_LENGTH: 4,

};