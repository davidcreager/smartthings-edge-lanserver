'use strict';
const util = require("util")
const {createBluetooth} = require('node-ble');
const {bluetooth, destroy} = createBluetooth();
const Device = require("./device.js");
//const colors = require('color-convert');
class BTConnectServer {
	constructor(manager) {
		this.manager = manager;
		this.serverType = "bluetoothConnect";
		this.adapter = null;
	}
	dumpDevices(){
		console.log("[BTConnectServer][dumpdevices]\t " + this.devices.length + " devices found");
		this.devices.forEach( (dev) => {
			console.log("[BTConnectServer][dumpdevices]\t dev=" + JSON.stringify(dev));
			});
	}
	async getAdapter() {
		//console.log("[BTConnectServer][getAdapter]\t Getting Adapter " + (this.adapter=={}));
		if ( (this.adapter=={}) || (!this.adapter) ) {
			//console.log("[BTConnectServer][getAdapter]\t Creating Adapter");
			try {
				 this.adapter = await bluetooth.defaultAdapter();
				 return this.adapter;
				} catch (err) {
					console.error("[BTConnectServer][getAdapter]\t Error=" + err);
					throw err;
				}
		} else {
			//console.log("[BTConnectServer][getAdapter]\t Returning current adapter " + this.adapter.adapter);
			return this.adapter;
		}
		console.log("[BTConnectServer][getAdapter]\t Weirdness no return");
	}
	async processDevice(adapter,device) {
		let dev = await this.adapter.getDevice(device);
		return Promise.all([
				device,
				dev.getAlias(),
				dev.getAddressType(),
				dev.getName().catch(()=> {return "No Name"})
				//dev.getServiceData().catch( () => {return "no Service Data"}),
				//dev.getManufacturerData().catch( () => {return "no Manufacturer Data"})
				]);
	}
	async discover() {
		const self = this;
		const adapter = await this.getAdapter();
		//console.log("[BTConnectServer][discover]\t Adapter Obtained " + adapter.adapter);
		console.log("[BTConnectServer][discover]\t Starting Bluetooth discovery")
		if (! await this.adapter.isDiscovering()) await adapter.startDiscovery();
		//console.log("[BTConnectServer][discover]\t Adapter discovering " + await this.adapter.isDiscovering());
		const retPromise = await new Promise(
			(resolve,reject) => {
				setTimeout( async () => {
					try {
						const discoveredDevices = await self.adapter.devices();
						//console.log("[BTConnectServer][discover]\t Discovered Devices " + JSON.stringify(discoveredDevices));
						console.log("[BTConnectServer][discover]\t Found " + discoveredDevices.length + " devices")
						resolve(discoveredDevices);
					} catch (err) {
						reject("Error getting Devices in promise " + err);
					}
				},self.manager.config[self.serverType]["DiscoveryTime"]);
			});
		//console.log("[BTConnectServer][discover]\t About to create promises ");
		const devPromises =  retPromise.map( (device,ind) => this.processDevice(this.adapter,device) ); // With no await, this function returns a promise as it async!!!!
		//console.log("[BTConnectServer][discover]\t Created promises ");
		let devices = []
		for ( let dev of (await Promise.all(devPromises)) ) {
			const uniqueName = ((dev[3]=="No Name") ? dev[1] : dev[3]) + "[" + dev[0] + "]";
			//console.log("[BTConnectServer][discover]\t Processing discovered device " + uniqueName + "\t" +dev[0] + "\t" + dev[1]);
			const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.serverType);
			if (deviceInConfig) {
				const devType = (lanDeviceType == "govee") ? "goveeDevice" : "btConnectableDevice";
				let device = new Device[devType]({
								uniqueName: uniqueName,
								friendlyName: deviceInConfig.friendlyName,
								type: self.serverType,
								lanDeviceType: deviceInConfig.lanDeviceType,	
								config: deviceInConfig,			
								server: self,
								mac: dev[0],
								alias: dev[1],
								deviceID: dev[0],
								addressType: dev[2],
								bleDevice: {}
							});
				self.manager.addDevice(device, self);
			} else {
				//console.log("[BTConnectServer][discover]\t Config not found " + uniqueName + "\t" +dev[0] + "\t" + dev[1]);
			}
			
		}
		console.log("[BTConnectServer][discover]\t About to stop Discovery");
		await this.adapter.stopDiscovery();
	}
}
module.exports = BTConnectServer;