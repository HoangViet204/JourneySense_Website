type JsonObject = Record<string, unknown>

const PREFIX = 'JourneySense:listUi:'

function storageKey(key: string) {
  return `${PREFIX}${key}`
}

function safeParseJson(raw: string | null): JsonObject | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null
    return v as JsonObject
  } catch {
    return null
  }
}

export function loadListUiState<T extends JsonObject = JsonObject>(key: string): Partial<T> | null {
  if (typeof sessionStorage === 'undefined') return null
  return safeParseJson(sessionStorage.getItem(storageKey(key))) as Partial<T> | null
}

export function patchListUiState<T extends JsonObject = JsonObject>(key: string, patch: Partial<T>): void {
  if (typeof sessionStorage === 'undefined') return

  const k = storageKey(key)
  const prev = safeParseJson(sessionStorage.getItem(k)) ?? {}
  const next = { ...prev, ...patch }
  sessionStorage.setItem(k, JSON.stringify(next))
}

export function clearListUiState(key: string): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(storageKey(key))
}
