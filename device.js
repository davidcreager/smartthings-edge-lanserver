'use strict';
const util =  require("util");
const deviceCmds = require("./deviceCmds.json");
const EventEmitter = require('events');
class baseDevice extends EventEmitter {
	constructor(devProps) {
		super();
		this.uniqueName = devProps.uniqueName;
		this.friendlyName = devProps.friendlyName;
		this.type = devProps.type;
		this.lanDeviceType = devProps.lanDeviceType;
		this.config = devProps.config;
		this.server = devProps.server;
		this.deviceID = devProps.deviceID;
		this.state = {};
		this.validCommands = []
		deviceCmds[this.lanDeviceType].validCommands.forEach( (command) => {
			this.validCommands.push(command.cmd);
			this.state[command.state] = ( (command.cmd == "on") || (command.cmd == "off") ) ? [command.cmd] : false;
			this[command.cmd] = async (...args) => {
				console.log("[baseClass][" + command.cmd + "]\t\t" + command.cmd + " for " + this.friendlyName + " len of args=" + args.length + " args[0]=" + util.inspect(args[0]));
				//console.log("[baseClass][" + command.cmd + "]\t State before cmd = " + util.inspect(this.state));
				let retState = await this.sendCommand( this.state , command.cmd, ...args );
				//console.log("[baseClass][" + command.cmd + "]\t State after cmd = " + util.inspect(this.state) + " returned retState = " + util.inspect(retState));
				return retState
			}
		});
	}
	get modelName(){
		const profileLookup = {candela: "SmartCandela.v1",
								bedside: "SmartBedside.v1",
								iphone: "SmartBeep.v1",
								rfxcom: "SmartBlind.v1",
								};
		return ( profileLookup[this.lanDeviceType] || "SmartDevice.v1" );
	}
	emitter_on(...args){
		super.on(...args);
	}
	getSSDPDescription(ip,port) {
		return {root: { $: {"xmlns": "urn:schemas-upnp-org:device-1-0" + " configId=" + "configuration number"}},
					specVersion: {major:1,minor:0},
					device: { friendlyName: this.friendlyName,
							UDN: "uuid:" + this.id,
							location: "http://" + ip + ":" + port + "/" + this.queryID,
							id: this.id,
							modelName: this.modelName,
							queryID: this.queryID,
							deviceType: this.type,
							modelDescription: this.lanDeviceType,
							manufacturer: "DHC EA Consulting",
							modelNumber: "0001.0001",
							serialNumber: "0001001"
						}
				}
	}
	processStateUpdate(device, updatedState) {
		let stateChanged = false;
		Object.keys(this.state).forEach( (stateKey) => {
			if ( updatedState[stateKey] ) {
				if (this.state[stateKey] != updatedState[stateKey]){
					this.state[stateKey] = updatedState[stateKey];
					stateChanged = true;
				}
			}
		})
		if (stateChanged) {
			this.emit("device updated", device, updatedState);
			console.log("[baseClass][processStateUpdate] \tEmitting device update for " + device.friendlyName + " updatedState=" + util.inspect(updatedState));
		}
	}
}
class rfxDevice extends baseDevice {
	constructor(devProps) {
		super(devProps);
	}
	async sendCommand(retState, cmd, ...args) {
		console.log("[rfxDevice][sendCommand]\t received " + " cmd=" + " len of args=" + args.length + " args[0]=" + util.inspect(args[0]));
	}

}
class iphoneDevice extends baseDevice {
	constructor(devProps) {
		super(devProps);
	}
	async sendCommand(retState, cmd, ...args) {
		console.log("[iphoneDevice][sendCommand]\t Alerting " + this.friendlyName + " deviceID=" + this.deviceID);
		console.log("[iphoneDevice][sendCommand]\t received " + " cmd=" + " len of args=" + args.length + " args[0]=" + util.inspect(args[0]));
		const self = this;
		let validSession =  this.server.iCloud.checkSession( (err, res, body) => {
			if (err) {
				console.log("[iphoneDevice][sendCommand]\t Session invalid " + err);
				validSession = self.server.iCloud.login( (err,res,body) => {
					if (err) {
						console.error("[iphoneDevice][sendCommand]\t login Cannot login " + err);
						return false;
					}
					console.log("[iphoneDevice][sendCommand]\t checkSession:login Logged in again");
					return true;
				})
				return validSession
			} else {
				console.log("[iphoneDevice][sendCommand]\t checkSession: Reusing session");
				return true;
			}
		});
		if (!validSession) {
			console.log("[iphoneDevice][sendCommand]\t validSession = " + validSession)
			//return null
		}
		this.server.iCloud.alertDevice(this.deviceID, (err,resp,body) => {
			if ( (err) || (resp.statusCode != 200) ) {
				console.warn("[iphoneDevice][sendCommand]\t Error sending beep " + err + " statuscode=" + resp.statusCode);
				return;
			}
			return
		});
	}
}
class btConnectableDevice extends baseDevice {
	constructor(devProps) {
		super(devProps);
		this.mac = devProps.mac;
		this.alias = devProps.alias;
		this.deviceID = devProps.deviceID;
		this.addressType = devProps.addressType;
		this.bleDevice = devProps.bleDevice;

		this.bleMagic = [0x43, 0x67, 0xde, 0xad, 0xbe, 0xbf ];
		this.bleMagic.length = 18;
		
		this.cmdLookup = {
			on:				[[0x43,0x40,0x01],[]],     		// 0x01 is on 0x02 off],
			off:			[[0x43,0x40,0x02],[]],     		// 0x01 is on 0x02 off],
			setLevel:		[[0x43,0x42],[]],  			/// plus parsint(tostring(16)level, 16)  0-64
			setColor:		[[0x43,0x41],[0xFF,0x65]], 	//r,g,b in the middle  parseInt(tostring(16),16)
			setTemperature:	[[0x43,0x43,0x00,0x00,0x00]],
			notify:			[0x43,0x67,0xde,0xad,0xbe,0xbf],
			getName:		[[0x43,0x52],[]],
			getState:		[[0x43,0x44],[]],
			setCandle1:		[[0x43,0x4c],[]],
			setCandle2:		[[0x43,0xa2],[]],
			setCandle3:		[[0x43,0xa3],[]],
			setCandle4:		[[0x43,0xa4],[]]
		}
	}
	receiveNotification(device,data) {
		console.log("[bluetoothDevice][sendCommand]\t received valueChanged for " + device.friendlyName + "\t" + util.inspect(data) + " type=" + typeof(data));
		let res = "N/A";
		let workState = {};
		let returnState = [];
		switch (data[1]) {
			case 0x45: // state result
				if (data[2] == 0x01) res="on";
				if (data[2] == 0x02) res="off";
				if (data[3] == 0x01) res=res+";color mode";
				if (data[3] == 0x02) res=res+";white mode";
				if (data[3] == 0x03) res=res+";flow mode";
				res = res + ";red:" + data[4] + ";green:" + data[5] + ";blue:" + data[6];
				res = res + ";[7]:" + data[7] + ";[8]:" + data[8] + ";[9]:" + data[9];
				workState.setColor = {red: data[4], green: data[5], blue: data[6]};
				workState.setLevel = {level:data[8]};
				if (data[2] == 0x01) workState.on = "on";
				if (data[2] == 0x02) workState.off = "off";
			break;
			case 0x63: // pairing result
				if (data[2] == 0x01) res = "Pair requested"
				if (data[2] == 0x02) res = "Pair Success"
				if (data[2] == 0x03) res = "Pair Failed"
				if (data[2] == 0x04) res = "Pair PairedDevice"
				if (data[2] == 0x05) res = "Pair WTF??"
				if (data[2] == 0x06) res = "Pair UnknownState"
				if (data[2] == 0x07) res = "Pair Disconnected"
			break;
			case 0x53: // get name
				res = "got name :" + data.slice(5).toString();
			break;
			case 0x51: // set name
			break;
		}
		const cmdDetails = deviceCmds[this.lanDeviceType].validCommands;
		console.log("[bluetoothDevice][recNotify]\t received data result=" + res + " on/off bit=" + data[2] + " bright: " + data[8]);
		if (!cmdDetails) {
			console.log("[bluetoothDevice][recNotify]\t  cmdDetails not found, cannot update State");
			return nil;
		}
		let retState = {}
		cmdDetails.forEach( (cmd) => {
			if (workState.cmd.cmd) {
				retState[cmd.state] = workState[cmd.cmd];
			}
		});
		console.log("[bluetoothDevice][recNotify]\t returning state updates" + util.inspect(retState));
		this.processStateUpdate(device,retState)
		return retState
}
	async sendCommand(retState, cmd, ...args) {
		const bleCmd = [];
		const cmdDetails = deviceCmds[this.lanDeviceType].validCommands.find( cm => cm.cmd == cmd );
		let returnStateUpdate = false
		if (!cmdDetails) {
			console.log("[bluetoothDevice][sendCommand]\t WEIRD ERROR CmdDetails not found for " + cmd);
			return null;
		}
		retState[cmdDetails.state] = false;
		this.cmdLookup[cmd][0].forEach( (val,ind) => bleCmd.push(val) );
		if (cmd=="setLevel") {
			let level = args[1].level;
			if (cmdDetails.max) level = Math.floor( (level/100) * cmdDetails.max );
			bleCmd.push(parseInt(args[1].level.toString(16),16));
			returnStateUpdate = args[1];
		} else if (cmd=="setColor") {
			bleCmd.push(parseInt(args[1].red.toString(16),16));
			bleCmd.push(parseInt(args[1].green.toString(16),16));
			bleCmd.push(parseInt(args[1].blue.toString(16),16));
			returnStateUpdate = args[1];
		} else {
			returnStateUpdate = cmd;
		}
		this.cmdLookup[cmd][1].forEach( (val,ind) => bleCmd.push(val) );
		bleCmd.length = 18
		const self = this;
		const adapter = await this.server.getAdapter();
		if ( (!this.bleDevice.isConnected) || !(await this.bleDevice.isConnected()) ){
			try {
				console.log("[bluetoothDevice][sendCommand]\t Connecting to " + this.mac + " " + this.friendlyName );
				this.bleDevice = await adapter.waitDevice(this.mac,20 * 10000);
				//this.bleDevice = await adapter.waitDevice(self.mac);
				console.log("[bluetoothDevice][sendCommand]\t Connected to " + self.mac + " " + self.friendlyName );
				if (self.bleDevice) {
					await self.bleDevice.connect();
					self.bleDevice.gattServer = await self.bleDevice.gatt();
					self.bleDevice.serviceRef = await self.bleDevice.gattServer.getPrimaryService(self.config.SERVICE_UUID);
					self.bleDevice.controlCharacteristic = await self.bleDevice.serviceRef.getCharacteristic(self.config.CONTROL_UUID);
					self.bleDevice.notifyCharacteristic = await self.bleDevice.serviceRef.getCharacteristic(self.config.NOTIFY_UUID);
					self.bleDevice.notifyCharacteristic.on("valuechanged", (data) => self.receiveNotification(self, data));
					await self.bleDevice.notifyCharacteristic.startNotifications();
				} else {
					console.log("[bluetoothDevice][sendCommand]\t Cannot connect to Device " + self.friendlyName );
					return retState;
				}
			} catch(er) {
				console.log("[bluetoothDevice][sendCommand]\t Cannot reach Device " + self.friendlyName + " " + er );
				return retState;
			}
		}
		
		try {
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(self.bleMagic),{"type":"reliable"}); //command, request, reliable
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleCmd),{"type":"reliable"}); //command, request, reliable
		} catch (er) {
			console.log("[bluetoothDevice][sendCommand]\t Device writes failed " + er );
			return retState;
		}
		
		// */
		retState[cmdDetails.state] = returnStateUpdate;
		//Object.keys(subcmd).forEach( (ar) => retState[ar] = subcmd[ar]);
		//console.log("[bluetoothDevice][sendCommand]\t  returing State=" + util.inspect(retState));
		return retState;
	}
}

module.exports = baseDevice;
module.exports.rfxDevice = rfxDevice
module.exports.iphoneDevice = iphoneDevice;
module.exports.btConnectableDevice = btConnectableDevice;