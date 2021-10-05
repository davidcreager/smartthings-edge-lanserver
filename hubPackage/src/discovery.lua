local socket = require('socket')
local utils = require('st.utils')
local http = require('socket.http')
local ltn12 = require('ltn12')
local log = require('log')
local config = require('config')
-- XML modules
local xml2lua = require "xml2lua"
local xml_handler = require "xmlhandler.tree"
local lanclient = require('lanclient')
--local inspect = require("inspect")

-----------------------
-- SSDP Response parser
local function parse_ssdp(data)
  local res = {}
  res.status = data:sub(0, data:find('\r\n'))
  for k, v in data:gmatch('([%w-\\.]+): ([%a+-: /=]+)') do
    res[k:lower()] = v
  end
  --print("parse_ssdp: data=" .. inspect(data))
  --print("parse_ssdp: res=" .. inspect(res))
  return res
end

-- Fetching device metadata via
-- <device_location>/<device_name>.xml
-- from SSDP Response Location header
local function fetch_device_info(url)
  local response = {}
  local _, status = http.request({
    url=url,
    sink=ltn12.sink.table(response)
  })
  if (status == 200) then
	  local xmlres = xml_handler:new()
	  local xml_parser = xml2lua.parser(xmlres)
	  xml_parser:parse(table.concat(response))
	  local meta = xmlres.root.root.device
	  if not xmlres.root or not meta then
		log.error('discover:fetch_device: Failed to fetch Metadata url=' .. (url or "nil"))
		return nil
	  end
	  --log.trace("DEBUG meta=" .. utils.stringify_table(meta))
	  print("[discovery][fetch_device_info]\t Fetched name=" .. meta.friendlyName .. " modelName=" .. meta.modelName .. " queryID=" .. meta.queryID)
	  return { name = meta.friendlyName, id = meta.id, location = meta.location,
				device_network_id = meta.queryID,
				UDN = meta.UDN, vendor = meta.UDN, mn = meta.manufacturer, model = meta.modelName }	  
   end
   return nil
end
local function find_device(devsFound, currentDevs, devToFind)
-- executes udp search and returns a list of potential devices  
-- ignoring any devices already found or existing in driver.  If devToFind is supplied it finds it
	local devsFound = devsFound or {}
	local currentDevs = currentDevs or {}
	local devIDtoFind = devToFind or nil
	print("discovery:find_device: finding " .. (devIDtoFind or "N/A"), " requested " .. (devToFind or "N/A"))
	local upnp = socket.udp()
	upnp:setsockname('*', 0)
	upnp:setoption('broadcast', true)
	--upnp:settimeout(config.MC_TIMEOUT)
	log.info('===== SCANNING NETWORK...')
	local timeouttime = socket.gettime() + config.MC_TIMEOUT + .5 -- + 1/2 for network delay
	upnp:sendto(config.MSEARCH, config.MC_ADDRESS, config.MC_PORT)
	local parsed = nil
	local devFound = false
	repeat
		local time_remaining = math.max(0, timeouttime-socket.gettime())
		upnp:settimeout(time_remaining)
		local res,errOrIP,_ = upnp:receivefrom()
		--print(inspect(res))
		if res and errOrIP ~= "timeout" then
			parsed = parse_ssdp(res)
			--print("find_device parsed is " .. inspect(parsed))
			--print("find_device name=" .. inspect(parsed["name.smartthings.com"]) .. " parsed.usn " .. inspect(parsed.usn) .. " devsFound[] ")
			--print("find_device: Checking devIDtoFind=",devIDtoFind," parsed.usn=",parsed.usn, " devFound=", devFound )
			if devIDtoFind and parsed and parsed.usn == devIDtoFind then
				--print("find_device: Found devIDtoFind=",devIDtoFind," parsed.usn=",parsed.usn)
				devFound = true
			end
			if (not devFound) and 
				( (devIDtoFind) or (not parsed) or (not parsed.usn) or devsFound[parsed.usn] or currentDevs[parsed.usn] ) then
				parsed = nil
			end
		end
	until parsed ~= nil or errOrIP == "timeout" or res == nil
	upnp:close()
	return parsed
end
local function make_device(fetchedMeta)
--make_device takes metadata from the device description (fetch_device_info) and makes it into something for the driver
  --print("make_device: fetchedMeta=" .. inspect(fetchedMeta))
  --local profiles = { rfxcom = "SmartBlind.v1", bluetoothConnect = "SmartDevice.v1", findIphone = "SmartBeep.v1"}
  --local profile = profiles[fetchedMeta.model] or config.DEVICE_PROFILE
	log.info('discover:make_device: called for name=' .. (fetchedMeta.name or "nil") .. 
							' profile=' .. (fetchedMeta.model or "nil") ..
							' device_network_id=' .. (fetchedMeta.device_network_id or "nil") )
  local metadata = {
    type = config.DEVICE_TYPE,
    device_network_id = fetchedMeta.device_network_id,
	location = fetchedMeta.location,
	UDN = fetchedMeta.UDN,
    label = fetchedMeta.name,
    profile = fetchedMeta.model,
    manufacturer = fetchedMeta.mn,
    model = fetchedMeta.model,
    vendor_provided_label = string.gsub(fetchedMeta.UDN,"uuid:",""),
	id = fetchedMeta.id
  }
  return metadata
end
local disco = {}
function disco.findDevice(device)
-- findDevice finds a device by sending udp search(find_device), 
-- then fetching the device description (fetch_device_info), then making a device (make_device)
	log.info("discover:disco.findDevice: About to try and find device "  .. (device.label or "nil") ..
					" device_network_id=" .. (device.device_network_id or "nil")
					)
	local fetchedMeta
	local advertisedDev = find_device(nil,nil,device.device_network_id)
	if advertisedDev then
		--log.info("discover:disco.findDevice: Advertised Device found name=" .. (advertisedDev.name or "nil") ..
		--			" location=" .. (advertisedDev.location or "nil")
		--			)
		fetchedMeta = fetch_device_info(advertisedDev.location .. "/query")
		if not fetchedMeta then
			log.error("discover:disco.findDevice: fetchedMeta  NOT found label=" .. (advertisedDev.label or "nil") ..
						" location=" .. (advertisedDev.location or "nil") ..
						" device_network_id=" .. (advertisedDev.device_network_id or "nil")
						)
			return nil
		else
			--log.info("discover:disco.findDevice: fetchedMeta found name=" .. (fetchedMeta.name or "nil") ..
			--			" location=" .. (fetchedMeta.location or "nil") ..
			--			" device_network_id=" .. (fetchedMeta.device_network_id or "nil")
			--			)
		end		
	else
		log.error("discover:disco.findDevice: Advertised Device NOT found label=" .. (device.label or "nil") ..
					" device_network_id=" .. (device.device_network_id or "nil")
					)
		return nil
	end
	return make_device(fetchedMeta)
end
function disco.start(driver, options, should_continue)
	local known_devices = {}
	local device_list = driver and driver:get_devices() or {}
	for i, device in ipairs(device_list) do
		local id = device.device_network_id
		known_devices[id] = device
	end
	local advertisedDevs = {}
	local maxToFind = 500
	local cnt = 0
	
	repeat 
	-- check time here I guess
		local find_result = find_device(advertisedDevs,known_devices)
		if (find_result) then
			cnt = cnt + 1
			advertisedDevs[find_result.usn] = find_result
		end
	until (find_result == nil or cnt >= maxToFind) 
	
	local devList = {}
	for _, potDev in pairs(advertisedDevs) do 
		local devDescription = fetch_device_info(potDev.location .. "/query")
		if  devDescription then
			local dev = make_device(devDescription)
			log.info("discover:disco.start: Device about to be made " .. (dev.label or "nil") ..
						" location=" .. (dev.location or "nil") ..
						" device_network_id=" .. (dev.device_network_id or "nil")
						)
			if (driver) then
				dev.client = lanclient.new(dev)
				local newDevice = driver:try_create_device(dev)
				--newDevice:set_field("client", dev)
				log.debug("discover:disco.start: Device made for ",dev.client.label)
			else
				log.debug("discover:disco.start: No driver for ",dev.label)
				devList[dev.id] = dev
			end
		else
			log.error("discover:disco.start: call to fetch_device_info failed label=" .. (potDev.label or "nil") ..
						" location=" .. (potDev.location or "nil") ..
						" device_network_id=" .. (potDev.device_network_id or "nil")
						)
		end		
	end
	return devList
end


return disco
