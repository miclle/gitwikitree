import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import {
  clampPreviewImagePan,
  getSteppedPreviewImageZoom,
  getToggledPreviewImageZoom,
  type PreviewImage,
  type PreviewImagePan
} from '../preview-images'

const IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP = 0.25
const RESET_IMAGE_LIGHTBOX_PAN: PreviewImagePan = { x: 0, y: 0 }

type ImageLightboxDragState = {
  pointerId: number
  startClientX: number
  startClientY: number
  startPan: PreviewImagePan
}

export function ImageLightbox({
  images,
  index,
  onClose,
  onStep
}: {
  images: PreviewImage[]
  index: number
  onClose: () => void
  onStep: (delta: number) => void
}): React.JSX.Element | undefined {
  const { t } = useTranslation()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<ImageLightboxDragState | undefined>(undefined)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<PreviewImagePan>(RESET_IMAGE_LIGHTBOX_PAN)
  const [isDragging, setIsDragging] = useState(false)
  const image = images[index]
  if (!image) return undefined

  const imageLabel = image.alt || image.title || t('preview.image')
  const canNavigate = images.length > 1
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 1
  const zoomLabel = `${Math.round(normalizedZoom * 100)}%`
  const isPannable = normalizedZoom > 1
  const imageClassName = [
    'image-lightbox-image',
    isPannable ? 'is-pannable' : '',
    isDragging ? 'is-dragging' : ''
  ]
    .filter(Boolean)
    .join(' ')
  const clampImageLightboxPan = (
    nextPan: PreviewImagePan,
    nextZoom = normalizedZoom
  ): PreviewImagePan =>
    clampPreviewImagePan({
      pan: nextPan,
      zoom: nextZoom,
      imageWidth: imageRef.current?.clientWidth ?? 0,
      imageHeight: imageRef.current?.clientHeight ?? 0,
      stageWidth: stageRef.current?.clientWidth ?? 0,
      stageHeight: stageRef.current?.clientHeight ?? 0
    })
  const updateImageLightboxZoom = (updater: (currentZoom: number) => number): void => {
    const nextZoom = updater(normalizedZoom)

    setZoom(nextZoom)
    setPan((currentPan) =>
      nextZoom <= 1 ? RESET_IMAGE_LIGHTBOX_PAN : clampImageLightboxPan(currentPan, nextZoom)
    )
  }
  const handleImagePointerDown = (event: ReactPointerEvent<HTMLImageElement>): void => {
    if (!isPannable) return

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPan: pan
    }
    setIsDragging(true)
  }
  const handleImagePointerMove = (event: ReactPointerEvent<HTMLImageElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    setPan(
      clampImageLightboxPan({
        x: drag.startPan.x + event.clientX - drag.startClientX,
        y: drag.startPan.y + event.clientY - drag.startClientY
      })
    )
  }
  const handleImagePointerEnd = (event: ReactPointerEvent<HTMLImageElement>): void => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return

    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = undefined
    setIsDragging(false)
  }

  return (
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={t('preview.image')}
      onClick={onClose}
    >
      <div className="image-lightbox-topbar" onClick={(event) => event.stopPropagation()}>
        <div className="image-lightbox-meta">
          <span className="image-lightbox-title">{imageLabel}</span>
          {canNavigate && (
            <span className="image-lightbox-count">
              {index + 1} / {images.length}
            </span>
          )}
          <span className="image-lightbox-count">{zoomLabel}</span>
        </div>
        <button
          type="button"
          aria-label={t('preview.closeImage')}
          title={t('globalSearch.close')}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>

      {canNavigate && (
        <button
          type="button"
          className="image-lightbox-nav previous"
          aria-label={t('preview.previousImage')}
          title={t('preview.previousImage')}
          onClick={(event) => {
            event.stopPropagation()
            onStep(-1)
          }}
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <div
        ref={stageRef}
        className="image-lightbox-stage"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => {
          event.preventDefault()
          event.stopPropagation()
          updateImageLightboxZoom((currentZoom) =>
            getSteppedPreviewImageZoom(
              currentZoom,
              event.deltaY < 0 ? IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP : -IMAGE_LIGHTBOX_WHEEL_ZOOM_STEP
            )
          )
        }}
      >
        <img
          ref={imageRef}
          alt={imageLabel}
          className={imageClassName}
          src={image.src}
          style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${normalizedZoom})` }}
          title={t('preview.scrollZoom')}
          onDoubleClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            updateImageLightboxZoom(getToggledPreviewImageZoom)
          }}
          onPointerDown={handleImagePointerDown}
          onPointerMove={handleImagePointerMove}
          onPointerUp={handleImagePointerEnd}
          onPointerCancel={handleImagePointerEnd}
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      {canNavigate && (
        <button
          type="button"
          className="image-lightbox-nav next"
          aria-label={t('preview.nextImage')}
          title={t('preview.nextImage')}
          onClick={(event) => {
            event.stopPropagation()
            onStep(1)
          }}
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  )
}
