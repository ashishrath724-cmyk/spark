const fs = require("fs");
fs.mkdirSync("www", { recursive: true });
fs.copyFileSync("../site/index.html", "www/index.html");
console.log("Copied site/index.html -> www/index.html");
