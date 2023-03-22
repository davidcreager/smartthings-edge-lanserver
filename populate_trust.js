#!/usr/bin/env node

const ICloud = require('icloudjs').default;

const util = require("util");
const nconf = require("nconf");
const input = require("input");
const path = require("path");

const Encrypter = require('./encrypt');
const encrypter = new Encrypter("bollocks");

const getTime = () => {
			const now = new Date();
			return (now.getHours() + ":" + (now.getMinutes()<10 ? "0" + now.getMinutes() : now.getMinutes()))
		}

let configFileName = (process.argv.length > 2) ? process.argv[2] : "config.json";
if (!configFileName.includes(".")) configFileName = configFileName + ".json"
if (!configFileName.includes("/")) configFileName = "./" + configFileName
console.log("[populate_trust]\t\t\t Loading Configuration from " + configFileName)
const config = nconf.file(configFileName).get().config;
const findIphoneConfig = config["findIphone"]
const encryptionKey = process.env.ENCRYPT_KEY || "Not Set";
let debugMsg = "";
( async () => {
	try {
		const appleID = (findIphoneConfig.encrypted == true) ? encrypter.dencrypt(findIphoneConfig.apple_id) : findIphoneConfig.apple_id ;
		const applePwd = (findIphoneConfig.encrypted == true) ? encrypter.dencrypt(findIphoneConfig.password) : findIphoneConfig.password ;
		const icloud = new ICloud({
			username: appleID,
			password: applePwd,
			saveCredentials: false,
			trustDevice: true,
			dataDirectory: path.resolve('./icloudtrust/')
		});
		await icloud.authenticate();
		if (icloud.status === "MfaRequested") {
			console.log("[populate_trust][connect]\t " + "Awaiting 2FA Code " + getTime());
			const mfa = await input.text("MFA Code");
			await icloud.provideMfaCode(mfa);
			await icloud.awaitReady;
			//await this.icloud.provideMfaCode("094508")
		}
		console.log("[populate_trust] connected " + icloud.status);
	} catch (er) {
		debugMsg = "[populate_trust] Error Caught " + er
		console.error(debugMsg);
	}
	
})();
			