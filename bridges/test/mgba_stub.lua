-- Runs a generated mgba.lua against a stub of mGBA's scripting API, under stock Lua.
-- The stub encodes what the research notes say the API does (spec 4.1, the Emulator Lua
-- runtimes asset), so it catches typos and logic slips in the shim, not API misreadings.
-- Real behaviour waits for the First live run on mGBA ticket.
--
--   lua mgba_stub.lua BRIDGE.lua READ_FRAME_HEX
--
-- Output lines: `bind HOST PORT`, `listen`, `send HEX`, `log TEXT`, `error TEXT`, `closed`, `step N`.

local bridge_path, read_hex = arg[1], arg[2]

local function to_hex(s)
  return (s:gsub(".", function(c) return string.format("%02x", c:byte()) end))
end

local function from_hex(hex)
  return (hex:gsub("%x%x", function(h) return string.char(tonumber(h, 16)) end))
end

local function make_domain(code, size)
  local chunk = {}
  for o = 0, 255 do chunk[#chunk + 1] = string.char((o * 7 + code) % 256) end
  local pattern = string.rep(table.concat(chunk), size // 256 + 1):sub(1, size)
  return {
    size = function() return size end,
    readRange = function(_, offset, length) return pattern:sub(offset + 1, offset + length) end,
  }
end

C = { CHECKSUM = { CRC32 = 1 }, PLATFORM = { GBA = 0, GB = 1 } }

local hooks = {}
callbacks = { add = function(_, name, fn) hooks[name] = fn end }

console = {
  log = function(_, text) print("log " .. text) end,
  error = function(_, text) print("error " .. text) end,
}

local ERRORS = { AGAIN = "again", ADDRESS_IN_USE = "in use" }
local inbox, peer_open = "", true
local sent = {}
local accepted = false
local bind_failures = tonumber(os.getenv("STUB_BIND_FAILURES") or "0")
-- The shim's clock reads os.time. It moves only by STUB_TICK seconds per frame, so tests control it.
local fake_now = 1000
local tick = tonumber(os.getenv("STUB_TICK") or "0")
os.time = function() return fake_now end

local client = {}
function client:receive()
  if #inbox > 0 then
    local data = inbox
    inbox = ""
    return data
  end
  if not peer_open then return nil, "disconnected" end
  return nil, ERRORS.AGAIN
end
function client:send(data)
  sent[#sent + 1] = data
  return #data
end
function client:close() print("closed") end

local server = {}
function server:listen() return true end
function server:accept()
  if accepted then return nil, ERRORS.AGAIN end
  accepted = true
  return client
end
function server:close() end

socket = {
  ERRORS = ERRORS,
  bind = function(host, port)
    print("bind " .. tostring(host) .. " " .. tostring(port))
    if bind_failures > 0 then
      bind_failures = bind_failures - 1
      return nil, ERRORS.ADDRESS_IN_USE
    end
    return server
  end,
}

local function gba()
  return {
    platform = function() return C.PLATFORM.GBA end,
    getGameTitle = function() return "EMERALD" end,
    checksum = function() return 0x1a2b3c4d end,
    memory = { cart0 = make_domain(1, 1048576), wram = make_domain(2, 262144), iwram = make_domain(3, 32768) },
  }
end

local function gb()
  return {
    platform = function() return C.PLATFORM.GB end,
    getGameTitle = function() return "" end,
    checksum = function() return "deadbeef" end,
    memory = { cart0 = make_domain(1, 1048576), wram = make_domain(4, 32768), hram = make_domain(5, 127), sram = make_domain(6, 32768) },
  }
end

emu = gba()

local ok, err = pcall(dofile, bridge_path)
if not ok then
  print("error load failed: " .. tostring(err))
  os.exit(1)
end

local function frame(n)
  fake_now = fake_now + tick
  hooks.frame()
  for _, data in ipairs(sent) do print("send " .. to_hex(data)) end
  sent = {}
  print("step " .. n)
end

frame(1)
inbox = from_hex(read_hex)
frame(2)
-- A reset keeps the ROM: no new game message.
hooks.reset()
frame(3)
-- A different ROM loads.
emu = gb()
hooks.start()
frame(4)
-- The ROM unloads.
emu = nil
hooks.shutdown()
frame(5)
