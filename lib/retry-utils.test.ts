import { describe, expect, it } from "vitest";
import {
  ERROR_CATEGORY_VALUES,
  SYNC_ERROR_CATEGORY_HEADS,
} from "./retry-utils";

describe("retry-utils categories", () => {
  it("maps every ERROR_CATEGORY_VALUES entry into SYNC_ERROR_CATEGORY_HEADS", () => {
    for (const c of ERROR_CATEGORY_VALUES) {
      expect(SYNC_ERROR_CATEGORY_HEADS.has(c)).toBe(true);
    }
    expect(ERROR_CATEGORY_VALUES.length).toBe(SYNC_ERROR_CATEGORY_HEADS.size);
  });
});
