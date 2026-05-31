import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { AppSettings } from '../../../shared/types'

type SettingsDialogProps = {
  settings: AppSettings
  onClose: () => void
  onSave: (settings: Partial<AppSettings>) => Promise<void>
}

export function SettingsDialog({
  settings,
  onClose,
  onSave
}: SettingsDialogProps): React.JSX.Element {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(settings)
  const [homeFileNamesText, setHomeFileNamesText] = useState(settings.homeFileNames.join('\n'))

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const applySetting = <Key extends keyof AppSettings>(key: Key, value: AppSettings[Key]): void => {
    setDraft((current) => ({ ...current, [key]: value }))
    void onSave({ [key]: value })
  }

  const applyHomeFileNames = (value: string): void => {
    setHomeFileNamesText(value)
    void onSave({
      homeFileNames: value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    })
  }

  return (
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('settings.title')}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <strong>{t('settings.title')}</strong>
          <button type="button" aria-label={t('settings.close')} onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-section" aria-label={t('settings.appearance')}>
            <h2>{t('settings.appearance')}</h2>
            <label className="settings-field">
              <span>{t('settings.theme')}</span>
              <select
                className="settings-control"
                value={draft.appearance}
                onChange={(event) =>
                  applySetting('appearance', event.currentTarget.value as AppSettings['appearance'])
                }
              >
                <option value="system">{t('settings.themeSystem')}</option>
                <option value="light">{t('settings.themeLight')}</option>
                <option value="dark">{t('settings.themeDark')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.language')}</span>
              <select
                className="settings-control"
                value={draft.language}
                onChange={(event) =>
                  applySetting('language', event.currentTarget.value as AppSettings['language'])
                }
              >
                <option value="en">{t('settings.languageEnglish')}</option>
                <option value="zh-CN">{t('settings.languageChinese')}</option>
              </select>
            </label>
          </section>

          <section className="settings-section" aria-label={t('settings.homeFiles')}>
            <h2>{t('settings.homeFiles')}</h2>
            <label className="settings-field">
              <span>{t('settings.candidateOrder')}</span>
              <textarea
                className="settings-control"
                value={homeFileNamesText}
                spellCheck={false}
                rows={5}
                onChange={(event) => applyHomeFileNames(event.currentTarget.value)}
              />
            </label>
          </section>

          <section className="settings-section" aria-label={t('settings.preview')}>
            <h2>{t('settings.preview')}</h2>
            <label className="settings-field">
              <span>{t('settings.font')}</span>
              <select
                className="settings-control"
                value={draft.previewFontFamily}
                onChange={(event) =>
                  applySetting(
                    'previewFontFamily',
                    event.currentTarget.value as AppSettings['previewFontFamily']
                  )
                }
              >
                <option value="system">{t('settings.fontSystem')}</option>
                <option value="sans">{t('settings.fontSans')}</option>
                <option value="serif">{t('settings.fontSerif')}</option>
                <option value="mono">{t('settings.fontMono')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.fontSize')}</span>
              <input
                className="settings-control"
                type="number"
                min={11}
                max={22}
                value={draft.previewFontSize}
                onChange={(event) =>
                  applySetting('previewFontSize', Number(event.currentTarget.value))
                }
              />
            </label>
          </section>

          <section className="settings-section" aria-label={t('settings.editor')}>
            <h2>{t('settings.editor')}</h2>
            <label className="settings-field">
              <span>{t('settings.font')}</span>
              <select
                className="settings-control"
                value={draft.editorFontFamily}
                onChange={(event) =>
                  applySetting(
                    'editorFontFamily',
                    event.currentTarget.value as AppSettings['editorFontFamily']
                  )
                }
              >
                <option value="mono">{t('settings.fontMono')}</option>
                <option value="system">{t('settings.fontSystem')}</option>
                <option value="sans">{t('settings.fontSans')}</option>
                <option value="serif">{t('settings.fontSerif')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.fontSize')}</span>
              <input
                className="settings-control"
                type="number"
                min={11}
                max={22}
                value={draft.editorFontSize}
                onChange={(event) =>
                  applySetting('editorFontSize', Number(event.currentTarget.value))
                }
              />
            </label>
            <label className="settings-field">
              <span>{t('settings.indentWith')}</span>
              <select
                className="settings-control"
                value={draft.editorIndentStyle}
                onChange={(event) =>
                  applySetting(
                    'editorIndentStyle',
                    event.currentTarget.value as AppSettings['editorIndentStyle']
                  )
                }
              >
                <option value="space">{t('settings.spaces')}</option>
                <option value="tab">{t('settings.tabs')}</option>
              </select>
            </label>
            <label className="settings-field">
              <span>{t('settings.indentSize')}</span>
              <select
                className="settings-control"
                value={draft.editorIndentSize}
                onChange={(event) =>
                  applySetting('editorIndentSize', Number(event.currentTarget.value))
                }
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </label>
          </section>
        </div>
      </div>
    </div>
  )
}
