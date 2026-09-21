import { describe, expect, it } from "vitest";
import {
  bogotaParts,
  endOfBogotaDay,
  parseBogotaDateInput,
  startOfBogotaDay,
  startOfBogotaMonth,
} from "./timezone";

describe("timezone Bogotá", () => {
  // 2026-03-15 10:30:00 UTC = 05:30 Bogotá
  const utc = new Date("2026-03-15T10:30:00.000Z");

  it("descompone en partes locales", () => {
    expect(bogotaParts(utc)).toMatchObject({
      year: 2026,
      month: 3,
      day: 15,
      hour: 5,
      minute: 30,
    });
  });

  it("inicio/fin de día en UTC-5", () => {
    expect(startOfBogotaDay(utc)).toBe("2026-03-15T05:00:00.000Z");
    expect(endOfBogotaDay(utc)).toBe("2026-03-16T04:59:59.999Z");
  });

  it("inicio de mes", () => {
    expect(startOfBogotaMonth(utc)).toBe("2026-03-01T05:00:00.000Z");
  });

  it("parsea input yyyy-mm-dd", () => {
    expect(parseBogotaDateInput("2026-09-21")).toBe("2026-09-21T05:00:00.000Z");
    expect(parseBogotaDateInput("2026-09-21", true)).toBe("2026-09-22T04:59:59.999Z");
  });
});
