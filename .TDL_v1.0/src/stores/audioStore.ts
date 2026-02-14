import { create } from 'zustand'

interface AudioState {
  currentAudioId: string | null
  playAudio: (id: string) => void
  stopAudio: (id?: string) => void
}

export const useAudioStore = create<AudioState>((set, get) => ({
  currentAudioId: null,

  playAudio: (id) => set({ currentAudioId: id }),

  stopAudio: (id) => {
    const { currentAudioId } = get()
    if (!id || id === currentAudioId) {
      set({ currentAudioId: null })
    }
  },
}))
