import { describe, expect, it } from "vitest";
import { runLimitedConcurrency } from "@/lib/runLimitedConcurrency";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("runLimitedConcurrency", () => {
  it("runs tasks with the requested concurrency limit and preserves result order", async () => {
    let active = 0;
    let maxActive = 0;

    const tasks = [0, 1, 2, 3].map((value) => async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active -= 1;
      return `result-${value}`;
    });

    await expect(runLimitedConcurrency(tasks, 2)).resolves.toEqual([
      "result-0",
      "result-1",
      "result-2",
      "result-3",
    ]);
    expect(maxActive).toBe(2);
  });
});
