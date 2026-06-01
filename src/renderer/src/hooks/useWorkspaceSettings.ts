import { useCallback, useEffect, useMemo, useState } from 'react'
import { changeAppLanguage, createTranslator } from '../i18n'
import { defaultAppSettings, type AppSettings } from '../../../shared/types'

function fontFamilyForSetting(fontFamily: AppSettings['previewFontFamily']): string {
  if (fontFamily === 'mono') return 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
  if (fontFamily === 'serif') return 'Georgia, Cambria, "Times New Roman", Times, serif'

  return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
}

export function useWorkspaceSettings({
  onHomeFileNamesChange
}: {
  onHomeFileNamesChange: () => void
}): {
  settings: AppSettings
  isSettingsOpen: boolean
  openSettings: () => void
  closeSettings: () => void
  saveSettings: (settings: Partial<AppSettings>) => Promise<void>
  t: ReturnType<typeof createTranslator>
} {
  const [settings, setSettings] = useState<AppSettings>(defaultAppSettings)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const t = useMemo(() => createTranslator(settings.language), [settings.language])

  useEffect(() => {
    changeAppLanguage(settings.language)
    document.documentElement.lang = settings.language === 'zh-CN' ? 'zh-CN' : 'en'
    document.documentElement.dataset.appAppearance = settings.appearance
    document.documentElement.style.setProperty(
      '--preview-font-size',
      `${settings.previewFontSize}px`
    )
    document.documentElement.style.setProperty('--editor-font-size', `${settings.editorFontSize}px`)
    document.documentElement.style.setProperty(
      '--preview-font-family',
      fontFamilyForSetting(settings.previewFontFamily)
    )
    document.documentElement.style.setProperty(
      '--editor-font-family',
      fontFamilyForSetting(settings.editorFontFamily)
    )
  }, [settings])

  useEffect(() => {
    void window.api.getSettings().then(setSettings)

    return window.api.onOpenSettings(() => {
      setIsSettingsOpen(true)
    })
  }, [])

  const openSettings = useCallback((): void => {
    setIsSettingsOpen(true)
  }, [])

  const closeSettings = useCallback((): void => {
    setIsSettingsOpen(false)
  }, [])

  const saveSettings = useCallback(
    async (nextSettings: Partial<AppSettings>): Promise<void> => {
      const previousHomeFileNames = settings.homeFileNames.join('\0')
      const previousHomeFilesEnabled = settings.homeFilesEnabled
      const savedSettings = await window.api.saveSettings(nextSettings)

      setSettings(savedSettings)

      if (
        previousHomeFilesEnabled !== savedSettings.homeFilesEnabled ||
        previousHomeFileNames !== savedSettings.homeFileNames.join('\0')
      ) {
        onHomeFileNamesChange()
      }
    },
    [onHomeFileNamesChange, settings.homeFileNames, settings.homeFilesEnabled]
  )

  return {
    settings,
    isSettingsOpen,
    openSettings,
    closeSettings,
    saveSettings,
    t
  }
}
