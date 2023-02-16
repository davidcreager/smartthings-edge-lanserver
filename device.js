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
		this.state = {}; //  state is an object {capability: {attribute: value}, capability: {attribute: value} }
		this.validCommands = []
		this.validCommands = deviceCmds[this.lanDeviceType].validCommands.map( comm => comm.cmd );
		deviceCmds[this.lanDeviceType].validCommands.forEach( (command) => {
			//this.state[command.state] = ( (command.cmd == "on") || (command.cmd == "off") ) ? [command.cmd] : false;
			this[command.cmd] = async function (...args) {
				console.log("[baseClass][" + command.cmd + "]\t\t" + command.cmd + " for " + this.friendlyName + " len of args=" + args.length + " args=" + util.inspect(args) + " args[0]=" + util.inspect(args[0]));
				let response = await this.sendCommand( command.cmd, ...args );
				return response;
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
	getJSONDescription(ip, port) {
		return {
				friendlyName: this.friendlyName,
				uniqueName: this.uniqueName,
				location: "http://" + ip + ":" + port + "/" + this.queryID,
				UDN: "uuid:" + this.id,
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
	processStateUpdate( stateUpdates ) {
	/*
		state looks like -:
			this.state.colorControl.color = { value: { r:1, g:1, b:1 }}
			this.state.switchLevel.level = { value: 50, units:"%" }
			this.state.switch.switch = { value:"on" }
		Updates look like -:
			{capability: "colorControl", attribute: "color", newvalue: { value: { r:1, g:1, b:1 }} }
			{capability: "switchLevel", attribute: "level", newvalue: { value: 50, units:"%" } }  
			{capability: "switch", attribute: "switch", newvalue: {value:"on"}}
	*/
		function deepComp(v1, v2) {
			if ( typeof(v1) != typeof(v2) ) return false
			if ( (v1 && !v2) || (v2 && !v1) ) return false
			if ( typeof(v1) == "undefined" ) return true
			if ( typeof(v1) != "object" )  return v1 == v2
			if ( Object.keys(v1).length != Object.keys(v2).length ) return false
			return Object.keys(v1).every( key => (deepComp( v1[key], v2[key] )) );
		}
		//util.isDeepStrictEqual(v1,v2);
		let stateChanged = false;
		let tmpInp = ( stateUpdates && typeof(stateUpdates) == "object" && Array.isArray(stateUpdates) ) ? stateUpdates : [stateUpdates];
		tmpInp.forEach( state => {
			if ( !state.hasOwnProperty("capability") || !state.hasOwnProperty("attribute") || !state.hasOwnProperty("newValue")  ||
				typeof(state.capability) != "string" || typeof(state.attribute) != "string"
				) {
				console.log("[baseClass][processStateUpdate] invalid stateUpdate " + this.friendlyName + " updatedState=" + util.inspect(updatedState));
				return;
			}
			if (!this.state[state.capability]) {
				stateChanged = true;
				this.state[state.capability] = {}
			}
			if (!this.state[state.capability][state.attribute]) {
				stateChanged = true;
				this.state[state.capability][state.attribute] = {}
			}
			if ( !deepComp(this.state[state.capability][state.attribute], state.newValue) ) {
				stateChanged = true;
				this.state[state.capability][state.attribute] = {...this.state[state.capability][state.attribute], ...state.newValue}
			}
		});
		if (stateChanged) {
			this.emit("device updated", this, this.state);
			console.log("[baseClass][processStateUpdate] \tEmitting device update for " + this.friendlyName + " updatedState=" + util.inspect(this.state));
		}
	}
}
class rfxDevice extends baseDevice {
	constructor(devProps) {
		super(devProps);
		this.rfxInstance = devProps.rfxInstance;
	}
	async sendCommand( cmd, ...args) {
		console.log("[rfxDevice][sendCommand]\t received " + " cmd=" + cmd + " len of args=" + args.length + " args[0]=" + util.inspect(args[0]));
		//console.log("[rfxDevice][sendCommand]\t trying this.rfxInstance[" + cmd + "](" + this.deviceID + ")" )
		this.rfxInstance[cmd](this.deviceID);
	}

}
class iphoneDevice extends baseDevice {
	constructor(devProps) {
		super(devProps);
	}
	async sendCommand( cmd, ...args) {
		console.log("[iphoneDevice][sendCommand]\t Alerting " + this.friendlyName + " deviceID=" + this.deviceID);
		console.log("[iphoneDevice][sendCommand]\t received " + " cmd=" + " len of args=" + args.length + " args[0]=" + util.inspect(args[0]));
		const cmdDetails = deviceCmds[this.lanDeviceType].validCommands.find( cm => cm.cmd == cmd );
		if (!cmdDetails) {
			const errMsg = "WEIRD ERROR CmdDetails not found for " + cmd;
			console.log("[iphoneDevice][sendCommand]\t " + errMsg);
			return {result: false, msg: errMsg, state: null};
		}
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
				const errMsg = "Error sending beep " + self.friendlyName + " response error =" + err + " statuscode=" + resp.statusCode;
				console.log("[iphoneDevice][sendCommand]\t "+ errMsg);
				return {result: false, msg: errMsg, state: self.state[cmdDetails.capability]};
			}
			processStateUpdate({capability: cmdDetails.capability, attribute: cmdDetails.attribute, newValue: "Triggered"})
			return {result: true, msg: "Successful", state: self.state[cmdDetails.capability]};
		});
	}
}
class mqttDevice extends baseDevice {
		constructor(devProps) {
			super(devProps);
		}
		async receiveMessage(topic,data) {
		}
		async sendMessage(topic,data) {
		}

}
class goveeDevice extends baseDevice {
	//000102030405060708090a0b0c0d1910
	//000102030405060708090a0b0c0d2b10
	//It seems like those values are spat out by the bluetooth controller if you write this to the same handle as usual 0x0015:
	//aa040000000000000000000000000000000000ae
	//notify //  00010203-0405-0607-0809-0a0b0c0d2b10 or 00002a05-0000-1000-8000-00805f9b34fb
	constructor(devProps) {
		super(devProps);
		this.mac = devProps.mac;
		this.alias = devProps.alias;
		this.deviceID = devProps.deviceID;
		this.addressType = devProps.addressType;
		this.bleDevice = devProps.bleDevice;
		this.controlPacket = 0x33;
		this.writeCharUUID = "000102030405060708090a0b0c0d2b11";
		this.keepAlivePacket = "aa010000000000000000000000000000000000ab";
	}
	hexify(x) {return ( (Number(x).toString(16).length < 2) ? '0' + Number(x).toString(16) : Number(x).toString(16) ) }
	xorColor(r,g,b) {return (r^b^g)}
	//colorToHex(r,g,b) {return (this.hexify(r) + this.hexify(g) + this.hexify(b))}
	colorToHex(r,g,b) {return ([this.hexify(r), this.hexify(g), this.hexify(b)])}
	hexToColor(s)  {return ( {r: Number("0x" + s.substring(0,2)), g: Number("0x" + s.substring(2,4)),r: Number("0x" + s.substring(4,6))} ) }
	assembleMessage( cmd, value, red, green, blue, isWhite = false, whiteR=0, whiteG=0, whiteB=0) {
		//value = on/off for setPower, level % for setLevel and "manual/music/diy/scene" for color
		const commands = {"setPower": 0x01, "setLevel": 0x04, "setColor": 0x05};
		if ( !commands[cmd] ) throw "Unknown Command " + cmd;
		const colorModes = { "manual": 0x02, "music": 0x01, "scene": 0x04, "diy": 0x0a }
		const tmpValue = (cmd == "setPower") ? (value == "on") ? 0x01 : 0x00 : (cmd == "setLevel") ? hexify( Math.round((value/100) * 254) ) : colorModes[value];
		const scenes = {
				"Sunrise": 0x00,
				"Sunset": 0x01,
				"Movie": 0x04,
				"Dating": 0x05,
				"Romantic": 0x07,
				"Twinkle": 0x08,
				"Candlelight": 0x09,
				"Snowflake": 0x0f,
				"Energetic": 0x10,
				"Breathe": 0x0a,
				"Crossing": 0x14,
				"Rainbow": 0x15
		}
		const color = (isWhite) ? [0,0,0] : [red, green, blue];
		const whiteColor = (isWhite) ? [red, green, blue] : [0,0,0]
		const tmp = [	this.controlPacket,
						commands[cmd],
						tmpValue,
						...this.colorToHex(...color),
						(isWhite) ? 0x1 : 0x0,
						...this.colorToHex(...whiteColor),
						0,0,0,0,0,0,0,0,0
						]
		const checksum = tmp.reduce( (pv,cv) => (pv^cv), 0);
		tmp[19] = checksum;
		//console.log("[assembleMessage] checksum=" + checksum, util.inspect(tmp));
		return tmp;
	}
	async sendCommand( cmd, ...args) {
		const cmdDetails = deviceCmds[this.lanDeviceType].validCommands.find( cm => cm.cmd == cmd );
		if (!cmdDetails) {
			const errMsg = "WEIRD ERROR CmdDetails not found for " + cmd;
			console.log("[goveeDevice][sendCommand]\t " + errMsg);
			return {result: false, msg: errMsg, state: null};
		}
		let statesToReturn = [];
		let bleCmd
		if (cmd=="setLevel") {
			let tmp = {...args[1]}
			if (cmdDetails.max) tmp.level = Math.floor( (tmp.level/100) * cmdDetails.max );
			bleCmd = this.assembleMessage( "setLevel", tmp.level, 0, 0, 0 );
			statesToReturn.push( {capability: "switchLevel", attribute: "level",
										newValue: { value: tmp.level }
										} );
			statesToReturn.push( {capability: "switch", attribute: "switch",
										newValue: { value: "on" }
										} );
		} else if (cmd == "on" || cmd == "off") {
			//bleCmd = this.assembleMessage( "setPower", ((cmd == "on") ? 1 : 0), 0, 0, 0 );
			bleCmd = this.assembleMessage( "setPower", cmd, 0, 0, 0 );
			statesToReturn.push( {capability: "switch", attribute: "switch",
										newValue: { value: cmd }
										} );
		} else if (cmd=="setColor") {
			bleCmd = this.assembleMessage( "setColor", 0x2, parseInt(args[1].red), parseInt(args[1].green), parseInt(args[1].blue) );
			statesToReturn.push( {capability: "colorControl", attribute: "colorRGB",
										newValue: { value: { red: args[1].red, green: args[1].green, blue: args[1].blue } } 
										} );
		}
		const self = this;
		const adapter = await this.server.getAdapter();
		if ( (!this.bleDevice.isConnected) || !(await this.bleDevice.isConnected()) ){
			try {
				console.log("[goveeDevice][sendCommand]\t Connecting to " + this.mac + " " + this.friendlyName );
				this.bleDevice = await adapter.waitDevice(this.mac,20 * 10000);
				//this.bleDevice = await adapter.waitDevice(self.mac);
				console.log("[goveeDevice][sendCommand]\t Connected to " + self.mac + " " + self.friendlyName );
				//uuid 00001801-0000-1000-8000-00805f9b34fb
				//char 00002a05-0000-1000-8000-00805f9b34fb
				//aa050100000000000000000000000000000000ae
				if (self.bleDevice) {
					await self.bleDevice.connect();
					console.log("[goveeDevice][sendCommand]\t Connected to " + this.mac)
					self.bleDevice.gattServer = await self.bleDevice.gatt();
					console.log("[goveeDevice][sendCommand]\t Got gattServer ")
					self.bleDevice.serviceRef = await self.bleDevice.gattServer.getPrimaryService(self.config.SERVICE_UUID);
					console.log("[goveeDevice][sendCommand]\t Got service ref " + self.config.SERVICE_UUID);
					self.bleDevice.otherServiceRef = await self.bleDevice.gattServer.getPrimaryService(self.config.OTHER_SERVICE);
					console.log("[goveeDevice][sendCommand]\t Got other service ref " + self.config.OTHER_SERVICE);
					self.bleDevice.controlCharacteristic = await self.bleDevice.serviceRef.getCharacteristic(self.config.CONTROL_UUID);
					console.log("[goveeDevice][sendCommand]\t Got controlCharacteristic " + self.config.CONTROL_UUID);
					self.bleDevice.statusCharacteristic = await self.bleDevice.otherServiceRef.getCharacteristic(self.config.STATUS_UUID);
					console.log("[goveeDevice][sendCommand]\t Got statusCharacteristic " + self.config.STATUS_UUID);
					self.bleDevice.notifyCharacteristic = await self.bleDevice.serviceRef.getCharacteristic(self.config.NOTIFY_UUID);
					console.log("[goveeDevice][sendCommand]\t Got notifyCharacteristic " + self.config.NOTIFY_UUID)				
					self.bleDevice.notifyCharacteristic.on("valuechanged", (data) => self.receiveNotification(self, data));
					await self.bleDevice.notifyCharacteristic.startNotifications();
					console.log("[goveeDevice][sendCommand]\t Started Notifications " + self.config.NOTIFY_UUID);
					const tmpRead = await self.bleDevice.notifyCharacteristic.readValue();
					console.log("[goveeDevice][sendCommand]\t Read notifyCharacteristic " + self.config.NOTIFY_UUID, util.inspect(tmpRead));
				} else {
					const errMsg = "Cannot connect to Device " + self.friendlyName;
					console.log("[goveeDevice][sendCommand]\t " + errMsg );
					return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
				}
			} catch(er) {
				const errMsg = "Cannot reach Device " + self.friendlyName + " caught error =" + er;
				console.log("[goveeDevice][sendCommand]\t "+ errMsg);
				return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
			}
		}
		try {
			const tmpBle = [0xaa, 0x05, 0x01, 0x00, 0x00,
							0x00, 0x00, 0x00, 0x00, 0x00,
							0x00, 0x00, 0x00, 0x00, 0x00,
							0x00, 0x00, 0x00, 0x00,	0xae];
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(tmpBle)); //command, request, reliable
			console.log("[goveeDevice][sendCommand]\t Wrote Status Req " );
			const tmpRead2 = await self.bleDevice.statusCharacteristic.readValue();
			console.log("[goveeDevice][sendCommand]\t Read Status Req ", util.inspect(tmpRead2));
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleCmd)); //command, request, reliable
		} catch (er) {
			const errMsg = "Device writes failed " + self.friendlyName + " caught error =" + er;
			console.log("[goveeDevice][sendCommand]\t "+ errMsg);
			return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
		}
		this.processStateUpdate(statesToReturn);
		return {result: true, msg: "Successful", state: this.state[cmdDetails.capability]};	
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
		console.log("[bluetoothDevice][receiveNotification]\t received valueChanged for " + device.friendlyName + "\t" + util.inspect(data) + " type=" + typeof(data));
		let res = "N/A";
		let statesToReturn = [];
		switch (data[1]) {
			case 0x45: // state result
				if (data[2] == 0x01) res="on";
				if (data[2] == 0x02) res="off";
				if (data[3] == 0x01) res=res+";color mode";
				if (data[3] == 0x02) res=res+";white mode";
				if (data[3] == 0x03) res=res+";flow mode";
				res = res + ";red:" + data[4] + ";green:" + data[5] + ";blue:" + data[6];
				res = res + ";[7]:" + data[7] + ";[8]:" + data[8] + ";[9]:" + data[9];
				statesToReturn.push( {capability: "colorControl", attribute: "colorRGB",
										newValue: { value: { red: data[4], green: data[5], blue: data[6] } } 
										} );
				statesToReturn.push( {capability: "switchLevel", attribute: "level",
										newValue: { value: data[8] }
										} );
				statesToReturn.push( {capability: "switch", attribute: "switch",
										newValue: { value: ( (data[2] == 0x01) ? "on" : (data[2] == 0x02) ? "off" : null ) }
										} );
			break;
			case 0x63: // pairing result
				if (data[2] == 0x01) res = "Pair requested"
				if (data[2] == 0x02) res = "Pair Success"
				if (data[2] == 0x03) res = "Pair Failed"
				if (data[2] == 0x04) res = "Pair PairedDevice"
				if (data[2] == 0x05) res = "Pair WTF??"
				if (data[2] == 0x06) res = "Pair UnknownState"
				if (data[2] == 0x07) res = "Pair Disconnected"
				statesToReturn.push( {capability: "pairing", attribute: "pairresponse",
										newValue: { value: res }
										} );
			break;
			case 0x53: // get name
				let attrib = "Unknown"
				if (data[3] == 0x00) attrib = "name1"
				if (data[3] == 0x01) attrib = "name2"
				//res = "got " + attrib + " :" + data.slice(1).toString();
				res = data.slice(1).toString();
				//console.log("DEBUG ", data, data.toString(), util.inspect(data))
				statesToReturn.push( {capability: "devicename", attribute: attrib,
										newValue: { value: res }
										} );
			break;
			case 0x51: // set name
			break;
		}
		console.log("[bluetoothDevice][recNotify]\t returning state updates" + util.inspect(statesToReturn,{depth:3}));
		this.processStateUpdate(statesToReturn)
		return statesToReturn
}
	async sendCommand(cmd, ...args) {
		const cmdDetails = deviceCmds[this.lanDeviceType].validCommands.find( cm => cm.cmd == cmd );
		if (!cmdDetails) {
			const errMsg = "WEIRD ERROR CmdDetails not found for " + cmd;
			console.log("[bluetoothDevice][sendCommand]\t " + errMsg);
			return {result: false, msg: errMsg, state: null};
		}
		let statesToReturn = [];
		let bleCmd = [...this.cmdLookup[cmd][0] ];
		if (cmd == "setLevel") {
			let tmp = {...args[1]}
			if (cmdDetails.max) tmp.level = Math.floor( (tmp.level/100) * cmdDetails.max );
			bleCmd.push(parseInt(tmp.level.toString(16),16));
			statesToReturn.push( {capability: "switchLevel", attribute: "level",
										newValue: { value: tmp.level }
										} );
			statesToReturn.push( {capability: "switch", attribute: "switch",
										newValue: { value: "on" }
										} );
		} else if (cmd == "setColor") {
			bleCmd.push(parseInt(args[1].red.toString(16),16));
			bleCmd.push(parseInt(args[1].green.toString(16),16));
			bleCmd.push(parseInt(args[1].blue.toString(16),16));
			statesToReturn.push( {capability: "colorControl", attribute: "colorRGB",
										newValue: { value: { red: args[1].red, green: args[1].green, blue: args[1].blue } } 
										} );
		} else if (cmd == "on" || cmd == "off") {
			statesToReturn.push( {capability: "switch", attribute: "switch",
										newValue: { value: cmd }
										} );
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
					const errMsg = "Cannot connect to Device " + self.friendlyName;
					console.log("[bluetoothDevice][sendCommand]\t " + errMsg );
					return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
				}
			} catch(er) {
				const errMsg = "Cannot reach Device " + self.friendlyName + " caught error =" + er;
				console.log("[bluetoothDevice][sendCommand]\t "+ errMsg);
				return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
			}
		}
		
		try {
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(self.bleMagic),{"type":"reliable"}); //command, request, reliable
			await self.bleDevice.controlCharacteristic.writeValue(Buffer.from(bleCmd),{"type":"reliable"}); //command, request, reliable
		} catch (er) {
			const errMsg = "Device writes failed " + self.friendlyName + " caught error =" + er;
			console.log("[bluetoothDevice][sendCommand]\t "+ errMsg);
			return {result: false, msg: errMsg, state: this.state[cmdDetails.capability]};
		}
		this.processStateUpdate(statesToReturn);
		return {result: true, msg: "Successful", state: statesToReturn};
	}
}

module.exports = baseDevice;
module.exports.rfxDevice = rfxDevice
module.exports.iphoneDevice = iphoneDevice;
module.exports.btConnectableDevice = btConnectableDevice;
module.exports.goveeDevice = goveeDevice;