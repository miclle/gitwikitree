type InputLike = {
  type?: string
  key?: string
  meta?: boolean
  control?: boolean
  shift?: boolean
}

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
