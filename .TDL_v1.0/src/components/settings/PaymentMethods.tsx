import { useState } from 'react'
import { Plus, CreditCard as CardIcon, Trash2, Edit2 } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import type { CreditCard } from '@/lib/types'
import { Button } from '@/components/ui/Button'

export function PaymentMethods() {
    const paymentMethods = useSettingsStore((state) => state.settings.paymentMethods || [])
    const addCard = useSettingsStore((state) => state.addCard)
    const updateCard = useSettingsStore((state) => state.updateCard)
    const deleteCard = useSettingsStore((state) => state.deleteCard)

    const [isEditing, setIsEditing] = useState<string | null>(null) // 'new' or cardId
    const [editForm, setEditForm] = useState<Partial<CreditCard>>({})

    const handleAddNew = () => {
        setIsEditing('new')
        setEditForm({
            cardType: 'visa',
            cardholderName: '',
            cardNumber: '',
            expiryDate: '',
            cvc: '',
        })
    }

    const handleEdit = (card: CreditCard) => {
        setIsEditing(card.id)
        setEditForm(card)
    }

    const handleCancel = () => {
        setIsEditing(null)
        setEditForm({})
    }

    const handleSave = () => {
        if (!editForm.cardNumber || !editForm.expiryDate || !editForm.cvc || !editForm.cardholderName) {
            alert('모든 필드를 입력해주세요.')
            return
        }

        // Basic validation
        if (editForm.expiryDate.length !== 5 || !editForm.expiryDate.includes('/')) {
            alert('유효기간 형식이 올바르지 않습니다 (MM/YY)')
            return
        }

        if (isEditing === 'new') {
            const newCard: CreditCard = {
                id: crypto.randomUUID(),
                cardholderName: editForm.cardholderName,
                cardNumber: editForm.cardNumber,
                expiryDate: editForm.expiryDate,
                cvc: editForm.cvc,
                cardType: (editForm.cardType as any) || 'other',
            }
            addCard(newCard)
        } else {
            updateCard(editForm as CreditCard)
        }

        setIsEditing(null)
        setEditForm({})
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    결제 수단 관리
                </label>
                {isEditing !== 'new' && (
                    <Button size="sm" variant="secondary" onClick={handleAddNew}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        카드 추가
                    </Button>
                )}
            </div>

            <div className="space-y-3">
                {/* List of Cards */}
                {paymentMethods.map((card) => {
                    const isCurrentEditing = isEditing === card.id

                    if (isCurrentEditing) {
                        return (
                            <div key={card.id} className="p-3 rounded-lg border border-primary-500 bg-white dark:bg-zinc-900">
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1">카드 번호</label>
                                        <input
                                            type="text"
                                            value={editForm.cardNumber}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                                            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <label className="block text-xs text-zinc-500 mb-1">만료일 (MM/YY)</label>
                                            <input
                                                type="text"
                                                placeholder="MM/YY"
                                                maxLength={5}
                                                value={editForm.expiryDate}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <label className="block text-xs text-zinc-500 mb-1">CVC</label>
                                            <input
                                                type="password"
                                                maxLength={3}
                                                value={editForm.cvc}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, cvc: e.target.value }))}
                                                className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-zinc-500 mb-1">카드 명의자</label>
                                        <input
                                            type="text"
                                            value={editForm.cardholderName}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, cardholderName: e.target.value }))}
                                            className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2 mt-2">
                                        <Button size="sm" variant="ghost" onClick={handleCancel}>취소</Button>
                                        <Button size="sm" variant="primary" onClick={handleSave}>저장</Button>
                                    </div>
                                </div>
                            </div>
                        )
                    }

                    return (
                        <div
                            key={card.id}
                            className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-6 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center justify-center">
                                    <CardIcon className="w-4 h-4 text-zinc-400" />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                        •••• •••• •••• {card.cardNumber.slice(-4)}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                        {card.cardholderName} | {card.expiryDate}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handleEdit(card)}
                                    className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm('이 카드를 삭제하시겠습니까?')) {
                                            deleteCard(card.id)
                                        }
                                    }}
                                    className="p-1.5 text-zinc-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )
                })}

                {/* New Card Form */}
                {isEditing === 'new' && (
                    <div className="p-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/10">
                        <h4 className="text-sm font-medium mb-3 text-primary-700 dark:text-primary-400">새 카드 추가</h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">카드 번호</label>
                                <input
                                    type="text"
                                    placeholder="0000 0000 0000 0000"
                                    maxLength={19}
                                    value={editForm.cardNumber}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                />
                            </div>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs text-zinc-500 mb-1">만료일</label>
                                    <input
                                        type="text"
                                        placeholder="MM/YY"
                                        maxLength={5}
                                        value={editForm.expiryDate}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, expiryDate: e.target.value }))}
                                        className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs text-zinc-500 mb-1">CVC</label>
                                    <input
                                        type="password"
                                        placeholder="123"
                                        maxLength={3}
                                        value={editForm.cvc}
                                        onChange={(e) => setEditForm(prev => ({ ...prev, cvc: e.target.value }))}
                                        className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-500 mb-1">카드 명의자</label>
                                <input
                                    type="text"
                                    placeholder="HONG GILDONG"
                                    value={editForm.cardholderName}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, cardholderName: e.target.value }))}
                                    className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-zinc-800 dark:border-zinc-700"
                                />
                            </div>
                            <div className="flex justify-end gap-2 mt-2">
                                <Button size="sm" variant="ghost" onClick={handleCancel}>취소</Button>
                                <Button size="sm" variant="primary" onClick={handleSave}>추가</Button>
                            </div>
                        </div>
                    </div>
                )}

                {paymentMethods.length === 0 && isEditing !== 'new' && (
                    <div className="text-center py-4 text-sm text-zinc-500">
                        등록된 카드가 없습니다.
                    </div>
                )}
            </div>
        </div>
    )
}
