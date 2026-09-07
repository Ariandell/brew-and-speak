export type StudentTab = 'home' | 'course' | 'dictionary' | 'chat' | 'profile';
export type TeacherTab = 'teacher' | 'teacher-courses' | 'teacher-homework' | 'teacher-students' | 'teacher-chat';

export type AppRoute =
    | { name: 'not-found' }
    | { name: 'welcome' }
    | { name: 'course-select' }
    | { name: StudentTab }
    | { name: 'lesson'; lessonId: number }
    | { name: 'lesson-results'; lessonId: number }
    | { name: 'homework'; lessonId: number }
    | { name: 'cards' }
    | { name: 'schedule' }
    | { name: Exclude<TeacherTab, 'teacher-chat'> }
    | { name: 'teacher-chat'; studentId?: number }
    | { name: 'teacher-lessons'; courseId: number }
    | { name: 'teacher-editor'; lessonId: number }
    | { name: 'teacher-homework-review'; submissionId: string }
    | { name: 'teacher-student'; studentId: number }
    | { name: 'teacher-broadcasts' }
    | { name: 'teacher-statistics' }
    | { name: 'teacher-preview'; lessonId: number };

export const routePath = (route: AppRoute): string => {
    switch (route.name) {
        case 'not-found': return '/not-found';
        case 'lesson': return `/lesson/${route.lessonId}`;
        case 'lesson-results': return `/lesson/${route.lessonId}/results`;
        case 'homework': return `/lesson/${route.lessonId}/homework`;
        case 'teacher-lessons': return `/teacher/courses/${route.courseId}`;
        case 'teacher-editor': return `/teacher/lessons/${route.lessonId}`;
        case 'teacher-homework-review': return `/teacher/homework/${encodeURIComponent(route.submissionId)}`;
        case 'teacher-chat': return route.studentId ? `/teacher/chat/${route.studentId}` : '/teacher/chat';
        case 'teacher-student': return `/teacher/students/${route.studentId}`;
        case 'teacher-preview': return `/teacher/lessons/${route.lessonId}/preview`;
        case 'teacher-broadcasts': return '/teacher/broadcasts';
        case 'teacher-statistics': return '/teacher/statistics';
        case 'teacher-courses': return '/teacher/courses';
        case 'teacher-homework': return '/teacher/homework';
        case 'teacher-students': return '/teacher/students';
        case 'course-select': return '/courses/select';
        case 'dictionary': return '/words';
        default: return `/${route.name}`;
    }
};

export const routeFromPath = (path: string): AppRoute | null => {
    const clean = path.replace(/^#/, '').replace(/\/+$/, '') || '/';
    const lessonResults = clean.match(/^\/lesson\/(\d+)\/results$/);
    if (lessonResults) return { name: 'lesson-results', lessonId: Number(lessonResults[1]) };
    const homework = clean.match(/^\/lesson\/(\d+)\/homework$/);
    if (homework) return { name: 'homework', lessonId: Number(homework[1]) };
    const lesson = clean.match(/^\/lesson\/(\d+)$/);
    if (lesson) return { name: 'lesson', lessonId: Number(lesson[1]) };
    const teacherLessons = clean.match(/^\/teacher\/courses\/(\d+)$/);
    if (teacherLessons) return { name: 'teacher-lessons', courseId: Number(teacherLessons[1]) };
    const teacherEditor = clean.match(/^\/teacher\/lessons\/(\d+)$/);
    if (teacherEditor) return { name: 'teacher-editor', lessonId: Number(teacherEditor[1]) };
    const teacherPreview = clean.match(/^\/teacher\/lessons\/(\d+)\/preview$/);
    if (teacherPreview) return { name: 'teacher-preview', lessonId: Number(teacherPreview[1]) };
    const homeworkReview = clean.match(/^\/teacher\/homework\/(.+)$/);
    if (homeworkReview) {
        try { return { name: 'teacher-homework-review', submissionId: decodeURIComponent(homeworkReview[1]) }; }
        catch { return null; }
    }
    const teacherStudent = clean.match(/^\/teacher\/students\/(\d+)$/);
    if (teacherStudent) return { name: 'teacher-student', studentId: Number(teacherStudent[1]) };
    const teacherChat = clean.match(/^\/teacher\/chat\/(\d+)$/);
    if (teacherChat) return { name: 'teacher-chat', studentId: Number(teacherChat[1]) };

    const exact: Record<string, AppRoute> = {
        '/': { name: 'welcome' },
        '/welcome': { name: 'welcome' },
        '/courses/select': { name: 'course-select' },
        '/home': { name: 'home' },
        '/course': { name: 'course' },
        '/cards': { name: 'cards' },
        '/words': { name: 'dictionary' },
        '/chat': { name: 'chat' },
        '/profile': { name: 'profile' },
        '/schedule': { name: 'schedule' },
        '/teacher': { name: 'teacher' },
        '/teacher/courses': { name: 'teacher-courses' },
        '/teacher/homework': { name: 'teacher-homework' },
        '/teacher/students': { name: 'teacher-students' },
        '/teacher/chat': { name: 'teacher-chat' },
        '/teacher-courses': { name: 'teacher-courses' },
        '/teacher-homework': { name: 'teacher-homework' },
        '/teacher-students': { name: 'teacher-students' },
        '/teacher-chat': { name: 'teacher-chat' },
        '/teacher/broadcasts': { name: 'teacher-broadcasts' },
        '/teacher/statistics': { name: 'teacher-statistics' },
    };
    return exact[clean] ?? null;
};

export const studentTabForRoute = (route: AppRoute): StudentTab => {
    if (route.name === 'course' || route.name === 'lesson' || route.name === 'lesson-results' || route.name === 'homework') return 'course';
    if (route.name === 'cards' || route.name === 'dictionary') return 'dictionary';
    if (route.name === 'chat') return 'chat';
    if (route.name === 'profile') return 'profile';
    return 'home';
};

export const teacherTabForRoute = (route: AppRoute): TeacherTab => {
    if (route.name === 'teacher-courses' || route.name === 'teacher-lessons' || route.name === 'teacher-editor' || route.name === 'teacher-preview') return 'teacher-courses';
    if (route.name === 'teacher-homework' || route.name === 'teacher-homework-review') return 'teacher-homework';
    if (route.name === 'teacher-students' || route.name === 'teacher-student') return 'teacher-students';
    if (route.name === 'teacher-chat') return 'teacher-chat';
    return 'teacher';
};
