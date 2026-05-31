import { type MouseEvent as ReactMouseEvent, type Ref } from 'react'

export function ImagePreview({
  name,
  src,
  rootRef,
  onPreviewImageClick
}: {
  name: string
  src: string
  rootRef: Ref<HTMLDivElement>
  onPreviewImageClick: (container: HTMLElement, event: ReactMouseEvent<HTMLElement>) => void
}): React.JSX.Element {
  return (
    <div
      ref={rootRef}
      className="image-preview"
      onClick={(event) => onPreviewImageClick(event.currentTarget, event)}
    >
      <img alt={name} src={src} />
    </div>
  )
}

function svgPreviewDataUrl(content: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(content)}`
}

export function SvgPreview({
  name,
  content,
  rootRef,
  onPreviewImageClick
}: {
  name: string
  content: string
  rootRef: Ref<HTMLDivElement>
  onPreviewImageClick: (container: HTMLElement, event: ReactMouseEvent<HTMLElement>) => void
}): React.JSX.Element {
  return (
    <ImagePreview
      name={name}
      src={svgPreviewDataUrl(content)}
      rootRef={rootRef}
      onPreviewImageClick={onPreviewImageClick}
    />
  )
}
