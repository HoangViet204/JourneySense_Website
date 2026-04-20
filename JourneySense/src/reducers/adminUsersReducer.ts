import * as T from '../constants/adminUserTypes'
import type { AdminUserListItemDto } from '../types/portal'

export interface AdminUsersState {
  loading: boolean
  error: string | null
  items: AdminUserListItemDto[]
  page: number
  pageSize: number
  totalCount: number
}

const initialState: AdminUsersState = {
  loading: false,
  error: null,
  items: [],
  page: 1,
  pageSize: 10,
  totalCount: 0,
}

export default function adminUsersReducer(
  state: AdminUsersState = initialState,
  action: { type: string; payload?: unknown },
): AdminUsersState {
  switch (action.type) {
    case T.ADMIN_USERS_LOADING:
      return { ...state, loading: true, error: null }
    case T.ADMIN_USERS_SUCCESS: {
      const p = action.payload as {
        items: AdminUserListItemDto[]
        page: number
        pageSize: number
        totalCount: number
      }
      return {
        ...state,
        loading: false,
        error: null,
        items: p.items,
        page: p.page,
        pageSize: p.pageSize,
        totalCount: p.totalCount,
      }
    }
    case T.ADMIN_USERS_ERROR:
      return {
        ...state,
        loading: false,
        error: typeof action.payload === 'string' ? action.payload : 'Lỗi tải danh sách',
      }
    default:
      return state
  }
}
