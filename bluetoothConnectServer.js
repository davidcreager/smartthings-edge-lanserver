
const {createBluetooth} = require('node-ble');
const {bluetooth, destroy} = createBluetooth();
class bluetoothConnectServer {
	constructor(manager) {
		this.manager = manager;
		this.validCommands = [];
		this.type = "bluetoothConnect";
		this.validCommands = ["power", "color","temperature","level"];
		this.managementCommands = [];
		this.adapter = null;
		this.cmdLookup = {
			power:		[[0x43,0x40],[]],     		// 0x01 is on 0x02 off],
			level:		[[0x43,0x42],[]],  			/// plus parsint(tostring(16)level, 16)  0-64
			color:		[[0x43,0x41],[0xFF,0x65]], 	//r,g,b in the middle  parseInt(tostring(16),16)
			ct:			[0x43,0x43,0x00,0x00,0x00],
			notify:		[0x43,0x67,0xde,0xad,0xbe,0xbf]
		}
	}
	dumpDevices(){
		console.log("[bluetoothConnectServer][dumpdevices]\t " + this.devices.length + " devices found");
		this.devices.forEach( (dev) => {
			console.log("[bluetoothConnectServer][dumpdevices]\t dev=" + JSON.stringify(dev));
			});
	}
	async getAdapter() {
		console.log("[bluetoothConnectServer][getAdapter] Getting Adapter " + (this.adapter=={}));
		//need to sort out gAdapter
		if ( (this.adapter=={}) || (!this.adapter) ) {
			console.log("BTDeviceHandler.getAdapter\t Creating Adapter");
			try {
				 this.adapter = await bluetooth.defaultAdapter();
				 return this.adapter;
				} catch (err) {
					console.error("getAdapater error=" + err);
					throw err;
				}
		} else {
			console.log("[bluetoothConnectServer][getAdapter] returning current  Adapter " + this.adapter.adapter);
			return this.adapter;
		}
		console.log("[bluetoothConnectServer][getAdapter] Weirdness no return");
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
	receiveNotification(device,data) {
		console.log("bleyees:\t received valueChanged " + "\t" + util.inspect(data));
		console.log("bleyees:\t received power: " + data[2] + " bright: " + data[8]);
	}
	async sendCommand(device, cmd, subcmd) {
		const bleMagic = [];
		bleMagic.length = 18;
		bleMagic[0] = 0x43;bleMagic[1] = 0x67;bleMagic[2] = 0xde;bleMagic[3] = 0xad;bleMagic[4] = 0xbe;bleMagic[5] = 0xbf;
		const bleCmd = [];
		this.cmdLookup[cmd][0].forEach( (val,ind) => bleCmd.push(val) );
		if (cmd=="power") bleCmd.push( ((subcmd=="off") ? 0x02 : 0x01) )
		if (cmd=="level") bleCmd.push(parseInt(subcmd.toString(16),16));
		if (cmd=="color") colors[subcmd].forEach((val)=> bleCmd.push(parseInt(val.toString(16),16)))
		this.cmdLookup[cmd][1].forEach( (val,ind) => bleCmd.push(val) );
		bleCmd.length = 18
		const self = this;
		if ( (!device.bleDevice.isConnected) || !(await device.bleDevice.isConnected()) ){
			try {
				console.log("baseSmartServer:sendCommand: connecting to " + device.mac )
				//device.bleDevice = await this.adapter.waitDevice(device.device.mac,20 * 10000);
				device.bleDevice = await this.adapter.waitDevice(device.mac);
				console.log("baseSmartServer:sendCommand: connected to " + device.mac )
				if (device.bleDevice) {
					await device.bleDevice.connect();
					device.bleDevice.gattServer = await device.bleDevice.gatt();
					device.bleDevice.serviceRef = await device.bleDevice.gattServer.getPrimaryService(device.config.SERVICE_UUID);
					device.bleDevice.controlCharacteristic = await device.bleDevice.serviceRef.getCharacteristic(device.config.CONTROL_UUID);
					device.bleDevice.notifyCharacteristic = await device.bleDevice.serviceRef.getCharacteristic(device.config.NOTIFY_UUID);
					device.bleDevice.notifyCharacteristic.on("valuechanged", (data) => self.receiveNotification(device, data));
					await device.bleDevice.notifyCharacteristic.startNotifications();
				} else {
					console.log("baseSmartServer:sendCommand: Cannot connect to Device" )
					return null;
				}
			} catch(er) {
				console.log("baseSmartServer:sendCommand: Cannot reach Device " + er )
				return null;
			}
		}
		await device.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleMagic),{"type":"reliable"}); //command, request, reliable
		await device.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleCmd),{"type":"reliable"}); //command, request, reliable
	}
	power( device, cmd, subcmd ) {
		console.log("Power command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	level( device, cmd, subcmd ) {
		console.log("level command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	temperature( device, cmd, subcmd ) {
		console.log("temperature command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	color( device, cmd, subcmd ) {
		console.log("Color command received " + cmd + " subcmd=" + util.inspect(subcmd))
		this.sendCommand(device, cmd, subcmd.value )
	}
	async discover() {
		const self = this;
		const adapter = await this.getAdapter();
		console.log("[bluetoothConnectServer][discover]  Adapter Obtained " + adapter.adapter);
		if (! await this.adapter.isDiscovering()) await adapter.startDiscovery();
		console.log("[bluetoothConnectServer][discover]  Adapter discovering " + await this.adapter.isDiscovering());
		const retPromise = await new Promise(
			(resolve,reject) => {
				setTimeout( async () => {
					try {
						const discoveredDevices = await self.adapter.devices();
						console.log("[bluetoothConnectServer][discover]  Discovered Devices " + JSON.stringify(discoveredDevices));
						resolve(discoveredDevices);
					} catch (err) {
						reject("Error getting Devices in promise " + err);
					}
				},self.manager.config[self.type]["DiscoveryTime"]);
			});
		console.log("[bluetoothConnectServer][discover]  About to create promises ");
		const devPromises =  retPromise.map( (device,ind) => this.processDevice(this.adapter,device) ); // With no await, this function returns a promise as it async!!!!
		console.log("[bluetoothConnectServer][discover]  created promises ");
		//let devs = await Promise.all(devPromises);
		let devices = []
		for ( let dev of (await Promise.all(devPromises)) ) {
			const uniqueName = ((dev[3]=="No Name") ? dev[1] : dev[3]) + "[" + dev[0] + "]";
			const deviceInConfig = self.manager.getDeviceInConfig(uniqueName,self.type);
			if (deviceInConfig) {
				let device = {
					uniqueName: uniqueName,
					friendlyName: deviceInConfig.friendlyName,
					deviceID: dev[0],
					alias: dev[1],
					addressType: dev[2],
					config: deviceInConfig,
					mac: dev[0],
					type: self.type,
					bleDevice: {}
				}
				self.manager.addDevice(device, self);
			}
		}
		console.log("[bluetoothConnectServer][discover]  About to stop Discovery");
		await this.adapter.stopDiscovery();
	}
}
module.exports = bluetoothConnectServer;