import { z } from 'zod';
import { createApiClient, type ApiClient } from './client.js';
import * as contracts from './contracts.js';
import { getTelegramInitData } from './telegramInitData.js';
import { createProductWrites } from './productWrites.js';
import type {
    ProductCard, ProductCourse, ProductHomework, ProductLesson, ProductStudent, ProductUser,
} from '../app/productTypes.js';

// Null explicitly represents fields the read API cannot supply. These are not
// complete ProductState records and must not be cast to demo-backed models.
export type ProductUserRead = Omit<ProductUser, 'streakDays'> & {
    streakDays: null;
    capabilities: contracts.Capability[];
};
export type ProductCourseRead = Omit<ProductCourse, 'level'> & { level: null; lessonCount: number };
export type ProductPathLessonRead = Pick<ProductLesson,
    'id' | 'courseId' | 'title' | 'order' | 'status' | 'unlocksAt' | 'completedAt' | 'score'> & {
    homework: contracts.CoursePathItem['homework'];
};
export type ProductLessonRead = Pick<ProductLesson, 'id' | 'title' | 'blocks'> & {
    contentRevision: string;
};
export type ProductHomeworkRead = Omit<ProductHomework, 'promptHtml'> & {
    promptHtml: string | null;
    assets: contracts.HomeworkSubmission['assets'];
    gradedAt: string | null;
};
export type ProductCardRead = Omit<ProductCard, 'example'> & {
    example: string | null;
    lessonTitle: string;
};
export type ProductStudentSummaryRead = Pick<ProductStudent,
    'id' | 'name' | 'username' | 'courseId' | 'isBlocked'>;
export type ProductStudentRead = Omit<ProductStudent, 'lastActive'> & {
    lastActive: null;
    pendingHomework: number;
};
export type ProductTeacherLessonRead = Pick<ProductLesson, 'id' | 'courseId' | 'title' | 'order'> & {
    blockCount: number;
    hasHomework: boolean;
};

const mapCourse = (course: contracts.TeacherCourse): ProductCourseRead => ({
    id: course.courseId, title: course.title, description: course.description,
    order: course.order, lessonCount: course.lessonCount, level: null,
});

const mapLesson = (lesson: contracts.LessonResponse): ProductLessonRead => ({
    id: lesson.lessonId, title: lesson.title, contentRevision: lesson.contentRevision,
    blocks: lesson.blocks,
});

const mapHomework = (item: contracts.HomeworkSubmission, promptHtml: string | null = null): ProductHomeworkRead => ({
    id: item.submissionId, studentId: item.userId, lessonId: item.lessonId,
    promptHtml, answer: item.answerHtml, status: item.status, grade: item.grade,
    comment: item.teacherComment, submittedAt: item.createdAt, gradedAt: item.gradedAt,
    fileName: item.assets[0]?.fileName ?? item.legacyAttachment?.fileName ?? null, assets: item.assets,
    // The product's singular attachment field cannot represent multiple assets.
    ...(item.assets.length === 1 ? { assetId: item.assets[0].assetId }
        : item.legacyAttachment ? { assetId: item.legacyAttachment.assetId } : {}),
});

const mapCard = (card: contracts.Flashcard, now: number): ProductCardRead => ({
    id: card.flashcardId, lessonId: card.lessonId, lessonTitle: card.lessonTitle,
    front: card.front, back: card.back, example: card.examplePhrase,
    // Display classification follows the frontend's three-correct-review rule;
    // a zero interval indicates a reset after an incorrect review.
    state: card.timesShown === 0 ? 'new' : card.timesCorrect >= 3 && card.intervalDays > 0 ? 'learned' : 'learning',
    due: card.nextReviewAt === null || Date.parse(card.nextReviewAt) <= now,
    timesShown: card.timesShown, timesCorrect: card.timesCorrect, timesWrong: card.timesWrong,
    easeFactor: card.easeFactor, intervalDays: card.intervalDays, nextReviewAt: card.nextReviewAt,
});

const mapStudent = (student: z.infer<typeof contracts.teacherStudentSchema>): ProductStudentSummaryRead => ({
    id: student.studentId, name: student.name, username: student.username,
    courseId: student.enrolledCourseId, isBlocked: student.isBlocked,
});

const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Canonical API bindings; write availability depends on server route deployment.
 * The current production entrypoint is read-only. No sandbox fallback is attempted.
 * Inject a client for tests or host configuration; the default requires SDK initData.
 */
export function createProductApi(
    client: ApiClient = createApiClient({ getInitData: getTelegramInitData }),
    now: () => number = Date.now,
) {
    const read = <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) =>
        client.request(path, schema, { method: 'GET', cache: 'no-store', signal });

    return {
        ...createProductWrites(client),
        async loadCurrentUser(signal?: AbortSignal): Promise<ProductUserRead> {
            const user = await read('/me', contracts.meResponseSchema, signal);
            return {
                id: user.userId, name: user.name, username: user.username, role: user.role,
                isBlocked: user.isBlocked, courseId: user.enrollment.courseId,
                capabilities: user.capabilities, streakDays: null,
            };
        },
        async loadCurrentStreak(signal?: AbortSignal): Promise<number> {
            return (await read('/me/streak', contracts.activityStreakResponseSchema, signal)).streakDays;
        },
        async loadCourses(signal?: AbortSignal): Promise<ProductCourseRead[]> {
            return (await read('/courses', contracts.courseListResponseSchema, signal)).items.map(mapCourse);
        },
        async loadCurrentCourse(signal?: AbortSignal) {
            const response = await read('/me/course', contracts.meCourseResponseSchema, signal);
            return { ...response, course: mapCourse(response.course) };
        },
        async loadCurrentCoursePath(signal?: AbortSignal): Promise<{ courseId: number; items: ProductPathLessonRead[] }> {
            const path = await read('/me/course/path', contracts.coursePathResponseSchema, signal);
            return {
                courseId: path.courseId,
                items: path.items.map(item => ({
                    id: item.lessonId, courseId: path.courseId, title: item.title, order: item.order,
                    status: item.status, unlocksAt: item.unlocksAt, completedAt: item.completedAt,
                    score: item.score,
                    homework: item.homework,
                })),
            };
        },
        async loadLesson(lessonId: number, signal?: AbortSignal): Promise<ProductLessonRead> {
            return mapLesson(await read(`/lessons/${idSchema.parse(lessonId)}`, contracts.lessonResponseSchema, signal));
        },
        async loadCurrentHomework(signal?: AbortSignal): Promise<ProductHomeworkRead[]> {
            return (await read('/me/homework', contracts.homeworkListResponseSchema, signal)).items.map(item => mapHomework(item));
        },
        async loadLessonHomework(lessonId: number, signal?: AbortSignal) {
            const response = await read(`/lessons/${idSchema.parse(lessonId)}/homework`, contracts.homeworkPromptResponseSchema, signal);
            return { ...response, submission: response.submission ? mapHomework(response.submission, response.promptHtml) : null };
        },
        async loadCards(signal?: AbortSignal): Promise<ProductCardRead[]> {
            const response = await read('/me/dictionary', contracts.dictionaryResponseSchema, signal);
            const timestamp = now();
            return response.items.map(card => mapCard(card, timestamp));
        },
        async loadStudyCards(limit = 20, signal?: AbortSignal): Promise<ProductCardRead[]> {
            const response = await read(`/me/study-session?limit=${idSchema.max(20).parse(limit)}`, contracts.studySessionResponseSchema, signal);
            const timestamp = now();
            return response.items.map(card => mapCard(card, timestamp));
        },
        async loadTeacherCourses(signal?: AbortSignal): Promise<ProductCourseRead[]> {
            return (await read('/teacher/courses', contracts.teacherCoursesResponseSchema, signal)).items.map(mapCourse);
        },
        async loadTeacherLessons(courseId: number, signal?: AbortSignal): Promise<{ courseId: number; items: ProductTeacherLessonRead[] }> {
            const response = await read(`/teacher/courses/${idSchema.parse(courseId)}/lessons`, contracts.teacherLessonsResponseSchema, signal);
            return {
                courseId: response.courseId,
                items: response.items.map(item => ({
                    id: item.lessonId, courseId: response.courseId, title: item.title,
                    order: item.order, blockCount: item.blockCount, hasHomework: item.hasHomework,
                })),
            };
        },
        async loadTeacherLesson(lessonId: number, signal?: AbortSignal): Promise<ProductLessonRead> {
            return mapLesson(await read(`/teacher/lessons/${idSchema.parse(lessonId)}`, contracts.lessonResponseSchema, signal));
        },
        async loadTeacherHomework(status?: 'pending' | 'graded', signal?: AbortSignal): Promise<ProductHomeworkRead[]> {
            const query = status === undefined ? '' : `?status=${contracts.homeworkSubmissionSchema.shape.status.parse(status)}`;
            return (await read(`/teacher/homework${query}`, contracts.homeworkListResponseSchema, signal)).items.map(item => mapHomework(item));
        },
        async loadTeacherHomeworkSubmission(submissionId: string, signal?: AbortSignal): Promise<ProductHomeworkRead> {
            // The current read-only route accepts positive numeric legacy IDs only.
            const id = z.string().regex(/^[1-9]\d*$/).refine(value => Number.isSafeInteger(Number(value))).parse(submissionId);
            return mapHomework(await read(`/teacher/homework/${id}`, contracts.homeworkSubmissionSchema, signal));
        },
        async loadTeacherStudents(signal?: AbortSignal): Promise<ProductStudentSummaryRead[]> {
            return (await read('/teacher/students', contracts.teacherStudentsResponseSchema, signal)).items.map(mapStudent);
        },
        async loadTeacherStudent(studentId: number, signal?: AbortSignal): Promise<ProductStudentRead> {
            const { item } = await read(`/teacher/students/${idSchema.parse(studentId)}`, contracts.teacherStudentDetailsResponseSchema, signal);
            return {
                ...mapStudent(item), completedLessons: item.completedLessons, totalLessons: item.totalLessons,
                averageScore: item.averageScore, pendingHomework: item.pendingHomework, lastActive: null,
            };
        },
        async loadTeacherStatistics(signal?: AbortSignal) {
            return (await read('/teacher/statistics', contracts.teacherStatisticsResponseSchema, signal)).item;
        },
    };
}

export type ProductApi = ReturnType<typeof createProductApi>;
