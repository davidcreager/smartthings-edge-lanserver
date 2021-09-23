const util = require("util");
const nconf = require("nconf");
const configFile = nconf.file("./config.json");
let config = configFile.get().config;
console.log("rfxcom " + util.inspect(config.rfxcom));
console.log("findIphone " + util.inspect(config.findIphone));
console.log("bluetoothConnect " + util.inspect(config.bluetoothConnect));
console.log("ssdpConfig " + util.inspect(config.ssdpConfig));



