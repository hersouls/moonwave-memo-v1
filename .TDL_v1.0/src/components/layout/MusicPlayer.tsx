import { useAudioStore } from '@/stores/audioStore'
import { Pause, Play, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const STORAGE_BASE = 'https://firebasestorage.googleapis.com/v0/b/moonwave-todolist-v1.firebasestorage.app/o'

const TRACKS = [
  'Decode me slow  (Japanese Ver. Part2).wav',
  'Decode me slow (Chinese Ver.).wav',
  'Decode me slow (Japanese Ver. Part1).wav',
  'Decode me slow (Korean Ver.) (1).wav',
  'Decode me slow (Korean Ver.).wav',
  'Glow Not Noise (1).wav',
  'Glow Not Noise (2).wav',
  'Layback Wave (1).wav',
  'Layback Wave.wav',
  'Light In Me (English Ver. Part1).wav',
  'Light In Me (Korea Ver.).wav',
  'light In Me.wav',
  'Light In Me(Chinese Ver.).wav',
  'Light In Me(Japanese Ver.).wav',
  'Neon Fever (Remastered) (1).wav',
  'Neon Fever (Remastered).wav',
  'Rise so Bright (1).wav',
  'Under the Moonlight (3).wav',
  'Under the Moonlight (2).wav',
  'Under the Moonlight (4).wav',
  'Wabie Sync Part2 (1).wav',
  'Wavecoded Part2 (1).wav',
  'Wavie Sync Part1 (2).wav',
  'Wavie Sync Part1 (1).wav',
].map((name) => `${STORAGE_BASE}/music%2F${encodeURIComponent(name)}?alt=media`)

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [volume, setVolume] = useState(0.2)
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const currentAudioId = useAudioStore((state) => state.currentAudioId)
  const playAudio = useAudioStore((state) => state.playAudio)
  const stopAudio = useAudioStore((state) => state.stopAudio)

  // Initialize random track on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * TRACKS.length)
    setCurrentTrackIndex(randomIndex)
  }, [])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Exclusive Playback: Pause BGM if another source starts playing
  useEffect(() => {
    if (currentAudioId && currentAudioId !== 'bgm') {
      setIsPlaying(false)
    }
  }, [currentAudioId])

  // Playback Control
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (currentAudioId !== 'bgm') {
          playAudio('bgm')
        }

        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setIsPlaying(false)
          })
        }
      } else {
        audioRef.current.pause()
        if (currentAudioId === 'bgm') {
          stopAudio('bgm')
        }
      }
    }
  }, [isPlaying, currentAudioId, playAudio, stopAudio])

  // Handle track changes (auto-play next)
  useEffect(() => {
    if (isPlaying && audioRef.current) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }, [currentTrackIndex])

  // Initial Autoplay attempt
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!currentAudioId) {
        setIsPlaying(true)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  const togglePlay = () => {
    setIsPlaying(!isPlaying)
  }

  const nextTrack = () => {
    let nextIndex
    do {
      nextIndex = Math.floor(Math.random() * TRACKS.length)
    } while (nextIndex === currentTrackIndex && TRACKS.length > 1)

    setCurrentTrackIndex(nextIndex)
    setIsPlaying(true)
  }

  const handleEnded = () => {
    nextTrack()
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 ml-4">
      <audio ref={audioRef} src={TRACKS[currentTrackIndex]} onEnded={handleEnded} />

      <button
        onClick={togglePlay}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label={isPlaying ? '음악 일시정지' : '음악 재생'}
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} />}
      </button>

      <button
        onClick={nextTrack}
        className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        aria-label="다음 트랙 (랜덤)"
      >
        <SkipForward size={14} />
      </button>

      <div className="flex items-center gap-1">
        <button
          onClick={toggleMute}
          className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          aria-label={isMuted ? '음소거 해제' : '음소거'}
        >
          {isMuted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={isMuted ? 0 : volume}
          onChange={(e) => {
            setVolume(Number.parseFloat(e.target.value))
            setIsMuted(false)
          }}
          className="w-16 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-primary-600"
          aria-label="볼륨"
        />
      </div>

      <div className="text-[10px] text-zinc-500 max-w-[60px] sm:max-w-[100px] truncate select-none">
        {decodeURIComponent(TRACKS[currentTrackIndex].split('music%2F')[1]?.split('?')[0] ?? '').replace('.wav', '')}
      </div>
    </div>
  )
}
