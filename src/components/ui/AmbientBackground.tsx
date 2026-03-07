import { useAmbientImage, useWorldBuildingImage } from '@/hooks/useAmbientImage'

export function AmbientBackground() {
  const { ambientImage } = useAmbientImage()
  const { worldImage } = useWorldBuildingImage()

  // Prefer world-building image over ambient
  const image = worldImage || ambientImage

  if (!image) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.06] dark:opacity-[0.04] transition-opacity duration-1000"
      aria-hidden="true"
    >
      <img
        src={image.imageUrl}
        alt=""
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {/* Fade edges so it blends into the app */}
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 via-transparent to-zinc-50 dark:from-zinc-900 dark:via-transparent dark:to-zinc-900" />
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-50 via-transparent to-zinc-50 dark:from-zinc-900 dark:via-transparent dark:to-zinc-900" />
    </div>
  )
}
