export const TRADE_SCREENSHOTS_BUCKET = 'trade-screenshots'
export const AVATARS_BUCKET = 'avatars'

export type StoredScreenshot = {
  path?: string
  url?: string
  name?: string
  stage?: 'before' | 'during' | 'after'
  caption?: string
}

type SupabaseStorageClient = {
  storage: {
    from: (bucket: string) => {
      createSignedUrl: (
        path: string,
        expiresIn: number
      ) => Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
}

export function getScreenshotStoragePath(item: StoredScreenshot): string | null {
  if (item.path) return item.path
  if (!item.url) return null

  const publicMarker = `/storage/v1/object/public/${TRADE_SCREENSHOTS_BUCKET}/`
  const publicIdx = item.url.indexOf(publicMarker)
  if (publicIdx !== -1) {
    return decodeURIComponent(item.url.slice(publicIdx + publicMarker.length).split('?')[0])
  }

  const bucketMarker = `${TRADE_SCREENSHOTS_BUCKET}/`
  const bucketIdx = item.url.indexOf(bucketMarker)
  if (bucketIdx !== -1) {
    return decodeURIComponent(item.url.slice(bucketIdx + bucketMarker.length).split('?')[0])
  }

  return null
}

export async function getScreenshotDisplayUrl(
  supabase: SupabaseStorageClient,
  item: StoredScreenshot,
  expiresIn = 60 * 60
): Promise<string> {
  const path = getScreenshotStoragePath(item)
  if (!path) return item.url ?? ''

  const { data, error } = await supabase.storage
    .from(TRADE_SCREENSHOTS_BUCKET)
    .createSignedUrl(path, expiresIn)

  if (error || !data?.signedUrl) return item.url ?? ''
  return data.signedUrl
}

export function serializeScreenshots(items: StoredScreenshot[]): StoredScreenshot[] {
  return items.map(({ path, url, name, stage, caption }) => {
    const storedPath = path ?? getScreenshotStoragePath({ url }) ?? undefined
    return {
      ...(storedPath ? { path: storedPath } : { url }),
      name: name ?? 'screenshot',
      ...(stage ? { stage } : {}),
      ...(caption ? { caption } : {}),
    }
  })
}
