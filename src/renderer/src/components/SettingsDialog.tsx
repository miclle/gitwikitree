import { useEffect, useState } from 'react'
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
        aria-label="Settings"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <strong>Settings</strong>
          <button type="button" aria-label="Close settings" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <div className="settings-content">
          <section className="settings-section" aria-label="Appearance">
            <h2>Appearance</h2>
            <label className="settings-field">
              <span>Theme</span>
              <select
                className="settings-control"
                value={draft.appearance}
                onChange={(event) =>
                  applySetting('appearance', event.currentTarget.value as AppSettings['appearance'])
                }
              >
                <option value="system">Follow system</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          </section>

          <section className="settings-section" aria-label="Home files">
            <h2>Home Files</h2>
            <label className="settings-field">
              <span>Candidate order</span>
              <textarea
                className="settings-control"
                value={homeFileNamesText}
                spellCheck={false}
                rows={5}
                onChange={(event) => applyHomeFileNames(event.currentTarget.value)}
              />
            </label>
          </section>

          <section className="settings-section" aria-label="Preview">
            <h2>Preview</h2>
            <label className="settings-field">
              <span>Font</span>
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
                <option value="system">System</option>
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Mono</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Font size</span>
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

          <section className="settings-section" aria-label="Editor">
            <h2>Editor</h2>
            <label className="settings-field">
              <span>Font</span>
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
                <option value="mono">Mono</option>
                <option value="system">System</option>
                <option value="sans">Sans</option>
                <option value="serif">Serif</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Font size</span>
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
              <span>Indent with</span>
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
                <option value="space">Spaces</option>
                <option value="tab">Tabs</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Indent size</span>
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
