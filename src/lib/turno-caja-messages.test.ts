import { describe, expect, it } from "vitest";
import { SIN_TURNO_CAJA_CODE, SIN_TURNO_CAJA_MSG, sinTurnoCajaResponse } from "./turno-caja";

describe("sinTurnoCajaResponse", () => {
  it("devuelve 409 con código estable", async () => {
    const res = sinTurnoCajaResponse();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe(SIN_TURNO_CAJA_CODE);
    expect(body.error).toBe(SIN_TURNO_CAJA_MSG);
  });
});
