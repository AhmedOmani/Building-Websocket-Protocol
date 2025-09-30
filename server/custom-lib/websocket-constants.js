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
        "http://127.0.0.1:5500",
        "null" // This allow me to use the file protocol to view my html and establish a ws connection.
    ],
};