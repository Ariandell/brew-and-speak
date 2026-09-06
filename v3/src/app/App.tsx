import { Component, lazy, Suspense, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { AppStateProvider, useAppState } from './AppState';
import type { AppRoute } from './routes';
import { SceneProvider, useScene } from '../ui/SceneProvider';
import { Welcome } from '../screens/welcome/Welcome';
import { HomeContainer } from '../screens/student/HomeContainer';
import { CourseSelect } from '../screens/student/CourseSelect';
import { Course } from '../screens/student/Course';
import { Lesson } from '../screens/student/Lesson';
import { LessonResults } from '../screens/student/LessonResults';
import { Homework } from '../screens/student/Homework';
import { Dictionary, Flashcards } from '../screens/student/Words';
import { StudentChat } from '../screens/student/Chat';
import { Profile } from '../screens/student/Profile';
import { Schedule } from '../screens/student/Schedule';
import { TeacherDashboard } from '../screens/teacher/Dashboard';
import { LessonEditor, TeacherCourses, TeacherLessons } from '../screens/teacher/Courses';
import { HomeworkReview, TeacherHomework } from '../screens/teacher/Homework';
import { TeacherStudent, TeacherStudents } from '../screens/teacher/Students';
import { Broadcasts, TeacherChat } from '../screens/teacher/Communication';
import { TeacherStatistics } from '../screens/teacher/Statistics';
import { Button, Card, PageHeader, ProductPage } from '../ui/ProductUI';
import { Workshop } from '../workshop/Workshop';
import { THEMES, applyTheme } from './themes';
import { ProductionAppStateProvider } from './ProductionAppState';

const LazyWorkshop = lazy(async () => ({ default: Workshop }));
const LazyEmotionLab = import.meta.env.DEV
    ? lazy(async () => ({ default: (await import('../lab/emotion/EmotionLab')).EmotionLab }))
    : null;

class ProductErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
    state = { error: null as Error | null };
    static getDerivedStateFromError(error: Error) { return { error }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('[product-ui]', error, info); }
    render() {
        if (!this.state.error) return this.props.children;
        return <ProductPage><PageHeader eyebrow="Помилка" title="Екран не завантажився." description="Дані не втрачено. Спробуй відкрити екран ще раз." /><Button className="mt-6 w-full" onClick={() => { this.setState({ error: null }); window.location.hash = '#/home'; }}>Повернутися на головну</Button></ProductPage>;
    }
}

const isTeacherRoute = (route: AppRoute) => route.name.startsWith('teacher');

const RouteSceneDirector = ({ route }: { route: AppRoute }) => {
    const scene = useScene();
    useEffect(() => {
        if (!scene) return;
        // Keep the approved reference on entry/home; other poses share its shader.
        if (route.name === 'welcome' || route.name === 'home') scene.setCharacter('reference');
        if (route.name === 'welcome') scene.setPose({ x: 0.13, y: 0.14, scale: 1.02, roll: 0 });
        else if (route.name === 'home') scene.setPose({ x: 0.28, y: 0.5, scale: 0.72, roll: 0, lookYaw: -0.08, lookPitch: 0.02 });
        else scene.setPose({ scale: 0 });
    }, [route, scene]);
    return null;
};

const BlockedScreen = () => (
    <ProductPage><PageHeader eyebrow="Доступ призупинено" title="Навчання поки закрите." description="Звернися до викладачки в Telegram, щоб уточнити статус доступу." /><Card className="mt-6 p-6 text-center"><div className="text-[48px]">☕</div><p className="mt-3 text-[13px] font-semibold leading-relaxed text-text-soft">Курс, домашні роботи й чат недоступні, доки блокування не буде зняте на сервері.</p></Card></ProductPage>
);

const NotFoundScreen = () => {
    const { navigate } = useAppState();
    return <ProductPage><PageHeader eyebrow="404" title="Такої сторінки немає." description="Маршрут міг застаріти або бути скопійований не повністю." /><Button className="mt-6 w-full" onClick={() => navigate({ name: 'home' }, { replace: true })}>На головну</Button></ProductPage>;
};

const ProductRouter = () => {
    const { state, route, navigate } = useAppState();
    const role = state.currentUser.role;
    if (state.currentUser.isBlocked && role === 'student') return <BlockedScreen />;
    if (isTeacherRoute(route) && role !== 'teacher') return <ProductPage><PageHeader eyebrow="403" title="Недостатньо прав." description="Цей розділ доступний лише викладачці." /><Button className="mt-6 w-full" onClick={() => navigate({ name: 'home' }, { replace: true })}>До навчання</Button></ProductPage>;
    if (role === 'teacher' && !isTeacherRoute(route)) return <TeacherDashboard />;

    switch (route.name) {
        case 'welcome': return <Welcome onStart={() => navigate(state.currentUser.courseId ? { name: 'home' } : { name: 'course-select' })} />;
        case 'course-select': return <CourseSelect />;
        case 'home': return <HomeContainer />;
        case 'course': return <Course />;
        case 'lesson': return <Lesson lessonId={route.lessonId} />;
        case 'lesson-results': return <LessonResults lessonId={route.lessonId} />;
        case 'homework': return <Homework lessonId={route.lessonId} />;
        case 'dictionary': return <Dictionary />;
        case 'cards': return <Flashcards />;
        case 'chat': return <StudentChat />;
        case 'profile': return <Profile />;
        case 'schedule': return <Schedule />;
        case 'teacher': return <TeacherDashboard />;
        case 'teacher-courses': return <TeacherCourses />;
        case 'teacher-lessons': return <TeacherLessons courseId={route.courseId} />;
        case 'teacher-editor': return <LessonEditor lessonId={route.lessonId} />;
        case 'teacher-homework': return <TeacherHomework />;
        case 'teacher-homework-review': return <HomeworkReview submissionId={route.submissionId} />;
        case 'teacher-students': return <TeacherStudents />;
        case 'teacher-student': return <TeacherStudent studentId={route.studentId} />;
        case 'teacher-chat': return <TeacherChat />;
        case 'teacher-broadcasts': return <Broadcasts />;
        case 'teacher-statistics': return <TeacherStatistics />;
        case 'teacher-preview': return <Lesson lessonId={route.lessonId} preview />;
        default: return <NotFoundScreen />;
    }
};

const ProductApp = () => {
    const { route } = useAppState();
    return (
        <div className="flex h-[100dvh] flex-col bg-[#101014]">
            <SceneProvider look={{ palette: THEMES[0].shader, cup: THEMES[0].cup }}>
                <RouteSceneDirector route={route} />
                <ProductErrorBoundary><ProductRouter /></ProductErrorBoundary>
            </SceneProvider>
        </div>
    );
};

export const App = () => {
    const search = new URLSearchParams(window.location.search);
    const workshop = import.meta.env.DEV && search.has('workshop');
    const emotionLab = import.meta.env.DEV && search.get('lab') === 'emotion';
    useEffect(() => applyTheme(THEMES[0]), []);

    if (emotionLab && LazyEmotionLab) return <Suspense fallback={<div className="min-h-[100dvh] bg-[#101217]" />}><LazyEmotionLab /></Suspense>;
    if (workshop) return <Suspense fallback={<div className="min-h-[100dvh] bg-base" />}><LazyWorkshop /></Suspense>;
    if (import.meta.env.DEV && search.has('demo')) return <AppStateProvider><ProductApp /></AppStateProvider>;
    return <ProductionAppStateProvider><ProductApp /></ProductionAppStateProvider>;
};
