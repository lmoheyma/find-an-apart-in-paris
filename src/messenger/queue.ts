export interface QueueConfig {
  maxPerHour: number;
  delayMinMs: number;
  delayMaxMs: number;
}

export class MessageQueue {
  private queue: number[] = [];
  private processing = false;
  private sentThisHour = 0;
  private hourStart = Date.now();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private config: QueueConfig,
    private handler: (messageId: number) => Promise<void>,
  ) {}

  enqueue(messageId: number): void {
    this.queue.push(messageId);
    if (!this.processing) {
      this.processing = true;
      void Promise.resolve().then(() => this.processNext());
    }
  }

  size(): number {
    return this.queue.length;
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async processNext(): Promise<void> {
    if (this.stopped || this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;

    // Reset hourly counter if hour has elapsed
    if (Date.now() - this.hourStart >= 3_600_000) {
      this.sentThisHour = 0;
      this.hourStart = Date.now();
    }

    // Rate limit check — wait until next hour window
    if (this.sentThisHour >= this.config.maxPerHour) {
      const waitMs = 3_600_000 - (Date.now() - this.hourStart) + 1000;
      this.timer = setTimeout(() => {
        this.sentThisHour = 0;
        this.hourStart = Date.now();
        this.processNext();
      }, waitMs);
      return;
    }

    const messageId = this.queue.shift()!;
    await this.handler(messageId);
    this.sentThisHour++;

    if (this.queue.length > 0 && !this.stopped) {
      const delay = this.config.delayMinMs + Math.random() * (this.config.delayMaxMs - this.config.delayMinMs);
      this.timer = setTimeout(() => this.processNext(), delay);
    } else {
      this.processing = false;
    }
  }
}
