import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { decodeMesh } from '../lib/meshData';

test('all prepared mascot poses decode within mobile limits and reject damaged files', () => {
    for (const pose of ['neutral', 'wave', 'present', 'celebrate', 'wait']) {
        const file = readFileSync(`public/models/poses/${pose}.msh`);
        const data = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
        const mesh = decodeMesh(data);
        assert.equal(mesh.indices.length / 3, 20000);
        assert.ok(file.length < 300000);
        assert.ok(mesh.arms.some(value => value > 0));
        assert.ok(mesh.calibration[0] < mesh.calibration[1] && mesh.calibration[1] < mesh.calibration[2]);
        assert.throws(() => decodeMesh(data.slice(0, -1)));
    }
    assert.throws(() => decodeMesh(new ArrayBuffer(2)));
});
import type { ProductCard, ProductLesson } from './productTypes';
import { isLessonOpen, reviewSrsCard, validateLessonDraft } from './domain';
import { routeFromPath, routePath, type AppRoute } from './routes';

test('teacher links survive reload and malformed links do not crash routing', () => {
    const routes: AppRoute[] = [
        { name: 'teacher-courses' }, { name: 'teacher-homework' },
        { name: 'teacher-students' }, { name: 'teacher-chat' }, { name: 'teacher-chat', studentId: 42 },
        { name: 'teacher-homework-review', submissionId: 'student/42%work' },
    ];
    for (const route of routes) assert.deepEqual(routeFromPath(routePath(route)), route);
    assert.equal(routeFromPath('/teacher/homework/%ZZ'), null);
    assert.deepEqual(routeFromPath('/teacher-homework'), { name: 'teacher-homework' });
});

const lesson = (overrides: Partial<ProductLesson>): ProductLesson => ({
    id: 1, courseId: 1, order: 1, title: 'Lesson', subtitle: '', durationMinutes: 10,
    status: 'locked', unlocksAt: null, completedAt: null, score: null, revision: 1, blocks: [], ...overrides,
});
const card = (overrides: Partial<ProductCard> = {}): ProductCard => ({
    id: 1, lessonId: 1, front: 'coffee', back: 'кава', example: '', state: 'new', due: true,
    timesShown: 0, timesCorrect: 0, timesWrong: 0, easeFactor: 2.5, intervalDays: 0, nextReviewAt: null, ...overrides,
});

test('drip and retake use the server-style 24 hour boundary', () => {
    const now = Date.UTC(2026, 7, 30, 12);
    assert.equal(isLessonOpen(lesson({ unlocksAt: new Date(now - 1).toISOString() }), now), true);
    assert.equal(isLessonOpen(lesson({ unlocksAt: new Date(now + 1).toISOString() }), now), false);
    assert.equal(isLessonOpen(lesson({ status: 'completed', completedAt: new Date(now - 86400000).toISOString() }), now), true);
    assert.equal(isLessonOpen(lesson({ status: 'completed', completedAt: new Date(now - 86399999).toISOString() }), now), false);
});

test('SRS follows 0 → 1 → 3 → multiplier and never drops ease below 1.3', () => {
    const now = Date.UTC(2026, 7, 30);
    const first = reviewSrsCard(card(), true, now);
    const second = reviewSrsCard(first, true, now);
    const third = reviewSrsCard(second, true, now);
    assert.deepEqual([first.intervalDays, second.intervalDays, third.intervalDays], [1, 3, 8]);
    let difficult = card({ easeFactor: 1.3, intervalDays: 3 });
    for (let index = 0; index < 8; index += 1) difficult = reviewSrsCard(difficult, false, now);
    assert.equal(difficult.easeFactor, 1.3);
    assert.equal(difficult.due, true);
});

test('lesson validation rejects the regressions that previously broke lessons', () => {
    const issues = validateLessonDraft('Lesson', [
        { id: 1, order: 0, type: 'quiz', question: 'Q', options: ['yes', ''], correctOption: 'missing' },
        { id: 2, order: 1, type: 'fill_blank', sentence: 'No gap', options: ['has'], correctAnswer: 'have' },
        { id: 3, order: 2, type: 'word_order', words: ['I', 'am'], correctOrder: ['I', 'was'] },
    ]);
    assert.ok(issues.some(issue => issue.message.includes('непорожні')));
    assert.ok(issues.some(issue => issue.message.includes('пропуску')));
    assert.ok(issues.some(issue => issue.message.includes('ті самі слова')));
});
