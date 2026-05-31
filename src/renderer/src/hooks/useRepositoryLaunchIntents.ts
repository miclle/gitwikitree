import { useEffect, useRef } from 'react'
import type { RecentFileState, SessionState, TreeItemOpenPayload } from '../../../shared/types'

export function useRepositoryLaunchIntents({
  loadRepositoryPath,
  openFilePath,
  openTreeItem,
  openRepository,
  loadRepositoryWithSession
}: {
  loadRepositoryPath: (repoPath: string) => Promise<void>
  openFilePath: (file: RecentFileState) => Promise<void>
  openTreeItem: (item: TreeItemOpenPayload) => Promise<void>
  openRepository: () => Promise<void>
  loadRepositoryWithSession: (session: SessionState) => Promise<void>
}): void {
  const didRestoreSession = useRef(false)
  const didReceiveOpenIntent = useRef(false)

  useEffect(() => {
    const removeOpenPathListener = window.api.onOpenRepositoryPath((repoPath) => {
      didReceiveOpenIntent.current = true
      void loadRepositoryPath(repoPath)
    })
    const removeOpenFileListener = window.api.onOpenFilePath((file) => {
      didReceiveOpenIntent.current = true
      void openFilePath(file)
    })
    const removeOpenTreeItemListener = window.api.onOpenTreeItem((item) => {
      didReceiveOpenIntent.current = true
      void openTreeItem(item)
    })
    const removeOpenRequestListener = window.api.onOpenRepositoryRequest(() => {
      void openRepository()
    })

    return () => {
      removeOpenPathListener()
      removeOpenFileListener()
      removeOpenTreeItemListener()
      removeOpenRequestListener()
    }
  }, [loadRepositoryPath, openFilePath, openRepository, openTreeItem])

  useEffect(() => {
    if (didRestoreSession.current) return
    didRestoreSession.current = true
    if (didReceiveOpenIntent.current) return

    void window.api.getSession().then((session) => {
      if (didReceiveOpenIntent.current || !session.repositoryPath) return
      void loadRepositoryWithSession(session)
    })
  }, [loadRepositoryWithSession])
}
