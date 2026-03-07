import { useState, useEffect } from 'react'
import { Star, CheckSquare, Sparkles, Check } from 'lucide-react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { PRESET_SMART_FOLDERS, type SmartFolder } from '@/lib/smartFolderEngine'

const ICON_MAP: Record<string, React.ReactNode> = {
  Star: <Star className="w-5 h-5 text-amber-500" />,
  CheckSquare: <CheckSquare className="w-5 h-5 text-emerald-500" />,
  Sparkles: <Sparkles className="w-5 h-5 text-violet-500" />,
}

const STORAGE_KEY = 'smart-folders-active'

function getActiveSmartFolders(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setActiveSmartFolders(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function useActiveSmartFolders() {
  const [activeIds, setActiveIds] = useState<string[]>(getActiveSmartFolders)

  const toggle = (id: string) => {
    setActiveIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
      setActiveSmartFolders(next)
      return next
    })
  }

  const activeFolders = PRESET_SMART_FOLDERS.filter((f) => activeIds.includes(f.id))

  return { activeIds, activeFolders, toggle }
}

interface SmartFolderCreateModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SmartFolderCreateModal({ isOpen, onClose }: SmartFolderCreateModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(getActiveSmartFolders()))
    }
  }, [isOpen])

  const handleToggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = () => {
    setActiveSmartFolders([...selectedIds])
    onClose()
  }

  const conditionLabel = (folder: SmartFolder): string => {
    return folder.conditions
      .map((c) => {
        switch (c.field) {
          case 'isStarred':
            return '\uC911\uC694 \uD45C\uC2DC\uB428'
          case 'createdAt':
            return `\uCD5C\uADFC ${String(c.value).replace('days', '\uC77C')} \uC774\uB0B4`
          case 'body':
            return `"${c.value}" \uD3EC\uD568`
          case 'tags':
            return `\uD0DC\uADF8: ${c.value}`
          default:
            return ''
        }
      })
      .join(folder.matchAll ? ' & ' : ' | ')
  }

  return (
    <Dialog open={isOpen} onClose={onClose} size="md">
      <DialogHeader
        title={'\uC2A4\uB9C8\uD2B8 \uD3F4\uB354 \uCD94\uAC00'}
        description={'\uC870\uAC74\uC5D0 \uB9DE\uB294 \uBA54\uBAA8\uB97C \uC790\uB3D9\uC73C\uB85C \uBAA8\uC544\uBCF4\uB294 \uC2A4\uB9C8\uD2B8 \uD3F4\uB354\uB97C \uC120\uD0DD\uD558\uC138\uC694.'}
        onClose={onClose}
      />

      <DialogBody>
        <div className="space-y-3">
          {PRESET_SMART_FOLDERS.map((folder) => {
            const isSelected = selectedIds.has(folder.id)
            return (
              <button
                key={folder.id}
                onClick={() => handleToggle(folder.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                  isSelected
                    ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                <div className="shrink-0">
                  {ICON_MAP[folder.icon] || <Sparkles className="w-5 h-5 text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {folder.name}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {conditionLabel(folder)}
                  </p>
                </div>
                {isSelected && (
                  <Check className="w-5 h-5 text-primary-500 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </DialogBody>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
        >
          {'\uCDE8\uC18C'}
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors"
        >
          {'\uC800\uC7A5'}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
