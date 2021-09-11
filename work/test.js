const ssdpConfig = {
	UDN: "smartLanDevices",
	schema: "urn:schemas-upnp-org:device:",
	path: "/query",
	get USN() {return(this.schema + this.UDN)}
};
console.log("UDN=" + ssdpConfig.UDN + " USN=" + ssdpConfig.USN);