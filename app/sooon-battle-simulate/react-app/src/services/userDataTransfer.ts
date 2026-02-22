interface UserDataExportItem {
  key: string
  value: string
}

interface UserDataExportPayload {
  version: 1
  app: 'sooon-battle-simulate'
  exportedAt: string
  items: UserDataExportItem[]
}

export interface UserDataTransferResult {
  ok: boolean
  message: string
}

const EXPORTED_FILE_PREFIX = 'sooon-user-data'

function isReservedKey(key: string): boolean {
  void key
  return false
}

function listUserDataItems(): UserDataExportItem[] {
  const items: UserDataExportItem[] = []

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || isReservedKey(key)) continue

    const value = localStorage.getItem(key)
    if (value === null) continue

    items.push({ key, value })
  }

  items.sort((left, right) => left.key.localeCompare(right.key))
  return items
}

function buildExportPayload(): UserDataExportPayload {
  return {
    version: 1,
    app: 'sooon-battle-simulate',
    exportedAt: new Date().toISOString(),
    items: listUserDataItems(),
  }
}

function makeExportFileName(): string {
  const stamp = new Date().toISOString().replaceAll('-', '').replaceAll(':', '').replace(/\.\d{3}Z$/, 'Z')
  return `${EXPORTED_FILE_PREFIX}-${stamp}.json`
}

function triggerDownload(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.click()

  URL.revokeObjectURL(objectUrl)
}

function parseImportPayload(raw: unknown): UserDataExportPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const payload = raw as Partial<UserDataExportPayload>

  if (payload.version !== 1 || payload.app !== 'sooon-battle-simulate') return null
  if (!Array.isArray(payload.items)) return null

  const items: UserDataExportItem[] = []
  for (const item of payload.items) {
    if (!item || typeof item !== 'object') continue
    const typed = item as Partial<UserDataExportItem>
    if (typeof typed.key !== 'string' || typeof typed.value !== 'string') continue
    if (isReservedKey(typed.key)) continue
    items.push({ key: typed.key, value: typed.value })
  }

  return {
    version: 1,
    app: 'sooon-battle-simulate',
    exportedAt: typeof payload.exportedAt === 'string' ? payload.exportedAt : '',
    items,
  }
}

function applyImportedItems(items: UserDataExportItem[]): void {
  const importedKeys = new Set(items.map((item) => item.key))
  const existingKeys: string[] = []

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (!key || isReservedKey(key)) continue
    existingKeys.push(key)
  }

  for (const key of existingKeys) {
    if (!importedKeys.has(key)) {
      localStorage.removeItem(key)
    }
  }

  for (const item of items) {
    localStorage.setItem(item.key, item.value)
  }
}

export function exportUserData(): UserDataTransferResult {
  try {
    const payload = buildExportPayload()
    triggerDownload(JSON.stringify(payload, null, 2), makeExportFileName())
    return {
      ok: true,
      message: `导出成功，共 ${payload.items.length} 项`,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '导出失败',
    }
  }
}

export async function importUserData(file: File): Promise<UserDataTransferResult> {
  try {
    const text = await file.text()
    const payload = parseImportPayload(JSON.parse(text) as unknown)
    if (!payload) {
      return {
        ok: false,
        message: '文件格式不正确',
      }
    }

    applyImportedItems(payload.items)
    return {
      ok: true,
      message: `导入成功，共 ${payload.items.length} 项`,
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '导入失败',
    }
  }
}
