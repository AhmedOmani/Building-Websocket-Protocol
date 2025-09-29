const PORT = 3000 ;
const HOST = "localhost" ;
module.exports = {
    PORT,
    HOST,
    CUSTOME_ERRORS: [
        "uncaughtException",
        "unhandledRejection",
        "SIGINT", // Triggered when press 'Ctrl + C'
    ]
};