import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ProgressBar } from '../components/ui/ProgressBar';
import { useIsAdmin } from '../components/TelegramProvider';

const ONBOARDING_STEPS = 5;

type Option = { label: string; icon?: string; value: string };

const stepsData: { title: string; options: Option[] }[] = [
    {
        title: "Яка ваша головна мета вивчення англійської?",
        options: [
            { label: "Подорожі", icon: "✈️", value: "travel" },
            { label: "Навчання", icon: "🏫", value: "school" },
            { label: "Робота", icon: "💼", value: "work" },
            { label: "Сім'я / Друзі", icon: "👨‍👩‍👧‍👦", value: "family" },
            { label: "Саморозвиток", icon: "📈", value: "skill" },
            { label: "Інше", icon: "🧩", value: "others" }
        ]
    },
    {
        title: "Як ви оцінюєте свій рівень?",
        options: [
            { label: "Початковий (Небагато)", icon: "📚", value: "beginner" },
            { label: "Середній", icon: "📊", value: "intermediate" },
            { label: "Високий", icon: "🎓", value: "expert" }
        ]
    },
    {
        title: "Скільки вам років?",
        options: [
            { label: "До 18", value: "under_18" },
            { label: "18-24", value: "18_24" },
            { label: "25-34", value: "25_34" },
            { label: "35-44", value: "35_44" },
            { label: "45-54", value: "45_54" },
            { label: "55-64", value: "55_64" },
            { label: "65 або старше", value: "over_65" }
        ]
    },
    {
        title: "Звідки ви дізналися про нас?",
        options: [
            { label: "Друзі/Сім'я", value: "friends" },
            { label: "Play Store / App Store", value: "store" },
            { label: "Youtube", value: "youtube" },
            { label: "Instagram / TikTok", value: "social" },
            { label: "Реклама в інтернеті", value: "webad" }
        ]
    }
];

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const isAdmin = useIsAdmin();
    const [currentStep, setCurrentStep] = useState(1);
    const [answers, setAnswers] = useState<Record<number, string>>({});

    const handleSelect = (value: string) => {
        setAnswers(prev => ({ ...prev, [currentStep]: value }));
    };

    const handleNext = () => {
        if (currentStep < ONBOARDING_STEPS) {
            setCurrentStep(s => s + 1);
        } else {
            // Finish Onboarding
            navigate('/');
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(s => s - 1);
        }
    };

    // Render final overview step
    if (currentStep === ONBOARDING_STEPS) {
        return (
            <div className="page" style={{ padding: 0 }}>
                <header className="app-header with-back-btn">
                    <button className="btn-back-header" onClick={handleBack}>‹</button>
                    <div style={{ flex: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 600 }}>Завершено {currentStep}/{ONBOARDING_STEPS}</span>
                        <ProgressBar progress={currentStep / ONBOARDING_STEPS} />
                    </div>
                    <div style={{ width: 24 }} /> {/* Spacer */}
                </header>

                <div className="animate-fade-in" style={{ padding: '1.5rem', flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🏅</div>
                    <h2 className="heading-xl" style={{ textAlign: 'center' }}>Вітаємо!</h2>
                    <p className="text-body" style={{ textAlign: 'center', marginBottom: '2rem' }}>Ваш профіль налаштовано. Готові розпочати навчання?</p>
                    <Button variant="primary" size="large" onClick={handleNext}>Почати</Button>
                </div>
            </div>
        );
    }

    const stepData = stepsData[currentStep - 1];
    const selectedValue = answers[currentStep];

    return (
        <div className="page" style={{ padding: 0 }}>
            {/* Top Header & Progress */}
            <header className="app-header with-back-btn">
                <button className="btn-back-header" onClick={handleBack} style={{ display: currentStep === 1 ? 'none' : 'block' }}>‹</button>
                {currentStep === 1 && !isAdmin && <div style={{ width: 24 }} />}
                {currentStep === 1 && isAdmin && (
                    <button onClick={() => navigate('/admin')} style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: 'white', border: 'none', borderRadius: '10px', padding: '6px 12px', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}>
                        Admin
                    </button>
                )}
                <div style={{ flex: 1, padding: '0 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 600 }}>Completed {currentStep}/{ONBOARDING_STEPS}</span>
                    <ProgressBar progress={currentStep / ONBOARDING_STEPS} />
                </div>
                <div style={{ width: 24 }} />
            </header>

            {/* Main Content Area */}
            <div className="animate-slide-up" style={{ padding: '1.5rem', paddingBottom: '100px', flexGrow: 1, overflowY: 'auto' }}>
                <h2 className="heading-lg" style={{ textAlign: 'center', marginBottom: '2rem', marginTop: '1rem' }}>{stepData.title}</h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {stepData.options.map(opt => (
                        <Card
                            key={opt.value}
                            selectable
                            active={selectedValue === opt.value}
                            onClick={() => handleSelect(opt.value)}
                            style={{ fontWeight: 600, fontSize: '1.1rem' }}
                        >
                            {opt.icon && <span style={{ fontSize: '1.4rem' }}>{opt.icon}</span>}
                            <span>{opt.label}</span>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Bottom Sticky Action */}
            <div className="bottom-actions">
                <Button
                    variant="primary"
                    size="large"
                    disabled={!selectedValue}
                    onClick={handleNext}
                >
                    Next
                </Button>
            </div>
        </div>
    );
};

export default Onboarding;
