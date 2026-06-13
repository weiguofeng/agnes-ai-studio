/**
 * Concurrency Control — 并发控制工具
 * V2.4: 限制批量请求并发数，避免浏览器卡死
 */

/**
 * 带并发限制的异步映射
 * 同时最多处理 concurrency 个任务
 */
export async function asyncMapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const idx = nextIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/**
 * 分批处理
 * 将数组分成 chunkSize 大小的批次，顺序执行每批
 */
export async function asyncBatch<T, R>(
  items: T[],
  chunkSize: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * 带延迟的并发控制
 * 每处理一个任务后等待 delayMs 毫秒（限速）
 */
export async function asyncMapThrottled<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  let completed = 0;

  async function worker(): Promise<void> {
    while (completed < items.length) {
      const idx = completed++;
      await fn(items[idx], idx);
      if (idx < items.length - 1 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return [];
}

export const DEFAULT_CONCURRENCY = 2;
export const DEFAULT_CHUNK_SIZE = 5;
export const DEFAULT_THROTTLE_MS = 500;
