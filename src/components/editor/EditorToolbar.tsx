import { Type, CheckSquare, Hash, Camera, PenTool, Mic } from 'lucide-react'

export function EditorToolbar() {
  return (
    <div className="sticky bottom-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 px-2 py-2 lg:hidden">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <ToolbarButton icon={<Type className="w-5 h-5" />} label="텍스트" disabled />
        <ToolbarButton icon={<CheckSquare className="w-5 h-5" />} label="체크" disabled />
        <ToolbarButton icon={<Hash className="w-5 h-5" />} label="태그" />
        <ToolbarButton icon={<Camera className="w-5 h-5" />} label="카메라" disabled />
        <ToolbarButton icon={<PenTool className="w-5 h-5" />} label="그리기" disabled />
        <ToolbarButton icon={<Mic className="w-5 h-5" />} label="음성" disabled />
      </div>
    </div>
  )
}

function ToolbarButton({
  icon,
  label,
  disabled = false,
}: {
  icon: React.ReactNode
  label: string
  disabled?: boolean
}) {
  return (
    <button
      className={`p-2.5 rounded-lg transition-colors ${
        disabled
          ? 'text-zinc-300 dark:text-zinc-600 cursor-not-allowed'
          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
      title={disabled ? `${label} (준비 중)` : label}
      disabled={disabled}
    >
      {icon}
    </button>
  )
}
