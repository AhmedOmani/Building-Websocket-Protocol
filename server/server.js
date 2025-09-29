const http = require("node:http");

const CONSTANTS = require("./custom-lib/websocket-constants"); 
const METHODS = require("./custom-lib/websocket-methods");

const server = http.createServer((req , res) => {
    res.end("Hola from potential websocket server\n");
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
})