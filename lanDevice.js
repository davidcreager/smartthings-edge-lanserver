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
}
module.exports = lanDevice;