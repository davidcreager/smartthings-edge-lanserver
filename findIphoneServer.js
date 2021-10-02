'use strict';
const ICloud = require('./icloud').iCloud;
const Encrypter = require('./encrypt');
const Device = require("./lanDevice.js")
class findIphoneServer {
	constructor(manager) {
		this.manager = manager;
		this.validCommands = [];
		this.encrypter = new Encrypter("bollocks");
		this.serverType = "findIphone";
		let appleID = this.manager.config[this.serverType].apple_id;
		let applePwd = this.manager.config[this.serverType].password;
		if (this.manager.config[this.serverType].encrypted == true) {
			appleID = this.encrypter.dencrypt(appleID);
			applePwd = this.encrypter.dencrypt(applePwd);
		}
		this.iCloud = new ICloud(appleID, applePwd);
		this.validCommands = ["beep"];
		this.managementCommands = [];
	}
	beep(device) {
		console.log("[findIphoneServer][beep]\t Alerting " + device.friendlyName + " deviceID=" + device.deviceID);
		const self = this;
		let validSession =  this.iCloud.checkSession( (err, res, body) => {
			if (err) {
				console.log("[findIphoneServer][beep]\t Session invalid " + err);
				validSession = self.iCloud.login( (err,res,body) => {
					if (err) {
						console.error("[findIphoneServer][beep]\t login Cannot login " + err);
						return false;
					}
					console.log("[findIphoneServer][beep]\t checkSession:login Logged in again");
					return true;
				})
				return validSession
			} else {
				console.log("[findIphoneServer][beep]\t checkSession: Reusing session");
				return true;
			}
		});
		if (!validSession) {
			console.log("[findIphoneServer][beep]\t validSession = " + validSession)
			//return null
		}
		this.iCloud.alertDevice(device.deviceID, (err,resp,body) => {
			if ( (err) || (resp.statusCode != 200) ) {
				console.warn("[findIphoneServer][beep]\t Error sending beep " + err + " statuscode=" + resp.statusCode);
				return;
			}
			return
		});
	}
	async discover() {
		console.log("[findIphoneServer][discover]\t Starting Iphone discovery")
		const self = this;
		this.iCloud.getDevices(function(err, devices) {
			if (err) return console.error('[findIphoneServer][discover]\t ERROR:',err);
			if (devices.length === 0) {
				return console.warn("[findIphoneServer][discover]\t No devices found!");
			} else {
				console.log("[findIphoneServer][discover]\t Found " + devices.length.toString() + " devices");
				devices.forEach( (dev) => {
					const uniqueName = dev.name + "[" + dev.deviceDisplayName + "]";
					const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.serverType);
					if ( !self.manager.devices[uniqueName] && deviceInConfig  ) {
						let device = new Device({
							uniqueName: uniqueName,
							friendlyName: deviceInConfig.friendlyName,
							type: self.serverType,
							config: deviceInConfig,
							lanDeviceType: deviceInConfig.lanDeviceType,
							deviceID: dev.id,
							alias: null,
							addressType: null,
							mac: null,
							bleDevice: null
							});
						self.manager.addDevice(device, self);
					}
				});
			}
		});
	};
}
module.exports = findIphoneServer;