import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  fetchAllPages,
  parsePaginationSearchParams,
  replacePaginationSearchParams,
} from '@/lib/pagination'

describe('fetchAllPages', () => {
  it('fetches all rows using the largest supported page size', async () => {
    const calls: { page: number; pageSize: number }[] = []
    const rows = await fetchAllPages(async (page, pageSize) => {
      calls.push({ page, pageSize })
      return page === 0
        ? { rows: Array.from({ length: 25 }, (_, index) => index), rowCount: 26 }
        : { rows: [25], rowCount: 26 }
    })

    expect(rows).toHaveLength(26)
    expect(calls).toEqual([{ page: 0, pageSize: 25 }, { page: 1, pageSize: 25 }])
  })

  it('fails explicitly when a later page is unexpectedly empty', async () => {
    await expect(fetchAllPages(async (page) => page === 0
      ? { rows: [1], rowCount: 2 }
      : { rows: [], rowCount: 2 })).rejects.toThrow('Unable to load all paginated options.')
  })
})

describe('parsePaginationSearchParams', () => {
  it('uses the shared default for missing or invalid values', () => {
    expect(parsePaginationSearchParams({})).toEqual({ page: 0, pageSize: DEFAULT_PAGE_SIZE })
    expect(parsePaginationSearchParams({ page: '-2', pageSize: '1000' })).toEqual({
      page: 0,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it.each(PAGE_SIZE_OPTIONS)('accepts the %i-row table option', (pageSize) => {
    expect(parsePaginationSearchParams({ page: '3', pageSize: String(pageSize) })).toEqual({
      page: 2,
      pageSize,
    })
  })
})

describe('replacePaginationSearchParams', () => {
  it('persists the selected page and page size while preserving other parameters', () => {
    expect(replacePaginationSearchParams(
      'https://example.test/patients?status=Active&page=1&pageSize=10',
      { page: 2, pageSize: 25 },
    )).toBe('/patients?status=Active&page=3&pageSize=25')
  })
})
