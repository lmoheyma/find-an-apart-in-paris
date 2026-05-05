import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MessageQueue } from "../../src/messenger/queue.js";

describe("MessageQueue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("processes messages with delay", async () => {
    const processed: number[] = [];
    const handler = async (id: number) => { processed.push(id); };
    const queue = new MessageQueue({ maxPerHour: 5, delayMinMs: 100, delayMaxMs: 200 }, handler);

    queue.enqueue(1);
    queue.enqueue(2);

    // Process first immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(processed).toEqual([1]);

    // Second after delay
    await vi.advanceTimersByTimeAsync(200);
    expect(processed).toEqual([1, 2]);

    queue.stop();
  });

  it("respects rate limit", async () => {
    const processed: number[] = [];
    const handler = async (id: number) => { processed.push(id); };
    const queue = new MessageQueue({ maxPerHour: 2, delayMinMs: 10, delayMaxMs: 20 }, handler);

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);

    await vi.advanceTimersByTimeAsync(100);
    expect(processed).toHaveLength(2); // Only 2 per hour

    queue.stop();
  });

  it("reports queue size", () => {
    const queue = new MessageQueue({ maxPerHour: 5, delayMinMs: 100, delayMaxMs: 200 }, async () => {});
    queue.enqueue(1);
    queue.enqueue(2);
    expect(queue.size()).toBe(2);
    queue.stop();
  });
});
