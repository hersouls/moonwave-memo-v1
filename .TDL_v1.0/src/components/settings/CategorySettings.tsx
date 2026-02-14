import { useState, useMemo } from 'react'
import {
    Plus,
    Pencil,
    Trash2,
    ChevronRight,
    ChevronDown,
} from 'lucide-react'
import { useCategoryStore } from '@/stores/categoryStore'
import { useTaskStore } from '@/stores/taskStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { clsx } from 'clsx'
import type { Category } from '@/lib/types'

const COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981', '#06B6D4',
    '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#64748B'
]

interface CategoryItemProps {
    cat: Category
    depth?: number
    childrenMap: Map<number, Category[]>
    expandedParents: Set<number>
    editingId: number | null
    editName: string
    setEditName: (name: string) => void
    editColor: string
    setEditColor: (color: string) => void
    editParentId: number | null
    setEditParentId: (id: number | null) => void
    roots: Category[]
    onToggleExpand: (id: number) => void
    onStartEdit: (cat: Category) => void
    onStartAdd: (parentId: number | null) => void
    onDelete: (id: number) => void
    onSave: () => void
    onReset: () => void
}

function CategoryItem({
    cat,
    depth = 0,
    childrenMap,
    expandedParents,
    editingId,
    editName,
    setEditName,
    editColor,
    setEditColor,
    editParentId,
    setEditParentId,
    roots,
    onToggleExpand,
    onStartEdit,
    onStartAdd,
    onDelete,
    onSave,
    onReset
}: CategoryItemProps) {
    const children = childrenMap.get(cat.id!) || []
    const isExpanded = expandedParents.has(cat.id!)
    const isEditing = editingId === cat.id

    if (isEditing) {
        return (
            <div className={clsx(
                "p-3 rounded-lg border-2 border-primary-500 bg-white dark:bg-zinc-900 mb-2",
                depth > 0 && "ml-3 lg:ml-6"
            )}>
                <div className="space-y-3">
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="카테고리 이름"
                        className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100"
                        autoFocus
                    />

                    <div className="flex gap-2 flex-wrap">
                        {COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => setEditColor(color)}
                                className={clsx(
                                    "w-6 h-6 rounded-full transition-transform hover:scale-110",
                                    editColor === color && "ring-2 ring-offset-2 ring-primary-500"
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">상위 카테고리:</span>
                        <select
                            value={editParentId ?? ''}
                            onChange={(e) => setEditParentId(e.target.value ? Number(e.target.value) : null)}
                            className="text-sm px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 max-w-full min-w-0"
                        >
                            <option value="">(없음)</option>
                            {roots
                                .filter(r => r.id !== cat.id) // Can't start parent as self
                                .map(root => (
                                    <option key={root.id} value={root.id}>{root.name}</option>
                                ))}
                        </select>
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onReset}
                            className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 rounded"
                        >
                            취소
                        </button>
                        <button
                            onClick={onSave}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded"
                        >
                            저장
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className={clsx("mb-1", depth > 0 && "ml-3 lg:ml-6 relative")}>
            {/* Connection Line for children */}
            {depth > 0 && (
                <div className="absolute -left-2.5 lg:-left-4 top-1/2 w-2.5 lg:w-4 h-px bg-zinc-200 dark:bg-zinc-700" />
            )}
            {depth > 0 && (
                <div className="absolute -left-2.5 lg:-left-4 -top-2 bottom-1/2 w-px bg-zinc-200 dark:bg-zinc-700" />
            )}

            <div className="group flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {children.length > 0 ? (
                        <button
                            onClick={() => onToggleExpand(cat.id!)}
                            className="p-1 -ml-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                        >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                    ) : (
                        <div className="w-4 h-4 mr-1" />
                    )}

                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {cat.name}
                    </span>
                </div>

                <div className="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                    {depth === 0 && (
                        <button
                            onClick={() => onStartAdd(cat.id!)}
                            className="p-1.5 text-zinc-400 hover:text-primary-500 hover:bg-primary-50 rounded"
                            title="하위 카테고리 추가"
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={() => onStartEdit(cat)}
                        className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                        title="수정"
                    >
                        <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(cat.id!)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded"
                        title="삭제"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Children */}
            {isExpanded && children.length > 0 && (
                <div className="mt-1 relative">
                    {/* Vertical Line for children group */}
                    <div className="absolute left-[5px] lg:left-[11px] top-0 bottom-2 w-px bg-zinc-200 dark:bg-zinc-700" />

                    {children.map(child => (
                        <CategoryItem
                            key={child.id}
                            cat={child}
                            depth={depth + 1}
                            childrenMap={childrenMap}
                            expandedParents={expandedParents}
                            editingId={editingId}
                            editName={editName}
                            setEditName={setEditName}
                            editColor={editColor}
                            setEditColor={setEditColor}
                            editParentId={editParentId}
                            setEditParentId={setEditParentId}
                            roots={roots}
                            onToggleExpand={onToggleExpand}
                            onStartEdit={onStartEdit}
                            onStartAdd={onStartAdd}
                            onDelete={onDelete}
                            onSave={onSave}
                            onReset={onReset}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

export function CategorySettings() {
    const categories = useCategoryStore((s) => s.categories)
    const addCategory = useCategoryStore((s) => s.addCategory)
    const updateCategory = useCategoryStore((s) => s.updateCategory)
    const deleteCategory = useCategoryStore((s) => s.deleteCategory)
    const tasks = useTaskStore((s) => s.tasks)

    const [editingId, setEditingId] = useState<number | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [editName, setEditName] = useState('')
    const [editColor, setEditColor] = useState('#3B82F6')
    const [editParentId, setEditParentId] = useState<number | null>(null)
    const [expandedParents, setExpandedParents] = useState<Set<number>>(new Set())
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null)

    // Group categories by parent
    const { roots, childrenMap } = useMemo(() => {
        const roots: Category[] = []
        const childrenMap = new Map<number, Category[]>()

        // Sort by sortOrder then createdAt
        const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder)

        sorted.forEach(cat => {
            if (cat.parentId) {
                const list = childrenMap.get(cat.parentId) || []
                list.push(cat)
                childrenMap.set(cat.parentId, list)
            } else {
                roots.push(cat)
            }
        })

        return { roots, childrenMap }
    }, [categories])

    const handleStartEdit = (cat: Category) => {
        setEditingId(cat.id!)
        setEditName(cat.name)
        setEditColor(cat.color)
        setEditParentId(cat.parentId ?? null)
        setIsAdding(false)
    }

    const handleStartAdd = (parentId: number | null = null) => {
        setEditingId(null)
        setEditName('')
        setEditColor('#3B82F6')
        setEditParentId(parentId)
        setIsAdding(true)
        if (parentId) {
            setExpandedParents(prev => new Set(prev).add(parentId))
        }
    }

    const handleSave = async () => {
        if (!editName.trim()) return

        if (isAdding) {
            await addCategory(editName, editColor, editParentId)
        } else if (editingId) {
            // Prevent setting parent to itself or its own children (circular dependency check could be added)
            if (editingId === editParentId) {
                alert('자기 자신을 상위 카테고리로 설정할 수 없습니다.')
                return
            }
            await updateCategory(editingId, {
                name: editName,
                color: editColor,
                parentId: editParentId
            })
        }

        resetForm()
    }

    const handleDelete = (id: number) => {
        const cat = categories.find(c => c.id === id)
        if (cat) setDeleteTarget({ id, name: cat.name })
    }

    const confirmDelete = async () => {
        if (!deleteTarget) return
        await deleteCategory(deleteTarget.id)
        setDeleteTarget(null)
    }

    const resetForm = () => {
        setEditingId(null)
        setIsAdding(false)
        setEditName('')
        setEditColor('#3B82F6')
        setEditParentId(null)
    }

    const toggleExpand = (id: number) => {
        setExpandedParents(prev => {
            const newSet = new Set(prev)
            if (newSet.has(id)) {
                newSet.delete(id)
            } else {
                newSet.add(id)
            }
            return newSet
        })
    }

    return (
        <div className="space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    카테고리 관리
                </h3>
                {!isAdding && (
                    <button
                        onClick={() => handleStartAdd(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        새 카테고리
                    </button>
                )}
            </div>

            <div className="space-y-1">
                {roots.map(root => (
                    <CategoryItem
                        key={root.id}
                        cat={root}
                        depth={0}
                        childrenMap={childrenMap}
                        expandedParents={expandedParents}
                        editingId={editingId}
                        editName={editName}
                        setEditName={setEditName}
                        editColor={editColor}
                        setEditColor={setEditColor}
                        editParentId={editParentId}
                        setEditParentId={setEditParentId}
                        roots={roots}
                        onToggleExpand={toggleExpand}
                        onStartEdit={handleStartEdit}
                        onStartAdd={handleStartAdd}
                        onDelete={handleDelete}
                        onSave={handleSave}
                        onReset={resetForm}
                    />
                ))}
            </div>

            {isAdding && !editingId && (
                <div className="p-3 rounded-lg border-2 border-primary-500 bg-white dark:bg-zinc-900 mt-2">
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="새 카테고리 이름"
                            className="w-full px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100"
                            autoFocus
                        />

                        <div className="flex gap-2 flex-wrap">
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setEditColor(color)}
                                    className={clsx(
                                        "w-6 h-6 rounded-full transition-transform hover:scale-110",
                                        editColor === color && "ring-2 ring-offset-2 ring-primary-500"
                                    )}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500">상위 카테고리:</span>
                            <select
                                value={editParentId ?? ''}
                                onChange={(e) => setEditParentId(e.target.value ? Number(e.target.value) : null)}
                                className="text-sm px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 max-w-full min-w-0"
                            >
                                <option value="">(없음)</option>
                                {roots.map(root => (
                                    <option key={root.id} value={root.id}>{root.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={resetForm}
                                className="px-3 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 rounded"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded"
                            >
                                추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {categories.length === 0 && !isAdding && (
                <div className="text-center py-8 text-zinc-400 dark:text-zinc-500 text-sm">
                    등록된 카테고리가 없습니다.
                </div>
            )}

            {deleteTarget && (
                <ConfirmDialog
                    open={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onConfirm={confirmDelete}
                    title="카테고리 삭제"
                    description={`"${deleteTarget.name}" 카테고리를 삭제하시겠습니까?\n\n이 카테고리에 속한 작업 ${tasks.filter(t => t.categoryId === deleteTarget.id).length}개가 미분류로 변경됩니다.\n하위 카테고리는 최상위로 이동됩니다.`}
                    confirmText="삭제"
                    variant="danger"
                />
            )}
        </div>
    )
}
