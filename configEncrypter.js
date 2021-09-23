const Encrypter = require('./encrypt');
const nconf = require("nconf");
const configFile = nconf.file("./config.json");
let config = configFile.get().config;
console.log(config.findIphone);
let encrypter = new Encrypter("bollocks");
let appleID = config.findIphone.apple_id
let applePwd = config.findIphone.password;
if (config.findIphone.encrypted == true) {
	appleID = encrypter.dencrypt(appleID);
	applePwd = encrypter.dencrypt(applePwd);
}
console.log("id=" + appleID + " pwd=" + applePwd);
if (!config.findIphone.encrypted == true) {
	console.log("encrypting");
	appleID = encrypter.encrypt(appleID);
	applePwd = encrypter.encrypt(applePwd);
	config.findIphone.apple_id = appleID
	config.findIphone.password = applePwd
	config.findIphone.encrypted = true;
	console.log("Saving");
	configFile.save();
}
console.log("id=" + appleID + " pwd=" + applePwd);