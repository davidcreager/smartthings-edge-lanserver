'use strict';
class lanDevice {
	constructor(devProps) {
		this.uniqueName = devProps.uniqueName,
		this.friendlyName = devProps.friendlyName,
		this.deviceID = devProps.deviceID,
		this.alias = devProps.alias,
		this.addressType = devProps.addressType,
		this.config = devProps.config,
		this.mac = devProps.mac,
		this.type = devProps.type,
		this.lanDeviceType = devProps.lanDeviceType,
		this.bleDevice = {}
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
module.exports = lanDevice;