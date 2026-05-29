export type PreviewImage = {
  src: string
  alt: string
  title: string
}

export type PreviewImageElement = {
  src: string
  alt?: string | null
  title?: string | null
}

export type PreviewImagePan = {
  x: number
  y: number
}

const MIN_PREVIEW_IMAGE_ZOOM = 1
const MAX_PREVIEW_IMAGE_ZOOM = 4
const TOGGLED_PREVIEW_IMAGE_ZOOM = 2
const RESET_PREVIEW_IMAGE_PAN: PreviewImagePan = { x: 0, y: 0 }

export function collectPreviewImages(images: ArrayLike<PreviewImageElement>): PreviewImage[] {
  return Array.from(images)
    .map((image) => ({
      src: image.src,
      alt: image.alt?.trim() ?? '',
      title: image.title?.trim() ?? ''
    }))
    .filter((image) => image.src.length > 0)
}

export function findPreviewImageIndex(images: PreviewImage[], src: string): number {
  const index = images.findIndex((image) => image.src === src)
  return index >= 0 ? index : 0
}

export function getSteppedPreviewImageIndex(
  currentIndex: number,
  imageCount: number,
  delta: number
): number {
  if (imageCount <= 0) return 0

  return (currentIndex + delta + imageCount) % imageCount
}

export function getSteppedPreviewImageZoom(currentZoom: number, delta: number): number {
  return Math.min(
    MAX_PREVIEW_IMAGE_ZOOM,
    Math.max(MIN_PREVIEW_IMAGE_ZOOM, Number((currentZoom + delta).toFixed(2)))
  )
}

export function getToggledPreviewImageZoom(currentZoom: number): number {
  return currentZoom > MIN_PREVIEW_IMAGE_ZOOM ? MIN_PREVIEW_IMAGE_ZOOM : TOGGLED_PREVIEW_IMAGE_ZOOM
}

export function clampPreviewImagePan({
  pan,
  zoom,
  imageWidth,
  imageHeight,
  stageWidth,
  stageHeight
}: {
  pan: PreviewImagePan
  zoom: number
  imageWidth: number
  imageHeight: number
  stageWidth: number
  stageHeight: number
}): PreviewImagePan {
  const normalizedZoom = Number.isFinite(zoom) ? zoom : MIN_PREVIEW_IMAGE_ZOOM
  if (normalizedZoom <= MIN_PREVIEW_IMAGE_ZOOM) return RESET_PREVIEW_IMAGE_PAN

  const maxX = Math.max(0, (Math.max(0, imageWidth) * normalizedZoom - Math.max(0, stageWidth)) / 2)
  const maxY = Math.max(
    0,
    (Math.max(0, imageHeight) * normalizedZoom - Math.max(0, stageHeight)) / 2
  )
  const panX = Number.isFinite(pan.x) ? pan.x : 0
  const panY = Number.isFinite(pan.y) ? pan.y : 0

  return {
    x: Math.min(maxX, Math.max(-maxX, panX)),
    y: Math.min(maxY, Math.max(-maxY, panY))
  }
}
