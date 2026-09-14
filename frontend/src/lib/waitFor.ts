export async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 30_000,
  intervalMs = 300
): Promise<number> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return Date.now() - start;
    } catch { /* account not yet visible. expected during transitions */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`timeout waiting for ${label} after ${timeoutMs}ms`);
}
