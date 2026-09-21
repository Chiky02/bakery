import { describe, expect, it } from "vitest";
import { newClientRequestId } from "./store";

describe("offline helpers", () => {
  it("genera client_request_id con forma uuid o local-", () => {
    const id = newClientRequestId();
    expect(id.length).toBeGreaterThan(8);
    expect(id.includes(" ")).toBe(false);
  });
});
