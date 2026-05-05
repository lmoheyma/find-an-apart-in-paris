import { logger } from "../logger.js";

export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(
    private cycleFn: () => Promise<void>,
    private intervalMs: number,
  ) {}

  start(): void {
    this.stopped = false;
    logger.info({ intervalMs: this.intervalMs }, "Scheduler started");
    this.runCycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("Scheduler stopped");
  }

  isRunning(): boolean {
    return this.running;
  }

  private async runCycle(): Promise<void> {
    if (this.stopped) return;

    this.running = true;
    const start = Date.now();

    try {
      await this.cycleFn();
    } catch (error) {
      logger.error({ error }, "Scheduler cycle error");
    }

    this.running = false;
    const elapsed = Date.now() - start;
    logger.debug({ elapsed }, "Cycle complete");

    if (!this.stopped) {
      const nextDelay = Math.max(0, this.intervalMs - elapsed);
      this.timer = setTimeout(() => this.runCycle(), nextDelay);
    }
  }
}
