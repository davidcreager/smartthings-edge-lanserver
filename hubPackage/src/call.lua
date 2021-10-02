--local c = client.new("127.0.0.1", 42417) -- replace the port number here
local client = require "lanclient"
local commands = require("commands")
--local inspect = require "inspect"
local discovery = require "discovery"

local inpCommand = arg[1] or "bollocks"
local devID = arg[2]
print("inpCommand=" .. inpCommand .. " device ID " .. inspect(devID))
if (devID) then
	--local loc = "http://192.168.1.59:13030/" .. devID
	local loc = devID
	--print(" creating -" .. inspect(loc))
	local dev = discovery.findDevice({device_network_id = loc})
	local client = client.new(dev)
	client:command{inpCommand}
	--print(" created -" .. inspect(client))
else
	local devs = discovery.start()
	--print("call 1: devs=" .. inspect(devs));
	for key,val in pairs(devs) do
		print(" Creating Device " .. val.label .. " id=".. inspect(val.device_network_id))
		local client = client.new(val)
		local driver = {server={ip="192.168.1.99",port=8888}}
		--client:command{inpCommand}
		if inpCommand == "ping" then
			client:command{inpCommand,{ip=driver.server.ip, port=driver.server.port}}
		else
			client:command{inpCommand}
		end
		--print(" created -" .. inspect(client))
	end
end

	  --'ST: urn:smartthings-com:device:thingsim:1\r\n'
	  --'ST: urn:schemas-upnp-org:device:smartdev:1\r\n'

