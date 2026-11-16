-- A fake emulator shim for CI. It serves memory domains from in-memory buffers and fakes the
-- sockets, so the protocol core runs under stock Lua. The byte at offset o of a domain with
-- code c is (o * 7 + c) % 256, which the TypeScript tests recompute.

local M = {}

local DOMAIN_CODES = { rom = 1, ewram = 2, iwram = 3, wram = 4, hram = 5, sram = 6 }

local function make_buffer(code, size)
  local chunk = {}
  for o = 0, 255 do
    chunk[#chunk + 1] = string.char((o * 7 + code) % 256)
  end
  chunk = table.concat(chunk)
  return string.rep(chunk, size // 256 + 1):sub(1, size)
end

function M.new()
  local shim = {
    time = 0,
    logs = {},
    bind_failures = 0,
    fail_read = nil, -- error text for the next read, or nil
    fail_receive = false,
    send_limit = 0, -- bytes per send call, 0 for no limit
    conns = {},
    pending = {}, -- connections waiting for accept
    outbox = {}, -- { id = n, data = string } or { id = n, close = true }
    buffers = {},
    game_table = nil,
    bind_hint = "port 7426, adapters.mgba.port",
  }

  function shim.info()
    return { bridge = "mgba", build = "test-build", emulator = { name = "FakeEmu", version = shim.emulator_version } }
  end

  function shim.game() return shim.game_table end
  function shim.clock() return shim.time end
  function shim.log(text) shim.logs[#shim.logs + 1] = text end

  function shim.read(domain, offset, length)
    if shim.fail_read then
      local text = shim.fail_read
      shim.fail_read = nil
      error(text, 0)
    end
    return shim.buffers[domain]:sub(offset + 1, offset + length)
  end

  local server = {}
  function server:accept()
    return table.remove(shim.pending, 1)
  end

  function shim.bind()
    if shim.bind_failures > 0 then
      shim.bind_failures = shim.bind_failures - 1
      return nil, "address in use"
    end
    return server
  end

  function shim.open(id)
    local conn = { id = id, inbox = "", peer_closed = false }
    function conn:receive()
      if shim.fail_receive then
        shim.fail_receive = false
        error("receive blew up", 0)
      end
      if #self.inbox > 0 then
        local data = self.inbox
        self.inbox = ""
        return data
      end
      if self.peer_closed then return nil, "closed" end
      return ""
    end
    function conn:send(data)
      local n = #data
      if shim.send_limit > 0 and n > shim.send_limit then n = shim.send_limit end
      shim.outbox[#shim.outbox + 1] = { id = id, data = data:sub(1, n) }
      return n
    end
    function conn:close()
      shim.outbox[#shim.outbox + 1] = { id = id, close = true }
    end
    shim.conns[id] = conn
    shim.pending[#shim.pending + 1] = conn
  end

  -- sizes maps a domain name to its size. Passing nil unloads the ROM.
  function shim.load(platform, crc32, sha1, rom_name, sizes)
    local domains = {}
    shim.buffers = {}
    for name, size in pairs(sizes) do
      domains[name] = size
      shim.buffers[name] = make_buffer(DOMAIN_CODES[name], size)
    end
    shim.game_table = { platform = platform, crc32 = crc32, sha1 = sha1, romName = rom_name, domains = domains }
  end

  function shim.unload()
    shim.buffers = {}
    shim.game_table = nil
  end

  return shim
end

return M
