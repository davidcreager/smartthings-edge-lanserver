var ssdp = require('node-ssdp').Client
  , client = new ssdp({})
const searchQuery = ( (process.argv.length>2) ? process.argv[2] : "ssdp:all")
const fullOrSummary = ( (process.argv.length>3) ? process.argv[3] : "summary")
console.log("args should be ssdpclienttest <search string><full|summary>")
console.log("searching for " + searchQuery + " showing " + fullOrSummary)
client.on('notify', function () {
  //console.log('Got a notification.')
})


let foundDevices = {};
client.on('response', function inResponse(headers, code, rinfo) {
		let wk = headers.LOCATION;
		const tmp = !(! (headers.ST == searchQuery || searchQuery == "ssdp:all"))
		if (tmp) {
			if (!headers.USN || !foundDevices[headers.USN]) {
				if (fullOrSummary == "summary") {
					if (headers.LOCATION.indexOf("description.xml")!=-1) wk = headers.LOCATION.slice(0,(headers.LOCATION.indexOf("description.xml")));
					console.log("stchk=" + tmp + " location = " + wk + " ST=" + headers.ST + " USN=" + headers.USN )
				} else {
					console.log("--------------------------------------------------------------------------------------")
					console.log("location =" + headers.LOCATION + " ST=" + headers.ST + " USN=" + headers.USN )
					console.log(JSON.stringify(headers))
				}
				foundDevices[headers.USN] = headers;
			}
		}
})
//client.search('urn:smartthings-com:device:')
//client.search('ssdp:all')
//client.search('urn:schemas-upnp-org:service:ContentDirectory:1')
//client.search("urn:smartthings-com:device:thingsim:1")
//urn:schemas-upnp-org:device:smartdev:1
//client.search("urn:schemas-upnp-org:device:smartdev:1")
//client.search("urn:schemas-upnp-org:device:smartdev")
client.search(searchQuery);
// Or maybe if you want to scour for everything after 5 seconds
setInterval(function() {
  //client.search('ssdp:all')
}, 5000)

// And after 10 seconds, you want to stop
setTimeout(function () {
   client.stop()
	}, 10000)
