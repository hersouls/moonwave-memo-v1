import { useState, useEffect } from 'react'
import { Dialog, DialogHeader, DialogBody, DialogFooter } from '@/components/ui/Dialog'
import { PRESET_SMART_FOLDERS, type SmartFolder } from '@/lib/smartFolderEngine'
import { IcLineCheck, IcMwCheckSquare, IcMwSparkles, IcMwStar } from '@/mw/icons'

const ICON_MAP: Record<string, React.ReactNode> = {
  Star: <IcMwStar size={20} className="text-amber-500" />,
  CheckSquare: <IcMwCheckSquare size={20} className="text-emerald-500" />,
  Sparkles: <IcMwSparkles size={20} className="text-violet-500" />,
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
              <button type="button" aria-pressed={isSelected}
                key={folder.id}
                onClick={() => handleToggle(folder.id)}
                className="mw-sheet__item w-full"
              >
                <div className="shrink-0">
                  {ICON_MAP[folder.icon] || <IcMwSparkles size={20} className="text-zinc-400" />}
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
                  <IcLineCheck size={20} className="text-primary-500 shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      </DialogBody>

      <DialogFooter>
        <button type="button"
          onClick={onClose}
          className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
        >
          <span>{'\uCDE8\uC18C'}</span>
        </button>
        <button type="button"
          onClick={handleSave}
          className="mw-button mw-button--primary mw-button--medium"
        >
          {'\uC800\uC7A5'}
        </button>
      </DialogFooter>
    </Dialog>
  )
}
