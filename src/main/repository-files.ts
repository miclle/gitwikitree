import { promises as fs } from 'fs'
import { join } from 'path'

const excludedDirectoryNames = new Set(['.git', '.worktrees', 'node_modules'])

function toRepositoryPath(path: string): string {
  return path
    .split(/[\\/]+/)
    .filter(Boolean)
    .join('/')
}

export async function getWorkspaceFiles(repoPath: string): Promise<string[]> {
  const files: string[] = []

  async function visit(directory: string, relativeDirectory = ''): Promise<void> {
    const entries = await fs.readdir(directory, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        if (entry.isDirectory() && excludedDirectoryNames.has(entry.name)) return

        const relativePath = toRepositoryPath(join(relativeDirectory, entry.name))
        const absolutePath = join(directory, entry.name)

        if (entry.isDirectory()) {
          await visit(absolutePath, relativePath)
          return
        }

        if (entry.isFile()) {
          files.push(relativePath)
        }
      })
    )
  }

  await visit(repoPath)
  return files.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}
