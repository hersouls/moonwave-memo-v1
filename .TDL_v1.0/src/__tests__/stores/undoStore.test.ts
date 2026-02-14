import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUndoStore } from '@/stores/undoStore'

describe('undoStore', () => {
  beforeEach(() => {
    // Reset store state
    useUndoStore.setState({
      undoStack: [],
      redoStack: [],
      currentToast: null,
      toastTimeoutId: null,
    })
    vi.useFakeTimers()
  })

  it('should push an action to undo stack', () => {
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: '작업 완료',
      undo: async () => {},
      redo: async () => {},
    })

    const state = useUndoStore.getState()
    expect(state.undoStack).toHaveLength(1)
    expect(state.undoStack[0].label).toBe('작업 완료')
    expect(state.currentToast).toBeTruthy()
    expect(state.redoStack).toHaveLength(0)
  })

  it('should generate unique IDs for actions', () => {
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: 'Action 1',
      undo: async () => {},
      redo: async () => {},
    })
    store.pushAction({
      type: 'delete',
      label: 'Action 2',
      undo: async () => {},
      redo: async () => {},
    })

    const state = useUndoStore.getState()
    expect(state.undoStack[0].id).not.toBe(state.undoStack[1].id)
  })

  it('should undo the last action', async () => {
    const undoFn = vi.fn()
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: '작업 완료',
      undo: undoFn,
      redo: async () => {},
    })

    await useUndoStore.getState().undo()

    expect(undoFn).toHaveBeenCalledOnce()
    const state = useUndoStore.getState()
    expect(state.undoStack).toHaveLength(0)
    expect(state.redoStack).toHaveLength(1)
  })

  it('should redo the last undone action', async () => {
    const redoFn = vi.fn()
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: '작업 완료',
      undo: async () => {},
      redo: redoFn,
    })

    await useUndoStore.getState().undo()
    await useUndoStore.getState().redo()

    expect(redoFn).toHaveBeenCalledOnce()
    const state = useUndoStore.getState()
    expect(state.undoStack).toHaveLength(1)
    expect(state.redoStack).toHaveLength(0)
  })

  it('should dismiss toast and clear timeout', () => {
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: 'test',
      undo: async () => {},
      redo: async () => {},
    })

    expect(useUndoStore.getState().currentToast).toBeTruthy()

    useUndoStore.getState().dismissToast()
    expect(useUndoStore.getState().currentToast).toBeNull()
  })

  it('should auto-dismiss toast after timeout', () => {
    const store = useUndoStore.getState()
    store.pushAction({
      type: 'complete',
      label: 'test',
      undo: async () => {},
      redo: async () => {},
    })

    expect(useUndoStore.getState().currentToast).toBeTruthy()
    vi.advanceTimersByTime(5000)
    expect(useUndoStore.getState().currentToast).toBeNull()
  })

  it('should limit stack size to 20', () => {
    const store = useUndoStore.getState()
    for (let i = 0; i < 25; i++) {
      store.pushAction({
        type: 'complete',
        label: `Action ${i}`,
        undo: async () => {},
        redo: async () => {},
      })
    }

    expect(useUndoStore.getState().undoStack.length).toBeLessThanOrEqual(20)
  })
})
