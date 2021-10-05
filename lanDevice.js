'use strict';
class lanDevice {
	constructor(devProps) {
		this.uniqueName = devProps.uniqueName;
		this.friendlyName = devProps.friendlyName;
		this.deviceID = devProps.deviceID;
		this.alias = devProps.alias;
		this.addressType = devProps.addressType;
		this.config = devProps.config;
		this.mac = devProps.mac;
		this.type = devProps.type;
		this.lanDeviceType = devProps.lanDeviceType;
		this.bleDevice = {};
	}
	get modelName(){
		const profileLookup = {candela: "SmartCandela.v1",
								bedside: "SmartBedside.v1",
								iphone: "SmartBeep.v1",
								rfxcom: "SmartBlind.v1",
								};
		return ( profileLookup[this.lanDeviceType] || "SmartDevice.v1" );
	}
}

class ssdpDevice {
	constructor({deviceType, friendlyName, UDN, location, id, modelDescription, queryID, modelName} = {}) {
		this.deviceType = deviceType;
		this.friendlyName = friendlyName;
		this.UDN = UDN;
		this.location = location;
		this.id = id;
		this.manufacturer = "DHC EA Consulting";
		this.modelName = modelName;
		this.modelNumber = "0001.0001";
		this.modelDescription = modelDescription;
		this.serialNumber = "0001001";
		this.queryID = queryID;
	}
}	
class ssdpDescription {
	constructor(ssdpDevice) {
		this.root = { $: {"xmlns": "urn:schemas-upnp-org:device-1-0" + " configId=" + "configuration number"} };
		this.specVersion = {major:1,minor:0};
		this.device = ssdpDevice;
	}
}
module.exports = lanDevice;
module.exports.ssdpDescription = ssdpDescription;
module.exports.ssdpDevice = ssdpDevice;