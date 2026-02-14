import { useState, useEffect } from 'react'
import { Dialog, DialogBody } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ChevronRight, Check, ListChecks, BarChart2, Shield } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useTaskStore } from '@/stores/taskStore'

interface WizardStep {
    title: string
    description: string
    icon: React.ElementType
    image?: string
}

const steps: WizardStep[] = [
    {
        title: 'To-Do List에 오신 것을 환영합니다',
        description: '단순하지만 강력한 작업 관리 도구로 하루를 체계적으로 정리하세요.',
        icon: ListChecks,
    },
    {
        title: '카테고리로 정리하세요',
        description: '업무, 개인, 쇼핑 등 다양한 카테고리로 작업을 분류하고 관리할 수 있습니다.',
        icon: ListChecks,
    },
    {
        title: '진행 상황을 추적하세요',
        description: '상세한 통계와 차트로 생산성 흐름을 한눈에 파악하세요.',
        icon: BarChart2,
    },
    {
        title: '데이터는 안전합니다',
        description: '모든 데이터는 기기에 안전하게 저장되며, 원할 때 언제든 백업할 수 있습니다.',
        icon: Shield,
    },
]

export function WelcomeWizard() {
    const [isOpen, setIsOpen] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const hasCompletedOnboarding = useSettingsStore((state) => state.settings.hasCompletedOnboarding)
    const setHasCompletedOnboarding = useSettingsStore((state) => state.setHasCompletedOnboarding)
    const seedTutorialTasks = useTaskStore((state) => state.seedTutorialTasks)

    useEffect(() => {
        if (!hasCompletedOnboarding) {
            setIsOpen(true)
        }
    }, [hasCompletedOnboarding])

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep((prev) => prev + 1)
        } else {
            handleComplete()
        }
    }

    const handleComplete = () => {
        setIsOpen(false)
        setHasCompletedOnboarding(true)
        // Run seeding in background to prevent UI blocking
        seedTutorialTasks().catch(console.error)
    }

    const CurrentIcon = steps[currentStep].icon

    if (!isOpen) return null

    return (
        <Dialog open={isOpen} onClose={() => { }} size="sm">
            <DialogBody className="p-0">
                <div className="flex flex-col min-h-[450px]">
                    {/* Image/Icon Area */}
                    <div className="flex-1 bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center p-8">
                        <div className="w-32 h-32 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-lg mb-4 animate-bounce-slow">
                            <CurrentIcon className="w-16 h-16 text-primary-500" />
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="p-6 bg-white dark:bg-zinc-900 text-center">
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                            {steps[currentStep].title}
                        </h2>
                        <p className="text-zinc-500 dark:text-zinc-400 mb-8 min-h-[48px]">
                            {steps[currentStep].description}
                        </p>

                        {/* Progress Dots */}
                        <div className="flex justify-center gap-2 mb-6">
                            {steps.map((_, index) => (
                                <div
                                    key={index}
                                    className={`w-2 h-2 rounded-full transition-all duration-300 ${index === currentStep
                                        ? 'bg-primary-500 w-6'
                                        : 'bg-zinc-200 dark:bg-zinc-700'
                                        }`}
                                />
                            ))}
                        </div>

                        <Button
                            variant="primary"
                            size="lg"
                            className="w-full"
                            onClick={handleNext}
                        >
                            {currentStep === steps.length - 1 ? (
                                <>
                                    시작하기 <Check className="w-5 h-5 ml-2" />
                                </>
                            ) : (
                                <>
                                    다음 <ChevronRight className="w-5 h-5 ml-2" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogBody>
        </Dialog>
    )
}
