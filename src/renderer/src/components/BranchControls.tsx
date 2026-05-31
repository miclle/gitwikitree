import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, GitBranch, Plus, Search, X } from 'lucide-react'
import type { RepositoryPayload, RepositoryRef } from '../../../shared/types'

export function BranchControls({
  repository,
  loading,
  isGlobalSearchOpen,
  onOpenGlobalSearch,
  onCheckoutBranch,
  onOpenBranchWorktree
}: {
  repository: RepositoryPayload
  loading: boolean
  isGlobalSearchOpen: boolean
  onOpenGlobalSearch: () => void
  onCheckoutBranch: (branch: string) => Promise<void>
  onOpenBranchWorktree: (ref: string) => Promise<void>
}): React.JSX.Element {
  const { t } = useTranslation()
  const branchPickerRef = useRef<HTMLDivElement | null>(null)
  const [isBranchPickerOpen, setIsBranchPickerOpen] = useState(false)
  const [branchPickerTab, setBranchPickerTab] = useState<'branches' | 'remotes'>('branches')
  const [branchQuery, setBranchQuery] = useState('')
  const [branchActionRef, setBranchActionRef] = useState<string | undefined>()
  const selectedBranchAction = repository.refs.find((ref) => ref.name === branchActionRef)
  const primaryWorkspaceBranch =
    repository.refs.find((ref) => ref.type === 'local' && ref.worktreePath === repository.rootPath)
      ?.name ??
    repository.branch ??
    'HEAD'
  const branchQueryTerms = branchQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const visibleRefs = repository.refs.filter((ref) => {
    if (branchQueryTerms.length === 0) return true
    const name = ref.name.toLocaleLowerCase()
    return branchQueryTerms.every((term) => name.includes(term))
  })
  const localRefs = visibleRefs.filter((ref) => ref.type === 'local')
  const remoteRefs = visibleRefs.filter((ref) => ref.type === 'remote')
  const displayedBranchRefs = branchPickerTab === 'branches' ? localRefs : remoteRefs

  const closeBranchPicker = useCallback((): void => {
    setIsBranchPickerOpen(false)
    setBranchPickerTab('branches')
    setBranchQuery('')
  }, [])

  useEffect(() => {
    if (!isBranchPickerOpen) return

    const handlePointerDown = (event: PointerEvent): void => {
      if (!branchPickerRef.current) {
        closeBranchPicker()
        return
      }

      if (branchPickerRef.current.contains(event.target as Node)) return
      closeBranchPicker()
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [closeBranchPicker, isBranchPickerOpen])

  const closeBranchActionModal = (): void => {
    setBranchActionRef(undefined)
  }

  const openBranchActionModal = (refName: string): void => {
    setBranchActionRef(refName)
    closeBranchPicker()
  }

  const handleBranchRefSelect = (ref: RepositoryRef): void => {
    if (ref.current) {
      closeBranchPicker()
      return
    }

    if (ref.worktreePath) {
      closeBranchPicker()
      void onOpenBranchWorktree(ref.name)
      return
    }

    openBranchActionModal(ref.name)
  }

  return (
    <div className="sidebar-controls">
      <div className="branch-picker" ref={branchPickerRef}>
        <button
          className="branch-pill"
          type="button"
          aria-label={t('branch.switchBranches')}
          aria-expanded={isBranchPickerOpen}
          disabled={loading}
          onClick={() => setIsBranchPickerOpen((open) => !open)}
        >
          <GitBranch size={15} />
          <span title={repository.activeRef}>{repository.activeRef}</span>
          <ChevronDown size={15} />
        </button>
        {isBranchPickerOpen && (
          <div
            className="branch-picker-popover"
            role="dialog"
            aria-label={t('branch.switchBranches')}
          >
            <div className="branch-picker-header">
              <strong>{t('branch.switchBranches')}</strong>
              <button
                type="button"
                aria-label={t('branch.closePicker')}
                onClick={() => setIsBranchPickerOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
            <label className="branch-picker-search">
              <Search size={16} />
              <input
                value={branchQuery}
                placeholder={t('branch.findPlaceholder')}
                onChange={(event) => setBranchQuery(event.target.value)}
              />
            </label>
            <div className="branch-picker-tabs" role="tablist" aria-label={t('branch.refs')}>
              <button
                type="button"
                role="tab"
                aria-selected={branchPickerTab === 'branches'}
                onClick={() => setBranchPickerTab('branches')}
              >
                {t('branch.branches')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={branchPickerTab === 'remotes'}
                onClick={() => setBranchPickerTab('remotes')}
              >
                {t('branch.remotes')}
              </button>
            </div>
            <div className="branch-picker-list">
              {displayedBranchRefs.map((ref) => (
                <button
                  className="branch-picker-row"
                  type="button"
                  key={`${ref.type}:${ref.name}`}
                  onClick={() => handleBranchRefSelect(ref)}
                >
                  <span aria-hidden="true">{ref.current ? '✓' : ''}</span>
                  <span title={ref.name}>{ref.name}</span>
                  {ref.current && <strong>{t('branch.current')}</strong>}
                  {!ref.current && ref.worktreePath && <strong>{t('branch.open')}</strong>}
                </button>
              ))}
              {displayedBranchRefs.length === 0 && (
                <div className="branch-picker-empty">{t('branch.empty')}</div>
              )}
            </div>
          </div>
        )}
      </div>
      {selectedBranchAction && (
        <div
          className="branch-action-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={t('branch.chooseAction', { name: selectedBranchAction.name })}
          onMouseDown={closeBranchActionModal}
        >
          <section className="branch-action-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="branch-action-heading">
              <div>
                <span>{t('branch.selectedBranch')}</span>
                <strong title={selectedBranchAction.name}>{selectedBranchAction.name}</strong>
              </div>
              <button
                type="button"
                aria-label={t('branch.closeAction')}
                onClick={closeBranchActionModal}
              >
                <X size={15} />
              </button>
            </div>
            <div className="branch-action-options">
              <button
                className="branch-action-option"
                type="button"
                disabled={loading || selectedBranchAction.type !== 'local'}
                onClick={() => {
                  const branch = selectedBranchAction.name
                  closeBranchActionModal()
                  void onCheckoutBranch(branch)
                }}
              >
                <strong>
                  {t('branch.switchPrimary', {
                    from: primaryWorkspaceBranch,
                    to: selectedBranchAction.name
                  })}
                </strong>
                <span>
                  {t('branch.switchPrimaryDescription', {
                    branch: selectedBranchAction.name
                  })}
                </span>
              </button>
              <button
                className="branch-action-option"
                type="button"
                disabled={loading}
                onClick={() => {
                  const ref = selectedBranchAction.name
                  closeBranchActionModal()
                  void onOpenBranchWorktree(ref)
                }}
              >
                <strong>{t('branch.createWorktree')}</strong>
                <span>{t('branch.createWorktreeDescription')}</span>
              </button>
            </div>
            {selectedBranchAction.type !== 'local' && (
              <p className="branch-action-note">{t('branch.remoteNote')}</p>
            )}
            <button className="branch-action-cancel" type="button" onClick={closeBranchActionModal}>
              {t('common.cancel')}
            </button>
          </section>
        </div>
      )}
      <button className="sidebar-control-button" type="button" aria-label={t('app.add')}>
        <Plus size={16} />
      </button>
      <button
        className="sidebar-control-button"
        type="button"
        aria-label={t('app.searchFiles')}
        aria-expanded={isGlobalSearchOpen}
        onClick={onOpenGlobalSearch}
      >
        <Search size={16} />
      </button>
    </div>
  )
}
