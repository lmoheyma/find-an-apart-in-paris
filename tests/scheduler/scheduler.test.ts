import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Scheduler } from "../../src/scheduler/scheduler.js";

describe("Scheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs the cycle function on start", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(cycleFn).toHaveBeenCalledTimes(1);

    scheduler.stop();
  });

  it("schedules next cycle after completion", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(cycleFn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(cycleFn).toHaveBeenCalledTimes(2);

    scheduler.stop();
  });

  it("does not overlap cycles", async () => {
    let running = 0;
    let maxRunning = 0;
    const cycleFn = vi.fn().mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10000)); // Takes 10s
      running--;
    });
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    // Cycle is running (takes 10s), next would trigger at 5s but should wait
    await vi.advanceTimersByTimeAsync(5000);
    expect(maxRunning).toBe(1); // Never more than 1

    scheduler.stop();
  });

  it("stops cleanly", async () => {
    const cycleFn = vi.fn().mockResolvedValue(undefined);
    const scheduler = new Scheduler(cycleFn, 5000);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.stop();

    await vi.advanceTimersByTimeAsync(10000);
    expect(cycleFn).toHaveBeenCalledTimes(1); // No more after stop
  });
});
