'use strict';
const ICloud = require('./icloud').iCloud;
const Encrypter = require('./encrypt');
const Device = require("./device.js")
class findIphoneServer {
	constructor(manager) {
		this.manager = manager;
		this.encrypter = new Encrypter("bollocks");
		this.serverType = "findIphone";
		let appleID = this.manager.config[this.serverType].apple_id;
		let applePwd = this.manager.config[this.serverType].password;
		if (this.manager.config[this.serverType].encrypted == true) {
			appleID = this.encrypter.dencrypt(appleID);
			applePwd = this.encrypter.dencrypt(applePwd);
		}
		this.iCloud = new ICloud(appleID, applePwd);
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
					//console.log("[findIphoneServer][discover]\t Found " + uniqueName + " loc=" + JSON.stringify(dev.location));
					if (deviceInConfig) {
						let device = new Device.iphoneDevice({
										uniqueName: uniqueName,
										friendlyName: deviceInConfig.friendlyName,
										type: self.serverType,
										lanDeviceType: deviceInConfig.lanDeviceType,	
										config: deviceInConfig,			
										server: self,
										deviceID: dev.id,
										deviceLocation: dev.location
									});
						self.manager.addDevice(device, self);
					} else {
						//console.log("[findIphoneServer][discover]\t Config not found " + uniqueName + "\t" +dev[0] + "\t" + dev[1]);
					}
				});
			}
		});
	};
}
module.exports = findIphoneServer;