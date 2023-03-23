'use strict';
const ICloud = require('icloudjs').default;
const Encrypter = require('./encrypt');
const Device = require("./device.js")
const path = require("path");
const input = require("input");
const getTime = () => {
			const now = new Date();
			return (now.getHours() + ":" + (now.getMinutes()<10 ? "0" + now.getMinutes() : now.getMinutes()))
		}
class findIphoneServer {
	constructor(manager) {
		this.manager = manager;
		this.encrypter = new Encrypter("bollocks");
		this.serverType = "findIphone";
		const findIphoneConfig = this.manager.config[this.serverType]
		const appleID = (findIphoneConfig.encrypted == true) ? this.encrypter.dencrypt(findIphoneConfig.apple_id) : findIphoneConfig.apple_id ;
		const applePwd = (findIphoneConfig.encrypted == true) ? this.encrypter.dencrypt(findIphoneConfig.password) : findIphoneConfig.password ;
		this.iCloud = null;
		this.iCloud = new ICloud({
				username: appleID,
				password: applePwd,
				saveCredentials: false,
				trustDevice: true,
				//dataDirectory: path.resolve('./tmp/')
				dataDirectory: path.resolve('./')
			});
		//this.iCloud = new ICloud(appleID, applePwd);
	}
	async connect() {
		try {
			await this.iCloud.authenticate();
			console.log("[findIphoneServer][connect]\t " + "authenticated \t Status is " + this.iCloud.status);
			if (this.iCloud.status === "MfaRequested") {
				console.log("[findIphoneServer][connect]\t " + "Awaiting 2FA Code " + getTime());
				const mfa = await input.text("MFA Code");
				await this.iCloud.provideMfaCode(mfa);
				//await this.iCloud.provideMfaCode("094508")
			}
			await this.iCloud.awaitReady;
			console.log("[findIphoneServer][connect]\t " + "ready \t Status is " + this.iCloud.status);
			return true;
		} catch (err) {
			console.error('[findIphoneServer][connect]\t ERROR caught:',err)
			return null;
		}
	}
	async discover() {
		console.log("[findIphoneServer][discover]\t Starting Iphone discovery")
		const self = this;
		if ( !(this.iCloud.status == "Trusted" || this.iCloud.status == "Ready") ) {
			await this.connect();
		}
		try {
			const findMyService = this.iCloud.getService("findme");
			await findMyService.refresh();
			findMyService.devices.forEach( (dv, devkey) => {
				console.log( "[findIphoneServer][discover]\t " + " device discovered " + dv.deviceInfo.name + "[" + dv.deviceInfo.rawDeviceModel + "]" );
				const uName = dv.deviceInfo.name + "[" + dv.deviceInfo.rawDeviceModel + "]";
				const deviceInConfig = self.manager.getDeviceInConfig( uName, self.serverType );
				if ( deviceInConfig )  {
					//console.log( "[findIphoneServer][discover]\t " + " device added " + dv.deviceInfo.name + "[" + dv.deviceInfo.rawDeviceModel + "]" );
					self.manager.addDevice(
											new Device.iphoneDevice({
												uniqueName: uName,
												friendlyName: deviceInConfig.friendlyName,
												type: self.serverType,
												lanDeviceType: deviceInConfig.lanDeviceType,	
												config: deviceInConfig,			
												server: self,
												deviceID: dv.deviceInfo.id,
												deviceLocation: dv.deviceInfo.location,
												iCloud: self.iCloud
											})
										, self)
				}
				
			});
		} catch (err) {
			console.error('[findIphoneServer][discover]\t ERROR caught:',err)
			//throw err;
		}
	};
}
module.exports = findIphoneServer;