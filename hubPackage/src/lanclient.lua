--lanclient.lua
local socket = require 'socket'
local utils = require('st.utils')
local json = require 'dkjson'
local neturl = require('net.url')
local http = require('socket.http')
local ltn12 = require('ltn12')
--local inspect = require("inspect")
local log = require('log')
local config = require('config')
local client = {}
function client.new(meta)
	print('[lanclient:client.new]\t creating client label=' .. (meta.label or "nil") ..
		' location=' .. (meta.location or "nil"))
	-- device metadata table
	local metadata = {}
	for k,v in pairs(meta) do
		metadata[k] = v
	end
	if not metadata.type then
		metadata.type = config.DEVICE_TYPE
		print("[lanclient:client.new]\t type attribute not set, defaulting to " .. config.DEVICE_TYPE)
	end
	if not metadata.profile then
		metadata.profile = config.DEVICE_PROFILE
		print("[lanclient:client.new]\t profile attribute not set, defaulting to " .. config.DEVICE_PROFILE)
	end
	setmetatable(metadata, {__index = client})
	return metadata
end
function client:_call(method, ...)
	local params = {...} or {}
	print("[lanclient:client:_call]\t DEBUG 3 method=" .. method .. " params=",utils.stringify_table(params))
	local url = self.location .. "/" .. method
	local ret,jsonresp = client:send_lan_command(url, params[1])
	if not ret then
		log.error("[lanclient:client:_call]\t Lan Command Failed", jsonresp)
		return nil
	end
	return jsonresp or true
end
function client:command(command)
	print("[lanclient:client:command]\t DEBUG 2 command=" .. utils.stringify_table(command)," command.command=",command.command)
	--return self:_call(command[1].command, command[1].args)
	return self:_call(command.command, command.args)
end
-- Send LAN HTTP Request
function client:send_lan_command(url, query)
	local dest_url = neturl.parse(url)
	local res_body = {}
	if query then
		for k,v in pairs(query) do
			dest_url.query[k] = v
		end
	end
	print("[lanclient:client:send_lan_command]\t DEBUG 4 dest_url=" .. dest_url:build() .. " url=" .. url .. " query=" .. utils.stringify_table(query))
	local _,code,_ = http.request{
					url = dest_url:build(),
					sink = ltn12.sink.table(res_body)
					}
	if code == 200 then
		print("[lanclient:client:send_lan_command]\t DEBUG 5 Received Response", table.concat(res_body), " for ",dest_url)
		return true, table.concat(res_body)
	end
	log.error('[lanclient:client:send_lan_command]\t http failed code=' .. (code or "nil"))
	return false, table.concat(res_body)
end
return client