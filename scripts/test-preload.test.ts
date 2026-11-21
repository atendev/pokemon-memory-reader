import { expect, test } from "bun:test";

test("the suite refuses a request to a remote host and tells spawned programs to skip the update check", async () => {
  await expect(
    fetch("https://api.github.com/repos/x/y/releases"),
  ).rejects.toThrow("may not fetch api.github.com");
  expect(process.env.PMR_UPDATE_CHECK).toBe("off");
});
