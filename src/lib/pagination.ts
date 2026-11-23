export const DEFAULT_PAGE_SIZE = 10
export const PAGE_SIZE_OPTIONS = [5, 10, 25] as const

export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<{ rows: T[]; rowCount: number }>,
): Promise<T[]> {
  const pageSize = PAGE_SIZE_OPTIONS[2]
  const rows: T[] = []
  let page = 0
  let rowCount = 0

  do {
    const result = await fetchPage(page, pageSize)
    rows.push(...result.rows)
    rowCount = result.rowCount
    page += 1
    if (result.rows.length === 0) {
      if (rows.length < rowCount) throw new Error('Unable to load all paginated options.')
      break
    }
  } while (rows.length < rowCount)

  return rows
}

type PaginationSearchParams = {
  page?: string | string[]
  pageSize?: string | string[]
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export function parsePaginationSearchParams(searchParams: PaginationSearchParams): {
  page: number
  pageSize: number
} {
  const requestedPage = Number(firstValue(searchParams.page))
  const requestedPageSize = Number(firstValue(searchParams.pageSize))
  const pageSize = PAGE_SIZE_OPTIONS.includes(requestedPageSize as (typeof PAGE_SIZE_OPTIONS)[number])
    ? requestedPageSize
    : DEFAULT_PAGE_SIZE

  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0,
    pageSize,
  }
}

export function replacePaginationSearchParams(
  currentUrl: string,
  pagination: { page: number; pageSize: number },
): string {
  const url = new URL(currentUrl)
  url.searchParams.set('page', String(pagination.page + 1))
  url.searchParams.set('pageSize', String(pagination.pageSize))
  return `${url.pathname}${url.search}${url.hash}`
}
