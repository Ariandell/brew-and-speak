import { useMemo } from 'react';
import { useAppState } from '../../app/AppState';
import { Card, PageHeader, ProductPage, StatusPill } from '../../ui/ProductUI';

export const TeacherStatistics = () => {
    const { state, back } = useAppState();
    const graded = state.homework.filter(item => item.status === 'graded' && item.grade !== null);
    const averageHomework = graded.length ? graded.reduce((sum, item) => sum + (item.grade ?? 0), 0) / graded.length : null;
    const courseRows = useMemo(() => state.courses.map(course => {
        const students = state.students.filter(student => student.courseId === course.id);
        const lessonCount = state.lessons.filter(lesson => lesson.courseId === course.id).length;
        const completed = students.reduce((sum, student) => sum + student.completedLessons, 0);
        return { course, students: students.length, lessonCount, completed };
    }), [state.courses, state.lessons, state.students]);
    return (
        <ProductPage>
            <PageHeader eyebrow="Аналітика" title="Статистика." description="Ключові числа без змішування з даними окремих учнів." onBack={() => back({ name: 'teacher' })} />
            <div className="mt-5 grid grid-cols-2 gap-3">
                {[['Учнів', state.students.length], ['Заблоковано', state.students.filter(item => item.isBlocked).length], ['Чекає ДЗ', state.homework.filter(item => item.status === 'pending').length], ['Середня ДЗ', averageHomework === null ? '—' : averageHomework.toFixed(1)]].map(([label, value]) => <Card key={label} className="p-4"><strong className="block text-[29px] font-black text-accent">{value}</strong><span className="text-[9px] font-bold uppercase tracking-[0.08em] text-text-faint">{label}</span></Card>)}
            </div>
            <h2 className="mt-7 text-[19px] font-black">Курси</h2>
            <div className="mt-3 space-y-3">{courseRows.map(row => <Card key={row.course.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-[16px] font-black">{row.course.title}</h3><p className="mt-1 text-[11px] font-semibold text-text-soft">{row.students} учнів · {row.lessonCount} уроків</p></div><StatusPill>{row.course.level}</StatusPill></div><div className="mt-4 flex justify-between border-t border-line pt-3 text-[11px] font-bold text-text-soft"><span>Сумарно завершено</span><strong className="text-text">{row.completed}</strong></div></Card>)}</div>
        </ProductPage>
    );
};
