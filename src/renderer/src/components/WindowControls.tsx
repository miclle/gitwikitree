import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function TitlebarWindowControls(): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <div className="titlebar-window-controls">
      <button
        className="window-control close"
        type="button"
        aria-label={t('app.closeWindow')}
        onClick={() => window.api.controlWindow('close')}
      />
      <button
        className="window-control minimize"
        type="button"
        aria-label={t('app.minimizeWindow')}
        onClick={() => window.api.controlWindow('minimize')}
      />
      <button
        className="window-control zoom"
        type="button"
        aria-label={t('app.toggleFullscreen')}
        onClick={() => window.api.controlWindow('toggle-maximize')}
      />
    </div>
  )
}

export function HistoryButtons({
  canNavigateBack,
  canNavigateForward,
  onNavigate
}: {
  canNavigateBack: boolean
  canNavigateForward: boolean
  onNavigate: (delta: -1 | 1) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label={t('app.back')}
        disabled={!canNavigateBack}
        onClick={() => void onNavigate(-1)}
      >
        <ChevronLeft size={16} />
      </button>
      <button
        className="titlebar-icon-button"
        type="button"
        aria-label={t('app.forward')}
        disabled={!canNavigateForward}
        onClick={() => void onNavigate(1)}
      >
        <ChevronRight size={16} />
      </button>
    </>
  )
}
