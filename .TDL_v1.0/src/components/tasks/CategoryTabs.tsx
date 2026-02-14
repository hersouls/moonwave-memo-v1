import { clsx } from 'clsx'
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from '@headlessui/react'
import { ChevronDown, Check } from 'lucide-react'
import type { Category } from '@/lib/types'
import { Fragment } from 'react'

interface CategoryTabsProps {
  categories: Category[]
  activeCategoryId: number | null
  onSelect: (id: number | null) => void
}

export function CategoryTabs({ categories, activeCategoryId, onSelect }: CategoryTabsProps) {
  const sortedCategories = categories
    .filter(c => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap(root => {
      const children = categories
        .filter(c => c.parentId === root.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      return [root, ...children]
    })

  const selectedCategory = activeCategoryId !== null
    ? categories.find(c => c.id === activeCategoryId)
    : null

  const displayLabel = selectedCategory
    ? `${selectedCategory.icon ? selectedCategory.icon + ' ' : ''}${selectedCategory.name}`
    : '모두'

  return (
    <Listbox value={activeCategoryId} onChange={onSelect}>
      <div className="relative">
        <ListboxButton
          className={clsx(
            'flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium',
            'transition-colors whitespace-nowrap',
            'bg-primary-500 text-white',
            'hover:bg-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'
          )}
        >
          <span className="truncate max-w-[160px]">{displayLabel}</span>
          <ChevronDown className="w-4 h-4 flex-shrink-0 ui-open:rotate-180 transition-transform duration-200" />
        </ListboxButton>

        <Transition
          as={Fragment}
          leave="transition ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <ListboxOptions
            className={clsx(
              'absolute left-0 mt-2 w-56 z-20',
              'max-h-60 overflow-auto',
              'rounded-xl bg-white dark:bg-zinc-900',
              'shadow-lg border border-zinc-200 dark:border-zinc-800',
              'py-1 focus:outline-none'
            )}
          >
            {/* "All" option */}
            <ListboxOption
              value={null}
              className={({ focus, selected }) => clsx(
                'relative cursor-pointer select-none py-2.5 pl-10 pr-4 text-sm',
                focus ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-zinc-700 dark:text-zinc-300',
                selected && 'font-semibold'
              )}
            >
              {({ selected }) => (
                <>
                  <span className="block truncate">모두</span>
                  {selected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-500">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </>
              )}
            </ListboxOption>

            {/* Divider */}
            <div className="mx-2 my-1 border-t border-zinc-100 dark:border-zinc-800" />

            {/* Category options */}
            {sortedCategories.map((category) => (
              <ListboxOption
                key={category.id}
                value={category.id ?? null}
                className={({ focus, selected }) => clsx(
                  'relative cursor-pointer select-none py-2.5 pr-4 text-sm',
                  category.parentId ? 'pl-14' : 'pl-10',
                  focus ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400' : 'text-zinc-700 dark:text-zinc-300',
                  selected && 'font-semibold'
                )}
              >
                {({ selected }) => (
                  <>
                    <span className="flex items-center gap-2 truncate">
                      {category.parentId && (
                        <span className="text-zinc-400 dark:text-zinc-600 text-xs">└</span>
                      )}
                      {category.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      {category.icon && <span>{category.icon}</span>}
                      {category.name}
                    </span>
                    {selected && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary-500">
                        <Check className="w-4 h-4" />
                      </span>
                    )}
                  </>
                )}
              </ListboxOption>
            ))}
          </ListboxOptions>
        </Transition>
      </div>
    </Listbox>
  )
}
