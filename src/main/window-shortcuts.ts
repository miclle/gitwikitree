type InputLike = {
  type?: string
  key?: string
  meta?: boolean
  control?: boolean
  shift?: boolean
}

export type FileTabShortcutPosition = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export function shouldOpenGlobalSearchFromInput(input: InputLike): boolean {
  return (
    input.type === 'keyDown' &&
    input.shift === true &&
    (input.meta === true || input.control === true) &&
    input.key?.toLocaleLowerCase() === 'f'
  )
}

export function shouldOpenCurrentTabSearchFromInput(input: InputLike): boolean {
  return (
    input.type === 'keyDown' &&
    input.shift !== true &&
    (input.meta === true || input.control === true) &&
    input.key?.toLocaleLowerCase() === 'f'
  )
}

export function getFileTabShortcutPositionFromInput(
  input: InputLike
): FileTabShortcutPosition | undefined {
  if (
    input.type !== 'keyDown' ||
    input.shift === true ||
    (input.meta !== true && input.control !== true)
  ) {
    return undefined
  }

  const position = Number(input.key)
  if (!Number.isInteger(position) || position < 1 || position > 9) return undefined

  return position as FileTabShortcutPosition
}
