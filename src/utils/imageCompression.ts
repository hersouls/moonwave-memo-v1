// ─── Types ────────────────────────────────────────
export interface CompressedImage {
  dataUrl: string
  width: number
  height: number
  originalSize: number
}

// ─── Compression ─────────────────────────────────
export async function compressImage(
  file: File,
  maxDimension: number = 1024,
  quality: number = 0.75
): Promise<CompressedImage> {
  const originalSize = file.size

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      let { width, height } = img

      // Scale down if exceeds max dimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round(height * (maxDimension / width))
          width = maxDimension
        } else {
          width = Math.round(width * (maxDimension / height))
          height = maxDimension
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('이미지 처리 중 오류가 발생했습니다'))
        return
      }

      ctx.drawImage(img, 0, 0, width, height)

      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve({ dataUrl, width, height, originalSize })
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('이미지를 로드할 수 없습니다. 다른 형식의 이미지를 사용해주세요.'))
    }

    img.src = objectUrl
  })
}
