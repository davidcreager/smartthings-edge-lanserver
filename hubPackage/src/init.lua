local Driver = require('st.driver')
local caps = require('st.capabilities')

local discovery = require('discovery')
local lifecycles = require('lifecycles')
local server = require('server')
local commands = require('commands')
--------------------
-- Driver definition
local driver =
  Driver(
    'LAN-SmartDevice',
    {
      discovery = discovery.start,
      lifecycle_handlers = lifecycles,
      supported_capabilities = {
        caps.switch,
        caps.refresh,
		caps.tone
      },
      capability_handlers = {
        [caps.switch.ID] = {
          [caps.switch.commands.on.NAME] = commands.command,
          [caps.switch.commands.off.NAME] = commands.command
        },
        [caps.refresh.ID] = {
          [caps.refresh.commands.refresh.NAME] = commands.command
        },
		[caps.tone.ID] = {
          [caps.tone.commands.beep.NAME] = commands.command
        }
      }
    }
  )

---------------------------------------
-- Switch control for external commands
function driver:command(device, command)
 log.debug("init:driver:command Received command via server id=" .. (device.id or "nil").. " command was " .. (command or "nil"))
end

-----------------------------
-- Initialize Hub server
-- that will open port to
-- allow bidirectional comms.
server.start(driver)

--------------------
-- Initialize Driver
driver:run()
