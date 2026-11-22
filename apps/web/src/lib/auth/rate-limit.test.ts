import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearLoginFailures,
  loginAllowed,
  recordLoginFailure,
} from "./rate-limit";

describe("login lockout", () => {
  it("blocks an address after repeated failures and clears on success", async () => {
    const ip = "198.51.100.44";
    await clearLoginFailures(ip);

    for (let i = 0; i < 8; i++) {
      assert.equal((await loginAllowed(ip)).ok, true);
      await recordLoginFailure(ip);
    }

    const blocked = await loginAllowed(ip);
    assert.equal(blocked.ok, false);
    assert.ok(blocked.retryAfter > 0);

    await clearLoginFailures(ip);
    assert.equal((await loginAllowed(ip)).ok, true);
  });
});
