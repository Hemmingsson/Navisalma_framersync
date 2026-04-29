import { describe, expect, it } from "vitest";
import {
  computeGlobalFramerFailure,
  countSyncedForFeed,
} from "./sync-framer-attribution";

describe("countSyncedForFeed", () => {
  it("counts releases in the feed that are not in failedIds", () => {
    const failed = new Set(["b"]);
    const n = countSyncedForFeed(
      [{ encryptedId: "a" }, { encryptedId: "b" }, { encryptedId: "c" }],
      failed,
    );
    expect(n).toBe(2);
  });

  it("returns total length when failedIds is empty", () => {
    expect(countSyncedForFeed([{ encryptedId: "x" }], new Set())).toBe(1);
  });
});

describe("computeGlobalFramerFailure", () => {
  it("is true when nothing synced, errors present, and no per-id failures parsed", () => {
    expect(
      computeGlobalFramerFailure({
        releasesPrepared: 3,
        framerSynced: 0,
        framerErrorCount: 2,
        failedIdsSize: 0,
      }),
    ).toBe(true);
  });

  it("is false when some items synced", () => {
    expect(
      computeGlobalFramerFailure({
        releasesPrepared: 3,
        framerSynced: 1,
        framerErrorCount: 1,
        failedIdsSize: 0,
      }),
    ).toBe(false);
  });

  it("is false when there were no releases to sync", () => {
    expect(
      computeGlobalFramerFailure({
        releasesPrepared: 0,
        framerSynced: 0,
        framerErrorCount: 1,
        failedIdsSize: 0,
      }),
    ).toBe(false);
  });

  it("is false when Framer reported no errors", () => {
    expect(
      computeGlobalFramerFailure({
        releasesPrepared: 2,
        framerSynced: 0,
        framerErrorCount: 0,
        failedIdsSize: 0,
      }),
    ).toBe(false);
  });

  it("is false when at least one error line mapped to an id", () => {
    expect(
      computeGlobalFramerFailure({
        releasesPrepared: 2,
        framerSynced: 0,
        framerErrorCount: 2,
        failedIdsSize: 1,
      }),
    ).toBe(false);
  });
});
