import { Menu, type BrowserWindow, type ContextMenuParams } from 'electron'
import { isAbsolute, relative, resolve } from 'path'
import { createBrowserContextMenuItems } from './browser-context-menu'
import type { AppSettings } from '../shared/types'

type BrowserWindowContextMenuOptions = {
  targetWindow: BrowserWindow
  params: ContextMenuParams
  repositoryPath?: string
  language: AppSettings['language']
  isDev: boolean
  openExternal: (url: string) => void
  writeClipboardText: (text: string) => void
}

async function isTreeItemContextMenu(params: ContextMenuParams): Promise<boolean> {
  try {
    return (
      (await params.frame?.executeJavaScript(
        `Boolean(document.elementFromPoint(${params.x}, ${params.y})?.closest('[data-tree-item="true"]'))`
      )) === true
    )
  } catch {
    return false
  }
}

async function isMarkdownLinkContextMenu(params: ContextMenuParams): Promise<boolean> {
  try {
    return (
      (await params.frame?.executeJavaScript(
        `(() => {
          const element = document.elementFromPoint(${params.x}, ${params.y})
          if (element?.closest('img')) return false
          return Boolean(element?.closest('a[data-markdown-link="true"]'))
        })()`
      )) === true
    )
  } catch {
    return false
  }
}

async function getContextMenuImageSourceURLs(params: ContextMenuParams): Promise<{
  imageSourceURL?: string
  imageAbsoluteSourceURL?: string
  imageSourceIsPreviewPath?: boolean
}> {
  try {
    const srcURL = JSON.stringify(params.srcURL)
    const sourceURLs = await params.frame?.executeJavaScript(
      `(() => {
        const sourceURL = ${srcURL}
        const imageAtPoint = document.elementFromPoint(${params.x}, ${params.y})?.closest('img')
        const image = imageAtPoint || Array.from(document.images).find((candidate) => {
          return candidate.currentSrc === sourceURL ||
            candidate.src === sourceURL ||
            candidate.getAttribute('src') === sourceURL
        })
        if (!image) return {}
        const previewImageSource = image.getAttribute('data-preview-image-src')
        return {
          imageSourceURL: previewImageSource || image.getAttribute('src') || '',
          imageAbsoluteSourceURL: image.getAttribute('data-preview-image-absolute-src') || '',
          imageSourceIsPreviewPath: previewImageSource !== null
        }
      })()`
    )

    if (!sourceURLs || typeof sourceURLs !== 'object') return {}
    const maybeSourceURLs = sourceURLs as {
      imageSourceURL?: unknown
      imageAbsoluteSourceURL?: unknown
      imageSourceIsPreviewPath?: unknown
    }

    return {
      ...(typeof maybeSourceURLs.imageSourceURL === 'string' &&
      maybeSourceURLs.imageSourceURL.length > 0
        ? { imageSourceURL: maybeSourceURLs.imageSourceURL }
        : {}),
      ...(typeof maybeSourceURLs.imageAbsoluteSourceURL === 'string' &&
      maybeSourceURLs.imageAbsoluteSourceURL.length > 0
        ? { imageAbsoluteSourceURL: maybeSourceURLs.imageAbsoluteSourceURL }
        : {}),
      ...(maybeSourceURLs.imageSourceIsPreviewPath === true
        ? { imageSourceIsPreviewPath: true }
        : {})
    }
  } catch {
    return {}
  }
}

function resolveRepositoryImageAbsolutePath(
  repositoryPath: string | undefined,
  imageSourceURL: string | undefined
): string | undefined {
  if (!repositoryPath || !imageSourceURL) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(imageSourceURL) || imageSourceURL.startsWith('//')) {
    return undefined
  }

  const absolutePath = isAbsolute(imageSourceURL)
    ? resolve(imageSourceURL)
    : resolve(repositoryPath, imageSourceURL)
  const repositoryRelativePath = relative(repositoryPath, absolutePath)

  if (
    repositoryRelativePath === '' ||
    repositoryRelativePath.startsWith('..') ||
    isAbsolute(repositoryRelativePath)
  ) {
    return undefined
  }

  return absolutePath
}

export async function showBrowserWindowContextMenu({
  targetWindow,
  params,
  repositoryPath,
  language,
  isDev,
  openExternal,
  writeClipboardText
}: BrowserWindowContextMenuOptions): Promise<void> {
  if (await isTreeItemContextMenu(params)) return
  if (await isMarkdownLinkContextMenu(params)) return
  const imageSourceURLs = await getContextMenuImageSourceURLs(params)
  const imageAbsoluteSourceURL =
    imageSourceURLs.imageAbsoluteSourceURL ??
    (imageSourceURLs.imageSourceIsPreviewPath
      ? undefined
      : resolveRepositoryImageAbsolutePath(repositoryPath, imageSourceURLs.imageSourceURL))

  const items = createBrowserContextMenuItems({
    params,
    language,
    isDev,
    ...imageSourceURLs,
    ...(imageAbsoluteSourceURL ? { imageAbsoluteSourceURL } : {}),
    openExternal,
    writeClipboardText,
    copyImageAt: (x, y) => targetWindow.webContents.copyImageAt(x, y),
    inspectElement: (x, y) => targetWindow.webContents.inspectElement(x, y)
  })

  if (items.length === 0) return
  Menu.buildFromTemplate(items).popup({ window: targetWindow })
}
