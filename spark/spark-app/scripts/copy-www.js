const fs = require("fs");
fs.mkdirSync("www", { recursive: true });
fs.copyFileSync("app/index.html", "www/index.html");
console.log("Copied app/index.html -> www/index.html");
