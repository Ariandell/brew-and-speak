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

function App() {
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
        </Routes>
    );
}

export default App;
