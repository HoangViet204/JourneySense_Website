import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useQueryPage(defaultPage = 1, paramName = 'page') {
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = parseInt(searchParams.get(paramName) ?? String(defaultPage), 10) || defaultPage
  const [page, setPage] = useState(initial)

  // update URL when page changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (page > 1) params.set(paramName, String(page))
    else params.delete(paramName)
    setSearchParams(params, { replace: true })
  }, [page, paramName, setSearchParams])

  // sync when navigation/back changes search params
  useEffect(() => {
    const p = parseInt(searchParams.get(paramName) ?? String(defaultPage), 10) || defaultPage
    if (p !== page) setPage(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return [page, setPage] as const
}
