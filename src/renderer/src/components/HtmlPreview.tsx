export function HtmlPreview({
  content,
  path,
  rootRef,
  onContentReady
}: {
  content: string
  path: string
  rootRef: (element: HTMLElement | null) => void
  onContentReady: () => void
}): React.JSX.Element {
  const setHtmlPreviewRoot = (element: HTMLIFrameElement | null): void => {
    rootRef(element?.contentDocument?.body ?? null)
  }

  return (
    <iframe
      ref={setHtmlPreviewRoot}
      className="html-preview"
      title={path}
      sandbox="allow-same-origin"
      srcDoc={content}
      onLoad={(event) => {
        setHtmlPreviewRoot(event.currentTarget)
        onContentReady()
      }}
    />
  )
}
