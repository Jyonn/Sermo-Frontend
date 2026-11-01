// Layout/anchor adjustments also emit scroll events. Only a fresh upward user
// gesture may request one older page; prepending that page must not drain history.
export class HistoryPagingIntent {
  private expiresAt = 0;
  arm(now = performance.now()) { this.expiresAt = now + 1200; }
  reset() { this.expiresAt = 0; }
  consume(scrollTop: number, now = performance.now()) {
    if (scrollTop > 24 || !this.expiresAt || now > this.expiresAt) return false;
    this.reset();
    return true;
  }
}
