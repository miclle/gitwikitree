export type MouseNavigationEvent = {
  type?: string
  button?: number
}

export function isPrimaryClick(event: MouseNavigationEvent): boolean {
  return event.type !== 'auxclick' && (event.button ?? 0) === 0
}

export function isMiddleClick(event: MouseNavigationEvent): boolean {
  return event.type === 'auxclick' && event.button === 1
}

export function shouldHandleNavigationClick(event: MouseNavigationEvent): boolean {
  return isPrimaryClick(event) || isMiddleClick(event)
}
