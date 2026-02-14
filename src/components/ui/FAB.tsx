import { useNavigate } from 'react-router-dom'
import { Camera, Pencil } from 'lucide-react'

export function FAB() {
  const navigate = useNavigate()

  return (
    <div className="fab-button fixed bottom-24 right-4 z-40 flex flex-col items-center gap-3 md:bottom-8 md:right-8">
      {/* Camera button */}
      <button
        onClick={() => {
          // Camera capture — placeholder for future implementation
        }}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-gray-600 shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-gray-700 dark:text-gray-300"
        aria-label="카메라로 메모 추가"
      >
        <Camera className="h-5 w-5" />
      </button>

      {/* New memo button */}
      <button
        onClick={() => navigate('/memo/new')}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 dark:bg-gray-100 dark:text-gray-900"
        aria-label="새 메모 작성"
      >
        <Pencil className="h-6 w-6" />
      </button>
    </div>
  )
}
