import materialIconManifest from 'material-icon-theme/dist/material-icons.json'

type IconManifest = {
  iconDefinitions: Record<string, { iconPath: string }>
  fileExtensions: Record<string, string>
  fileNames: Record<string, string>
  file: string
  folder: string
  folderExpanded: string
  folderNames: Record<string, string>
  folderNamesExpanded: Record<string, string>
}

type TreeIconNode = {
  name: string
  type: 'file' | 'directory'
}

type TreeIcon = {
  alt: string
  src: string
}

const manifest = materialIconManifest as IconManifest
const materialIconUrls = import.meta.glob('../../../node_modules/material-icon-theme/icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?url'
}) as Record<string, string>

function iconUrlForId(iconId: string | undefined): string | undefined {
  if (!iconId) return undefined

  const iconPath = manifest.iconDefinitions[iconId]?.iconPath
  const fileName = iconPath?.split('/').at(-1)
  if (!fileName) return undefined

  return materialIconUrls[`../../../node_modules/material-icon-theme/icons/${fileName}`]
}

function extensionCandidates(name: string): string[] {
  const parts = name.split('.')
  if (parts.length <= 1) return []

  return parts
    .slice(1)
    .map((_, index) => parts.slice(index + 1).join('.'))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
}

function fileIconId(name: string): string {
  const lowerName = name.toLowerCase()
  const exactMatch = manifest.fileNames[lowerName]
  if (exactMatch) return exactMatch

  for (const extension of extensionCandidates(lowerName)) {
    const extensionMatch = manifest.fileExtensions[extension]
    if (extensionMatch) return extensionMatch
  }

  return manifest.file
}

function folderIconId(name: string, expanded: boolean): string {
  const lowerName = name.toLowerCase()
  const folderNames = expanded ? manifest.folderNamesExpanded : manifest.folderNames
  const defaultFolder = expanded ? manifest.folderExpanded : manifest.folder

  return folderNames[lowerName] ?? defaultFolder
}

export function getTreeIcon(node: TreeIconNode, expanded = false): TreeIcon | undefined {
  const iconId =
    node.type === 'directory' ? folderIconId(node.name, expanded) : fileIconId(node.name)
  const src = iconUrlForId(iconId)

  return src ? { alt: '', src } : undefined
}
