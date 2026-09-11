import { useEffect } from 'react';
import type { StudentTab } from '../../app/routes';
import { BottomNav } from '../../ui/BottomNav';
import { Icon } from '../../ui/Icon';
import { RegistrationMarks } from '../../ui/RegistrationMarks';
import { useScene } from '../../ui/SceneProvider';
import { useAmbientMascot } from '../../ui/useAmbientMascot';

export interface HomeViewModel {
    streakDays: number;
    courseTitle: string;
    currentLesson: {
        index: number;
        total: number;
        title: string;
        completedPercent: number;
    };
    homework: {
        status: 'to-submit' | 'reviewing' | 'graded';
        label: string;
    };
    homeworkFeedback: {
        grade: number;
        comment: string;
        lessonTitle: string;
    } | null;
    cardsDue: number;
    broadcast: { caption: string; imageName: string } | null;
}

interface Props {
    model: HomeViewModel;
    sceneActive?: boolean;
    onOpenLesson: () => void;
    onOpenHomework: () => void;
    onOpenHomeworkFeedback: () => void;
    onOpenCards: () => void;
    onOpenSchedule: () => void;
    onOpenBroadcast: () => void;
    onNavigate: (route: StudentTab) => void;
}

const WEEKDAYS = ['НД', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

const homeworkTone = {
    'to-submit': 'bg-warm/15 text-[#91520e]',
    reviewing: 'bg-accent-tint text-accent-deep',
    graded: 'bg-good/15 text-good',
} as const;

export const Home = ({
    model,
    sceneActive = true,
    onOpenLesson,
    onOpenHomework,
    onOpenHomeworkFeedback,
    onOpenCards,
    onOpenSchedule,
    onOpenBroadcast,
    onNavigate,
}: Props) => {
    const scene = useScene();
    const { show: showAmbientMood } = useAmbientMascot(sceneActive);

    useEffect(() => {
        if (!sceneActive) return;
        scene?.setPose({ x: 0.28, y: 0.5, scale: 0.72, lookYaw: -0.08, lookPitch: 0.02, roll: 0 });
    }, [scene, sceneActive]);

    const now = new Date();
    const date = `${WEEKDAYS[now.getDay()]} · ${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lesson = model.currentLesson;

    return (
        <div className="relative h-full overflow-hidden text-text">
            <RegistrationMarks />

            <div className="home-scroll relative z-10 h-full overflow-y-auto px-6 pb-28 pt-7">
                <header className="surface" style={{ animationDelay: '80ms' }}>
                    <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-text-faint">
                        <span>Твій маршрут</span>
                        <span>{date}</span>
                    </div>
                    <span className="mt-3 block h-px bg-text/15" />

                    <div className="mt-5 flex items-start justify-between gap-4">
                        <div>
                            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-accent-deep">
                                Сьогодні
                            </p>
                            <h1 className="mt-2 max-w-[230px] text-[55px] font-black leading-[0.82] tracking-[-0.055em]">
                                ТВІЙ
                                <br />
                                ДЕНЬ.
                            </h1>
                        </div>
                        <button type="button" onClick={onOpenSchedule} aria-label="Відкрити розклад" className="glass-panel mt-1 min-w-[76px] rounded-[14px] border border-white/60 bg-surface/75 px-3 py-2 text-right shadow-[0_1px_2px_rgba(15,27,51,0.04),0_8px_20px_rgba(15,27,51,0.06)] transition active:scale-[0.98]">
                            <span className="block text-[26px] font-black leading-none text-accent">{model.streakDays}</span>
                            <span className="mt-1 block font-mono text-[9px] font-bold uppercase tracking-[0.13em] text-text-soft">
                                днів серії
                            </span>
                            <span className="mt-2 flex items-center justify-end gap-1 text-[8px] font-black uppercase tracking-[0.08em] text-accent-deep"><Icon name="calendar" className="h-3 w-3" />Розклад</span>
                        </button>
                    </div>
                </header>

                <div className="flex h-[clamp(132px,18dvh,168px)] items-end pb-3">
                    {model.homeworkFeedback && (
                        <button
                            type="button"
                            onClick={onOpenHomeworkFeedback}
                            aria-label="Відкрити відгук до домашнього"
                            className="glass-panel surface flex w-full items-center gap-3 rounded-[18px] border border-white/75 bg-surface/95 p-3 text-left shadow-card transition active:scale-[0.99]"
                        >
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-good/15 text-[21px] font-black text-good">{model.homeworkFeedback.grade}</span>
                            <span className="min-w-0 flex-1">
                                <span className="block font-mono text-[8px] font-black uppercase tracking-[0.16em] text-good">Відгук до домашнього</span>
                                <strong className="mt-1 block truncate text-[12px] font-black">{model.homeworkFeedback.lessonTitle}</strong>
                                <span className="mt-0.5 block truncate text-[10px] font-semibold text-text-soft">{model.homeworkFeedback.comment || 'Без додаткового коментаря.'}</span>
                            </span>
                            <Icon name="arrow" className="h-5 w-5 shrink-0 text-text-faint" />
                        </button>
                    )}
                </div>

                <section
                    aria-labelledby="next-lesson-title"
                    className="glass-panel surface rounded-[22px] border border-white/70 bg-surface/95 p-4 shadow-[0_2px_4px_rgba(15,27,51,0.05),0_18px_44px_rgba(15,27,51,0.11)]"
                    style={{ animationDelay: '160ms' }}
                >
                    <div className="flex items-center justify-between gap-3">
                        <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-accent-deep">
                            Далі за курсом
                        </p>
                        <span className="rounded-pill bg-good/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-good">
                            Відкрито
                        </span>
                    </div>

                    <h2 id="next-lesson-title" className="mt-3 text-[24px] font-black leading-tight tracking-[-0.025em]">
                        {lesson.title}
                    </h2>
                    <p className="mt-1 text-[13px] font-semibold text-text-soft">
                        Урок {lesson.index} із {lesson.total} · {model.courseTitle}
                    </p>

                    <div className="mt-4 flex items-center gap-3">
                        <div
                            className="h-2 flex-1 overflow-hidden rounded-pill bg-accent-tint"
                            role="progressbar"
                            aria-label="Прогрес уроку"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={lesson.completedPercent}
                        >
                            <span
                                className="block h-full rounded-pill bg-accent"
                                style={{ width: `${Math.min(100, Math.max(0, lesson.completedPercent))}%` }}
                            />
                        </div>
                        <span className="font-mono text-[10px] font-bold text-text-faint">{lesson.completedPercent}%</span>
                    </div>

                    <button
                        type="button"
                        onPointerDown={() => showAmbientMood('surprised', 1_200)}
                        onClick={onOpenLesson}
                        className="mt-4 flex h-12 w-full items-center rounded-[13px] bg-accent pl-4 pr-3 text-left text-[15px] font-extrabold text-white shadow-[0_3px_7px_rgba(37,99,235,0.2),0_12px_26px_rgba(37,99,235,0.25)] transition duration-quick ease-out active:translate-y-0.5 active:scale-[0.99] active:shadow-[0_1px_2px_rgba(37,99,235,0.22),0_4px_9px_rgba(37,99,235,0.18)]"
                    >
                        Продовжити урок
                        <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/15">
                            <Icon name="arrow" className="h-5 w-5" />
                        </span>
                    </button>
                </section>

                <div className="mt-3 grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onOpenHomework}
                        className="glass-panel surface min-h-[118px] rounded-[20px] border border-white/70 bg-surface/90 p-4 text-left shadow-[0_1px_3px_rgba(15,27,51,0.04),0_10px_24px_rgba(15,27,51,0.08)] transition duration-quick ease-out active:translate-y-0.5 active:scale-[0.985]"
                        style={{ animationDelay: '240ms' }}
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-warm/15 text-[#a15d16]">
                            <Icon name="homework" className="h-5 w-5" />
                        </span>
                        <span className="mt-3 block text-[16px] font-extrabold">Домашнє</span>
                        <span className={`mt-1 inline-flex rounded-pill px-2 py-0.5 text-[10px] font-extrabold ${homeworkTone[model.homework.status]}`}>
                            {model.homework.label}
                        </span>
                    </button>

                    <button
                        type="button"
                        onClick={onOpenCards}
                        className="glass-panel surface min-h-[118px] rounded-[20px] border border-white/70 bg-surface/90 p-4 text-left shadow-[0_1px_3px_rgba(15,27,51,0.04),0_10px_24px_rgba(15,27,51,0.08)] transition duration-quick ease-out active:translate-y-0.5 active:scale-[0.985]"
                        style={{ animationDelay: '300ms' }}
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent-tint text-accent-deep">
                            <Icon name="cards" className="h-5 w-5" />
                        </span>
                        <span className="mt-3 block text-[16px] font-extrabold">Картки</span>
                        <span className="mt-1 block text-[11px] font-bold text-text-soft">
                            {model.cardsDue > 0 ? `${model.cardsDue} слів чекають` : 'На сьогодні готово'}
                        </span>
                    </button>
                </div>
                {model.broadcast && <button type="button" onClick={onOpenBroadcast} className="glass-panel surface mt-3 flex w-full items-center gap-3 rounded-[20px] border border-white/70 bg-surface/90 p-4 text-left shadow-card transition active:scale-[0.99]"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-warm/15 text-warm"><Icon name="broadcast" /></span><span className="min-w-0 flex-1"><strong className="block text-[13px] font-black">Повідомлення викладачки</strong><span className="mt-1 block truncate text-[11px] font-semibold text-text-soft">{model.broadcast.caption || model.broadcast.imageName}</span></span><Icon name="arrow" className="h-5 w-5 text-text-faint" /></button>}
            </div>

            <BottomNav active="home" onSelect={onNavigate} />
        </div>
    );
};
