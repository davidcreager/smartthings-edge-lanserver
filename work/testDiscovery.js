const mdns = require("mdns-server");
const fetch = require("node-fetch");
const timeout = 4000;
const browser = new mdns({reuseAddr: true, noInit: true, loopback: true});
browser.on("response", (response) => {
			console.log("[testDiscovery][response]" + " In response ")
			response.additionals?.filter(additional => {return additional.type === "A";})
			.map(async additional => {
				console.log("[testDiscovery][response]" + " additional=" + JSON.stringify(additional));
				try {
					const response = await fetch(`http://${additional.data}/json`);
					if (!response.ok) return;
					const device = (await response.json());
					console.log("[testDiscovery][response]" + " fetched " + JSON.stringify(device));
					const now = new Date();
				} catch (e) {
					console.log(`[testDiscovery][response] Failed to request discovered device data: ${e}`);
				}
			});
});
browser.on("ready", function() {
			browser.query({
				questions: [
					{name: "urn:smartthings-com:device:thingsim", type: "M"},
					],
			});
		});
browser.initServer();
setTimeout(() => {
		console.log("[testDiscovery][timeout] Destroying Browser");
		browser.destroy();
		}, timeout);

