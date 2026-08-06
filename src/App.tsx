import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Pages
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import Settings from './pages/Settings';
import Tasks from './pages/Tasks';
import Chat from './pages/Chat';
import LessonView from './pages/LessonView';
import HomeworkSubmit from './pages/HomeworkSubmit';
import CourseSelect from './pages/CourseSelect';
import Dictionary from './pages/Dictionary';
import Flashcards from './pages/Flashcards';
import AdminDashboard from './pages/admin/Dashboard';
import LessonEditor from './pages/admin/LessonEditor';
import PhotoMessageEditor from './pages/admin/PhotoMessageEditor';
import ChatAdmin from './pages/admin/ChatAdmin';
import CourseList from './pages/admin/CourseList';
import LessonList from './pages/admin/LessonList';
import Statistics from './pages/admin/Statistics';
import Students from './pages/admin/Students';
import { useTelegram } from './components/TelegramProvider';

// A blocked student gets one honest screen instead of a course that half-loads
// and then fails on every request.
const AccessRevoked: React.FC = () => (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔒</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>Доступ обмежено</h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, margin: 0, maxWidth: 320 }}>
            Ваш доступ до курсу тимчасово призупинено. Зверніться до викладачки, щоб його відновити.
        </p>
    </div>
);

function App() {
    const { blocked } = useTelegram();
    if (blocked) return <AccessRevoked />;

    return (
        <Routes>
            {/* Onboarding Flow */}
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Course selection */}
            <Route path="/courses" element={<CourseSelect />} />
            <Route path="/courses/change" element={<CourseSelect changingCourse={true} />} />

            {/* Core Student Flow */}
            <Route path="/" element={<Home />} />
            <Route path="/lesson/:id" element={<LessonView />} />
            <Route path="/homework/:lessonId" element={<HomeworkSubmit />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/dictionary" element={<Dictionary />} />
            <Route path="/flashcards" element={<Flashcards />} />
            <Route path="/profile" element={<Settings />} />

            {/* Admin Flow */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/courses" element={<CourseList />} />
            <Route path="/admin/courses/:courseId/lessons" element={<LessonList />} />
            <Route path="/admin/lesson/new" element={<LessonEditor />} />
            <Route path="/admin/lesson/:id" element={<LessonEditor />} />
            <Route path="/admin/photo-messages" element={<PhotoMessageEditor />} />
            <Route path="/admin/chat" element={<ChatAdmin />} />
            <Route path="/admin/homework" element={<Statistics />} />
            <Route path="/admin/students" element={<Students />} />
        </Routes>
    );
}

export default App;
