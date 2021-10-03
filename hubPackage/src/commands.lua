local caps = require('st.capabilities')
local utils = require('st.utils')
local neturl = require('net.url')
local log = require('log')
local json = require('dkjson')
local http = require('socket.http')
local ltn12 = require('ltn12')
--local inspect = require('inspect')
local lanclient = require('lanclient')
local discovery = require('discovery')

local command_handler = {}
local function get_client(device)
	local drvDevice = device
	log.info("[command_handler.get_client]\t label=" .. (drvDevice.label or "nil") .. " device_network_id=" .. (drvDevice.device_network_id or "nil") )
	local client = drvDevice:get_field("client")
	if not client then
		local foundDevice = discovery.findDevice(drvDevice)
		if foundDevice then
			log.info("[command_handler.get_client]\t created lanclient label=" .. (drvDevice.label or "nil") .. " device_network_id=" .. (drvDevice.device_network_id or "nil") )
			client = lanclient.new(foundDevice)
			drvDevice:set_field("client", client)
			drvDevice:online()
			log.info("[command_handler.get_client]\t created lanclient label=" .. (drvDevice.label or "nil"), "Device online")
		else
			log.error("[command_handler.get_client]\t Couldn't create lanclient label=" .. (drvDevice.label or "nil") .. 
				" device_network_id=" .. (drvDevice.device_network_id or "nil") )
		end
	end

	if not client then
		drvDevice:offline()
		log.info("[command_handler.get_client]\t Unable to reach client label=" .. (drvDevice.label or "nil") .. 
				" device_network_id=" .. (drvDevice.device_network_id or "nil") )

		return nil, "unable to reach lanclient"
	end
	drvDevice:online()
	return client
end
function command_handler.command(driver, device, command)
	--{"capability":"tone","positional_args":[],"command":"beep","component":"main","args":[]}
	local cmd = command.command
	local subcmd = nil
	log.info("[command_handler.command]\t " .. cmd .. " label=" .. (device.label or "nil") .. " device_network_id=" .. (device.device_network_id or "nil") )
	if cmd=="on" or cmd=="off" then
		subcmd = {value=cmd}
		cmd = "power"
	end
	local locClient = assert(get_client(device),"commands:command: Assert client not found")
	log.info("[command_handler.command]\t client="  .. " label=" .. (locClient.label or "nil") .. " location=" .. (locClient.location or "nil"))
	local cmdFunc = {on = caps.switch.switch.on, off = caps.switch.switch.off}
	local commandReturn
	print("[command_handler.command]\tDEBUG 0 cmd=" .. utils.stringify_table(cmd) .. " subcmd=" .. utils.stringify_table(subcmd) .. " self=" .. utils.stringify_table(self));
	if cmd == "ping" then
		commandReturn = locClient:command{cmd,{ip = driver.server.ip, port = driver.server.port}}
	elseif subcmd ~= nil then
		commandReturn = locClient:command{cmd,subcmd}
	else
		commandReturn = locClient:command{cmd}
	end
	if commandReturn then
		local resp,cont,err = json.decode(commandReturn)
		if resp then
			local emitFunc = cmdFunc[resp["value"]]
			print("[command_handler.command]\t About to emit retCmd=", resp["cmd"], " retValue=", resp["value"])
			if (emitFunc) then
				device:emit_event(emitFunc())
			elseif cmd ~= "ping" and cmd ~= "refresh" and cmd ~= "remove" then
				log.info("[command_handler.command]\t unrecognised command=" .. (cmd or "nil") .. " label=" .. 
					(device.label or "nil") .. " device_network_id=" .. 
					(device.device_network_id or "nil") )
			end
		end
	else
		log.info("[command_handler.command]\t Failed command=" .. (cmd or "nil") .. " label=" .. 
			(device.label or "nil") .. " device_network_id=" .. 
			(device.device_network_id or "nil") )
	end
end

return command_handler
