import { isExternalLink, resolveMarkdownLinkPath } from './markdown-preview'
import type { MarkdownLinkContext } from '../../shared/types'

function decodeHash(hash: string): string {
  try {
    return decodeURIComponent(hash)
  } catch {
    return hash
  }
}

function getHrefHash(href: string): string | undefined {
  const hashIndex = href.indexOf('#')
  if (hashIndex < 0) return undefined

  const hash = href.slice(hashIndex + 1)
  return hash ? decodeHash(hash) : undefined
}

export function createMarkdownLinkTarget({
  href,
  sourcePath,
  previewPath
}: {
  href: string
  sourcePath: string
  previewPath: string
}): MarkdownLinkContext | undefined {
  const trimmedHref = href.trim()
  if (!trimmedHref) return undefined

  if (isExternalLink(trimmedHref)) {
    return {
      kind: 'external',
      href: trimmedHref
    }
  }

  const hash = getHrefHash(trimmedHref)
  if (trimmedHref.startsWith('#')) {
    return {
      kind: 'anchor',
      href: trimmedHref,
      targetPath: previewPath,
      ...(hash ? { hash } : {})
    }
  }

  const targetPath = resolveMarkdownLinkPath(trimmedHref, sourcePath)
  if (!targetPath) {
    return {
      kind: 'unresolved',
      href: trimmedHref
    }
  }

  return {
    kind: 'internal',
    href: trimmedHref,
    targetPath,
    ...(hash ? { hash } : {})
  }
}
