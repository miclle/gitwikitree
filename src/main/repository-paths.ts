import { isAbsolute, relative, resolve, sep } from 'path'

export function toPosixPath(path: string): string {
  return path.split(sep).join('/')
}

export function safeJoin(repoPath: string, relativePath = ''): string {
  const target = resolve(repoPath, relativePath)
  const rel = relative(repoPath, target)

  if (!(rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)))) {
    throw new Error('Path is outside the selected repository.')
  }

  return target
}

export function assertSafeGitRelativePath(relativePath: string): void {
  if (
    relativePath.includes('\0') ||
    relativePath.startsWith('/') ||
    relativePath.split('/').includes('..')
  ) {
    throw new Error('Invalid file path.')
  }
}
