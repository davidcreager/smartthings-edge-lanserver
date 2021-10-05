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
	log.info("[command_handler.command]\t DEBUG 0 command=" .. utils.stringify_table(command) .. " label=" .. (device.label or "nil") .. " device_network_id=" .. (device.device_network_id or "nil") )
	local client = assert(get_client(device),"commands:command: Assert client not found")
	local cmdFunc = {on = caps.switch.switch.on, off = caps.switch.switch.off}
	local cmd = {command= command.command, args= command.args}
	if command.command == "setColor" then
		local red, green, blue = utils.hsl_to_rgb(command.args.color.hue, command.args.color.saturation)
		cmd.args = {red= red, green= green, blue = blue}
	end
	local commandReturn = client:command{cmd}
	if commandReturn then
		local resp,cont,err = json.decode(commandReturn)
		if resp then
			local emitFunc = cmdFunc[resp["cmd"]]
			if (emitFunc) then
				device:emit_event(emitFunc())
				print("[command_handler.command]\t emitted retCmd=", resp["cmd"], " resp=" .. utils.stringify_table(resp))
			elseif cmd.command == "setColor" then
				--[[
				local hue, sta = utils.rgb_to_hsl(calc_r, calc_g, calc_b)
				device:emit_event(caps.colorControl.saturation(sta))
				device:emit_event(caps.colorControl.hue(hue))
				--]]
			elseif cmd.command ~= "ping" and cmd.command ~= "refresh" and cmd.command ~= "remove" then
				log.info("[command_handler.command]\t unrecognised command=" .. (cmd.command or "nil") .. " label=" .. 
					(device.label or "nil") .. " device_network_id=" .. 
					(device.device_network_id or "nil") )
			end
		end
	else
		log.info("[command_handler.command]\t Failed command=" .. (cmd.command or "nil") .. " label=" .. 
			(device.label or "nil") .. " device_network_id=" .. 
			(device.device_network_id or "nil") )
	end
end

return command_handler
