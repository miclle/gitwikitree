type InitialRepositoryPathOptions = {
  envPath?: string
  argv: string[]
  isAbsolutePath: (path: string) => boolean
  isDirectory: (path: string) => boolean
}

export function getInitialRepositoryPath({
  envPath,
  argv,
  isAbsolutePath,
  isDirectory
}: InitialRepositoryPathOptions): string | undefined {
  if (envPath) return envPath

  return argv.slice(1).find((argument) => {
    if (!isAbsolutePath(argument)) return false

    try {
      return isDirectory(argument)
    } catch {
      return false
    }
  })
}
