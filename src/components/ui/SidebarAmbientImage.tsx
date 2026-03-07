import { useWorldBuildingImage, useAmbientImage } from '@/hooks/useAmbientImage'

export function SidebarAmbientImage() {
  const { worldImage } = useWorldBuildingImage()
  const { ambientImage } = useAmbientImage()

  const image = worldImage || ambientImage
  if (!image) return null

  return (
    <div className="relative mx-3 mb-3 h-28 overflow-hidden rounded-xl" aria-hidden="true">
      <img
        src={image.imageUrl}
        alt=""
        className="h-full w-full object-cover opacity-40 dark:opacity-25"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-zinc-900/80 to-transparent" />
      {image.type === 'world-building' && image.tags && image.tags.length > 0 && (
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 truncate">
            나의 지식의 숲
          </p>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {image.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-block px-1.5 py-0.5 text-[9px] rounded-full bg-white/60 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
