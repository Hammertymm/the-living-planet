export class RNG {
  private state: number;
  constructor(seed = 421337) { this.state = seed >>> 0; }
  next() {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 4294967296;
  }
  range(min: number, max: number) { return min + (max - min) * this.next(); }
  int(min: number, max: number) { return Math.floor(this.range(min, max + 1)); }
  pick<T>(items: T[]): T { return items[Math.floor(this.next() * items.length)]; }
}
