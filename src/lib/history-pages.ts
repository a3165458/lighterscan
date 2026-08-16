export const HISTORY_PAGE_SIZE = 40;

export function historyPageOffset(page: number, pageSize = HISTORY_PAGE_SIZE): number {
  const safePage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
  const safeSize = Number.isFinite(pageSize) ? Math.max(1, Math.trunc(pageSize)) : HISTORY_PAGE_SIZE;
  return (safePage - 1) * safeSize;
}

export function visibleHistoryPages(currentPage: number, hasNextPage: boolean): number[] {
  const page = Number.isFinite(currentPage) ? Math.max(1, Math.trunc(currentPage)) : 1;
  const lastKnown = Math.max(page, hasNextPage ? page + 1 : page, page === 1 && hasNextPage ? 3 : 1);
  const start = Math.max(1, Math.min(page - 1, lastKnown - 2));
  const end = Math.min(lastKnown, start + 2);
  const pages: number[] = [];
  for (let value = start; value <= end; value += 1) pages.push(value);
  return pages;
}
