import { create } from 'zustand'

interface PwaUpdateState {
  isUpdateAvailable: boolean
  waitingWorker: ServiceWorker | null
  showUpdate: (worker: ServiceWorker) => void
  applyUpdate: () => void
  dismiss: () => void
}

export const usePwaUpdateStore = create<PwaUpdateState>()((set, get) => ({
  isUpdateAvailable: false,
  waitingWorker: null,

  showUpdate: (worker) => {
    set({ isUpdateAvailable: true, waitingWorker: worker })
  },

  applyUpdate: () => {
    const { waitingWorker } = get()
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    set({ isUpdateAvailable: false, waitingWorker: null })
  },

  dismiss: () => {
    set({ isUpdateAvailable: false })
  },
}))
