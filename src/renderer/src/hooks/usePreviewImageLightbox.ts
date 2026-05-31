import { useCallback, useEffect, useState } from 'react'
import {
  collectPreviewImages,
  findPreviewImageIndex,
  getSteppedPreviewImageIndex,
  type PreviewImage
} from '../preview-images'
import type { PreviewPayload } from '../../../shared/types'

type ImageLightboxState = {
  images: PreviewImage[]
  index: number
  previewKind: PreviewPayload['kind']
  previewPath: string
}

export function usePreviewImageLightbox({
  previewKind,
  previewPath
}: {
  previewKind: PreviewPayload['kind']
  previewPath: string
}): {
  activeImageLightbox: ImageLightboxState | undefined
  openImageLightbox: (image: HTMLImageElement, container: HTMLElement) => void
  closeImageLightbox: () => void
  stepImageLightbox: (delta: number) => void
} {
  const [imageLightbox, setImageLightbox] = useState<ImageLightboxState | undefined>()
  const activeImageLightbox =
    imageLightbox?.previewKind === previewKind && imageLightbox.previewPath === previewPath
      ? imageLightbox
      : undefined

  const closeImageLightbox = useCallback((): void => {
    setImageLightbox(undefined)
  }, [])

  const stepImageLightbox = useCallback((delta: number): void => {
    setImageLightbox((current) =>
      current
        ? {
            ...current,
            index: getSteppedPreviewImageIndex(current.index, current.images.length, delta)
          }
        : current
    )
  }, [])

  const openImageLightbox = useCallback(
    (image: HTMLImageElement, container: HTMLElement): void => {
      const images = collectPreviewImages(container.querySelectorAll('img'))
      if (images.length === 0) return

      setImageLightbox({
        images,
        index: findPreviewImageIndex(images, image.src),
        previewKind,
        previewPath
      })
    },
    [previewKind, previewPath]
  )

  useEffect(() => {
    if (!activeImageLightbox) return

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeImageLightbox()
        return
      }

      if (event.key === 'ArrowLeft' && activeImageLightbox.images.length > 1) {
        event.preventDefault()
        event.stopPropagation()
        stepImageLightbox(-1)
        return
      }

      if (event.key === 'ArrowRight' && activeImageLightbox.images.length > 1) {
        event.preventDefault()
        event.stopPropagation()
        stepImageLightbox(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeImageLightbox, closeImageLightbox, stepImageLightbox])

  return {
    activeImageLightbox,
    openImageLightbox,
    closeImageLightbox,
    stepImageLightbox
  }
}
