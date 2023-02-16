'use strict';
const rfxcom = require('rfxcom');
const Device = require("./device.js")
class rfxcomServer {
	constructor(manager) {
		this.manager = manager;
		this.validCommands = [];
		this.serverType = "rfxcom";
		this.rfxtrx = new rfxcom.RfxCom(this.manager.config[this.serverType].usbPort, {debug: false});
		this.rfy = new rfxcom.Rfy(this.rfxtrx, rfxcom.rfy.RFY);
		this.validCommands = ["up", "down", "stop","doCommand"];
		this.managementCommands = ["program", "erase", "eraseAll", "listRemotes"];
		let self = this;
		this.rfxtrx.on("status", (msg) => {console.log("[rfxcomserver][status]\t" +  " msg=" + msg)});
		this.rfxtrx.on("rfyremoteslist", (msg) => {
			console.log("[rfxcomserver][RemoteList]\t" +  " msg=" + msg)
			self.deviceDiscovered(msg);
			});
		this.rfxtrx.on("connecting", (msg) => {console.log("[rfxcomserver][connecting]\t" +  " msg=" + msg)});
		this.rfxtrx.on("connectfailed", (msg) => {console.error("[rfxcomserver][connectfailed]\t" +  " msg=" + msg)});
		this.rfxtrx.on("ready", (msg) => {console.log("[rfxcomserver][ready]\t" +  " msg=" + msg)});
		this.rfxtrx.on("disconnect", (msg) => {console.log("[rfxcomserver][disconnect]\t" +  " msg=" + msg)});
		this.rfxtrx.on("response", (msg) => {console.log("[rfxcomserver][response]\t" +  " msg=" + msg)});
		this.rfxtrx.on("receiverstarted", (msg) => {console.log("[rfxcomserver][receiverstarted]\t" +  " msg=" + msg)});
		this.rfxtrx.on("end", (msg) => {console.log("[rfxcomserver][end]\t" +  " msg=" + msg)});
		this.rfxtrx.on("drain", (msg) => {console.log("[rfxcomserver][drain]\t" +  " msg=" + msg)});
		//this.rfxtrx.on("receive", (msg) => {console.log("[rfxcomserver][receive]\t" +  " msg=" + msg)});
		this.rfxtrx.on("receive", (msg) => {});
		this.rfxtrx.initialise(function () {
			console.log("[rfxcomserver][constructor]\t Device initialised Listing remotes");
			self.rfy.listRemotes();
		});
	}
	async discover() {
		this.rfxtrx.initialise(function () {
			console.log("Device initialised");
			console.log("Rfxcom:Listing remotes")
			that.rfy.listRemotes();
		});
	}
	deviceDiscovered(msg) {
		if (typeof(msg) == "object") {
			if (Array.isArray(msg)) {
				msg.forEach( (dev) => {
					const uniqueName = "Blind " + dev.deviceId + "[" + dev.unitCode + "]";
					console.log("[rfxcomserver][deviceDiscovered]\t remote found " + uniqueName + " " + JSON.stringify(dev));
					const deviceInConfig = this.manager.getDeviceInConfig(uniqueName, this.serverType);
					if (deviceInConfig) {
						//console.log("[rfxcomserver][deviceDiscovered]\t uniqueName=" + uniqueName + " friendlyName=" + deviceInConfig.friendlyName );
						let device = new Device.rfxDevice({
							uniqueName: uniqueName,
							friendlyName: deviceInConfig.friendlyName,
							type: this.serverType,
							lanDeviceType: deviceInConfig.lanDeviceType,	
							config: deviceInConfig,			
							server: this,
							deviceID: dev.deviceId,
							rfxInstance: this.rfy
						});
						this.manager.addDevice(device, this);
					} else {
						//console.log("[rfxcomserver][deviceDiscovered]\t remote not in config - uniqueName=" + uniqueName);
					}						
				});
			} else {
				console.error("[rfxcomserver][deviceDiscovered]\t msg not an array" +  " msg=" + JSON.stringify(msg));
			}
		} else {
			console.error("[rfxcomserver][deviceDiscovered]\t msg not an object" +  " msg=" + msg);
		}
	}
}
module.exports = rfxcomServer;