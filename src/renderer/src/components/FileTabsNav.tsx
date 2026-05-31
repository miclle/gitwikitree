import { type CSSProperties, type MutableRefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { iconForNode } from '../app-utils'
import type { OpenFileTab } from '../app-navigation'

type FileTabPopover = {
  tab: OpenFileTab
  left: number
  visible: boolean
}

export function FileTabsNav({
  tabs,
  activeTabId,
  hasUnsavedChanges,
  titlebarTabsRef,
  tabPopover,
  tabPopoverStyle,
  onShowTabPopover,
  onHideTabPopover,
  onTitlebarTabsPointerLeave,
  onSelectTab,
  onCloseTab
}: {
  tabs: OpenFileTab[]
  activeTabId: string | undefined
  hasUnsavedChanges: boolean
  titlebarTabsRef: MutableRefObject<HTMLElement | null>
  tabPopover: FileTabPopover | undefined
  tabPopoverStyle: CSSProperties | undefined
  onShowTabPopover: (tab: OpenFileTab, tabElement: HTMLElement) => void
  onHideTabPopover: (delayed?: boolean) => void
  onTitlebarTabsPointerLeave: (event: React.PointerEvent<HTMLElement>) => void
  onSelectTab: (tab: OpenFileTab) => Promise<void>
  onCloseTab: (id: string) => void
}): React.JSX.Element {
  const { t } = useTranslation()

  return (
    <nav
      className="main-tabs"
      aria-label={t('app.openTabs')}
      ref={titlebarTabsRef}
      onPointerLeave={onTitlebarTabsPointerLeave}
      onBlur={(event) => {
        if (event.currentTarget.contains(event.relatedTarget)) return
        onHideTabPopover()
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId

        return (
          <div
            className={active ? 'main-tab active' : 'main-tab'}
            role="tab"
            tabIndex={0}
            aria-selected={active}
            key={tab.id}
            aria-label={`${tab.name} ${tab.path}`}
            onPointerEnter={(event) => onShowTabPopover(tab, event.currentTarget)}
            onFocus={(event) => onShowTabPopover(tab, event.currentTarget)}
            onClick={() => void onSelectTab(tab)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              void onSelectTab(tab)
            }}
          >
            <span className="main-tab-corner" aria-hidden="true" />
            {iconForNode({ type: tab.type ?? 'file', name: tab.name })}
            <span className="main-tab-name">{tab.name}</span>
            {hasUnsavedChanges && active && (
              <span
                className="main-tab-dirty"
                aria-label={t('app.unsavedChanges')}
                title={t('app.unsaved')}
              />
            )}
            <button
              className="main-tab-close"
              type="button"
              aria-label={t('app.closeTab', { name: tab.name })}
              onClick={(event) => {
                event.stopPropagation()
                onHideTabPopover()
                onCloseTab(tab.id)
              }}
            >
              <X size={13} />
            </button>
          </div>
        )
      })}
      {tabPopover && (
        <span
          className={tabPopover.visible ? 'main-tab-popover visible' : 'main-tab-popover'}
          style={tabPopoverStyle}
          aria-hidden="true"
        >
          <span className="main-tab-popover-name">{tabPopover.tab.name}</span>
          <span className="main-tab-popover-path">{tabPopover.tab.path}</span>
        </span>
      )}
    </nav>
  )
}
