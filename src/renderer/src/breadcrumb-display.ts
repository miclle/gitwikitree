import type { PreviewPayload } from '../../shared/types'

export type DirectoryReadmeBreadcrumbSource = {
  name: string
  path: string
}

export function getDirectoryReadmeBreadcrumbSource(
  preview: PreviewPayload | undefined
): DirectoryReadmeBreadcrumbSource | undefined {
  if (preview?.kind !== 'directory' || !preview.readme) return undefined

  return {
    name: preview.readme.path.split('/').filter(Boolean).at(-1) ?? preview.readme.path,
    path: preview.readme.path
  }
}
