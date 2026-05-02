import { useState, useMemo, useEffect } from 'react'

export function usePagination(data, initialPageSize = 10) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Reset to first page if current page exceeds total pages (e.g., after filtering)
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [data.length, totalPages, currentPage])

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, currentPage, pageSize])

  const nextPage = () => setCurrentPage(p => Math.min(totalPages, p + 1))
  const prevPage = () => setCurrentPage(p => Math.max(1, p - 1))
  const goToPage = (page) => setCurrentPage(Math.min(totalPages, Math.max(1, page)))

  return {
    paginatedData,
    currentPage,
    pageSize,
    setPageSize,
    totalPages,
    nextPage,
    prevPage,
    goToPage,
    totalRecords: data.length
  }
}
