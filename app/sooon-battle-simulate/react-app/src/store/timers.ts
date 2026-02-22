export class TimerRegistry {
  private intervalIds = new Set<number>()

  private timeoutIds = new Set<number>()

  setTrackedInterval(callback: () => void, delay: number): number {
    const id = window.setInterval(callback, delay)
    this.intervalIds.add(id)
    return id
  }

  clearTrackedInterval(id: number | null | undefined): void {
    if (id === null || id === undefined) return
    window.clearInterval(id)
    this.intervalIds.delete(id)
  }

  setTrackedTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(callback, delay)
    this.timeoutIds.add(id)
    return id
  }

  clearTrackedTimeout(id: number | null | undefined): void {
    if (id === null || id === undefined) return
    window.clearTimeout(id)
    this.timeoutIds.delete(id)
  }

  clearAll(): void {
    this.intervalIds.forEach((id) => window.clearInterval(id))
    this.timeoutIds.forEach((id) => window.clearTimeout(id))
    this.intervalIds.clear()
    this.timeoutIds.clear()
  }
}
