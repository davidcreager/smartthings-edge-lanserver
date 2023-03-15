'use strict';
const ICloud = require('icloudjs').default;
const Encrypter = require('./encrypt');
const path = require("path");
const waitForInput = require("input");
const util = require("util");
const nconf = require("nconf");
const encrypter = new Encrypter("bollocks");
let configFileName = null;
if (process.argv.length > 2) {
	configFileName = process.argv[2];
} else {
	configFileName = "config.json"
}
if (!configFileName.includes(".")) configFileName = configFileName + ".json"
if (!configFileName.includes("/")) configFileName = "./" + configFileName
console.log("[startServer]\t\t\t Loading Configuaration from " + configFileName)
const getTime = () => {
			const now = new Date();
			return (now.getHours() + ":" + (now.getMinutes()<10 ? "0" + now.getMinutes() : now.getMinutes()))
		}
const config = nconf.file(configFileName).get().config;

let appleID = config.findIphone.apple_id;
let applePwd = config.findIphone.password;
if (config.findIphone.encrypted == true) {
	appleID = encrypter.dencrypt(appleID);
	applePwd = encrypter.dencrypt(applePwd);
}

console.log("user =" + appleID + " pw=" + applePwd)
const iCloud = new ICloud({
				username: appleID,
				password: applePwd,
				saveCredentials: false,
				trustDevice: true,
				//dataDirectory: path.resolve('./tmp/')
				dataDirectory: path.resolve('./trust')
			});
( async() => {
	try {
		await iCloud.authenticate();
		console.log("[findIphoneServer][connect]\t " + "authenticated \t Status is " + iCloud.status);
		if (iCloud.status === "MfaRequested") {
			console.log("[findIphoneServer][connect]\t " + "Awaiting 2FA Code " + getTime() + "\n");
			const mfa = await waitForInput.text("MFA Code:");
			console.log("MFA=" + mfa);
			await iCloud.provideMfaCode(mfa);
		}
		await iCloud.awaitReady;
		console.log("[findIphoneServer][connect]\t " + "ready \t Status is " + iCloud.status);
	} catch(err) {
		throw err;
	}
} )();
