import { type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText } from 'lucide-react'

export function UnsupportedPreview({
  rootRef
}: {
  rootRef: Ref<HTMLDivElement>
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div ref={rootRef} className="unsupported-preview">
      <FileText size={32} />
      <strong>{t('preview.unavailable')}</strong>
      <span>{t('preview.fileUnavailable')}</span>
    </div>
  )
}
