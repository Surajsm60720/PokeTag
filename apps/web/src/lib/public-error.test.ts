import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clientAddress } from "./auth/client-ip";
import { publicError } from "./public-error";

describe("publicError", () => {
  it("keeps a short vault message", () => {
    assert.equal(
      publicError(new Error("Run not found."), "Upload failed"),
      "Run not found."
    );
  });

  it("hides infrastructure details", () => {
    assert.equal(
      publicError(
        new Error("TURSO_AUTH_TOKEN is required when TURSO_DATABASE_URL is set"),
        "Upload failed"
      ),
      "Upload failed"
    );
    assert.equal(
      publicError(new Error("fetch failed https://example.turso.io"), "Download failed"),
      "Download failed"
    );
  });
});

describe("clientAddress", () => {
  it("uses the platform address instead of a caller-supplied first hop", () => {
    const headers = new Headers({
      "x-real-ip": "203.0.113.8",
      "x-forwarded-for": "1.2.3.4, 203.0.113.8",
    });
    assert.equal(clientAddress(headers), "203.0.113.8");
  });

  it("falls back to the last forwarded hop", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.2.3.4, 198.51.100.20",
    });
    assert.equal(clientAddress(headers), "198.51.100.20");
  });
});
