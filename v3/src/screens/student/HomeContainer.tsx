import { useEffect, useMemo, useState } from 'react';
import { useAppState } from '../../app/AppState';
import type { StudentTab } from '../../app/routes';
import { Home, type HomeViewModel } from '../home/Home';
import { isLessonOpen } from '../../app/domain';

export const HomeContainer = () => {
    const { state, navigate, markBroadcastViewed, downloadAsset } = useAppState();
    const [openedBroadcast, setOpenedBroadcast] = useState<(typeof state.broadcasts)[number] | null>(null);
    const [broadcastUrl, setBroadcastUrl] = useState<string | null>(null);
    const [broadcastError, setBroadcastError] = useState('');
    const course = state.courses.find(item => item.id === state.currentUser.courseId);
    const lessons = state.lessons.filter(item => item.courseId === course?.id).sort((a, b) => a.order - b.order);
    const accessibleLessonIds = useMemo(() => new Set(lessons.filter(item => item.status !== 'locked').map(item => item.id)), [lessons]);
    const current = lessons.find(item => item.status !== 'completed' && isLessonOpen(item)) ?? lessons.find(item => item.status === 'completed' && isLessonOpen(item)) ?? lessons.find(item => item.status === 'locked') ?? lessons[0];
    const submission = current ? state.homework.find(item => item.studentId === state.currentUser.id && item.lessonId === current.id) : undefined;
    const broadcast = state.broadcasts.find(item => Date.parse(item.scheduledAt) <= Date.now() && !item.viewedBy.includes(state.currentUser.id));
    const model = useMemo<HomeViewModel>(() => ({
        streakDays: state.currentUser.streakDays,
        courseTitle: course?.title ?? 'Курс не обрано',
        currentLesson: { index: current?.order ?? 0, total: lessons.length, title: current?.title ?? 'Обери свій курс', completedPercent: current?.status === 'completed' ? 100 : 0 },
        homework: submission?.status === 'graded' ? { status: 'graded', label: `${submission.grade}/10` } : submission?.status === 'pending' ? { status: 'reviewing', label: 'На перевірці' } : { status: 'to-submit', label: 'Треба здати' },
        cardsDue: state.cards.filter(card => accessibleLessonIds.has(card.lessonId) && card.due).length,
        broadcast: broadcast ? { caption: broadcast.caption, imageName: broadcast.imageName } : null,
    }), [accessibleLessonIds, broadcast, course?.title, current, lessons.length, state.cards, state.currentUser.streakDays, submission]);
    const nav = (tab: StudentTab) => navigate({ name: tab });
    useEffect(() => {
        if (!openedBroadcast?.assetId) return;
        let active = true; let objectUrl = '';
        setBroadcastError(''); setBroadcastUrl(null);
        void downloadAsset(openedBroadcast.assetId).then(blob => {
            if (!active) return; objectUrl = URL.createObjectURL(blob); setBroadcastUrl(objectUrl);
        }).catch(error => { if (active) setBroadcastError(error instanceof Error ? error.message : 'Фото недоступне.'); });
        return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [downloadAsset, openedBroadcast]);
    const openBroadcast = () => {
        if (!broadcast) return;
        setOpenedBroadcast(broadcast);
        void markBroadcastViewed(broadcast.id);
    };
    return <>
        <Home model={model} onOpenLesson={() => current ? navigate({ name: 'lesson', lessonId: current.id }) : navigate({ name: 'course-select' })} onOpenHomework={() => current && navigate({ name: 'homework', lessonId: current.id })} onOpenCards={() => navigate({ name: 'cards' })} onOpenSchedule={() => navigate({ name: 'schedule' })} onOpenBroadcast={openBroadcast} onNavigate={nav} />
        {openedBroadcast && <div role="dialog" aria-modal="true" aria-label="Повідомлення викладачки" className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1b33]/60 p-5 backdrop-blur-md">
            <div className="w-full max-w-[390px] overflow-hidden rounded-[26px] border border-white/70 bg-surface p-4 shadow-panel">
                <div className="flex items-center justify-between"><strong className="text-[15px] font-black">Повідомлення викладачки</strong><button type="button" onClick={() => setOpenedBroadcast(null)} aria-label="Закрити" className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-tint font-black text-accent">×</button></div>
                <div className="mt-3 flex min-h-48 items-center justify-center overflow-hidden rounded-[18px] bg-accent-tint/50">{broadcastUrl ? <img src={broadcastUrl} alt="Фото від викладачки" className="max-h-[58dvh] w-full object-contain" /> : broadcastError ? <p role="alert" className="p-5 text-center text-[12px] font-bold text-alert">{broadcastError}</p> : <p className="text-[12px] font-bold text-text-faint">Завантаження фото…</p>}</div>
                {openedBroadcast.caption && <p className="mt-4 text-[13px] font-semibold leading-relaxed text-text-soft">{openedBroadcast.caption}</p>}
            </div>
        </div>}
    </>;
};
