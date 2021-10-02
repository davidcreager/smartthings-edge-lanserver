
local config = require('config')
local commands = require('commands')
local lifecycle_handler = {}

function lifecycle_handler.init(driver, device)
  -------------------
  -- Set up scheduled
  -- services once the
  -- driver gets
  -- initialized.

  -- Ping schedule.
  device.thread:call_on_schedule(
    config.SCHEDULE_PERIOD,
    function ()
      --return commands.command(driver, device,"ping")
	  return commands.command(driver, device, {command="ping"})
    end,
    'Ping schedule')

  -- Refresh schedule
  device.thread:call_on_schedule(
    config.SCHEDULE_PERIOD,
    function ()
      --return commands.command(driver, device,"refresh")
	  return commands.command(driver, device, {command="refresh"})
    end,
    'Refresh schedule')
end

function lifecycle_handler.added(driver, device)
  -- Once device has been created
  -- at API level, poll its state
  -- via refresh command and send
  -- request to share server's ip
  -- and port to the device os it
  -- can communicate back.
  --commands.refresh(nil, device)
  --commands.ping(driver.server.ip, driver.server.port, device)
  --commands.command(driver, device,"refresh")
  --commands.command(driver, device,"ping")
  commands.command(driver, device, {command="refresh"})
  commands.command(driver, device, {command="ping"})
end

function lifecycle_handler.removed(driver, device)
  -- Notify device that the device
  -- instance has been deleted and
  -- parent node must be deleted at
  -- device app.
	--commands.command(driver, device,"remove")
	commands.command(driver, device, {command="remove"})

  -- Remove Schedules created under
  -- device.thread to avoid unnecessary
  -- CPU processing.
  for timer in pairs(device.thread.timers) do
    device.thread:cancel_timer(timer)
  end
end

return lifecycle_handler
