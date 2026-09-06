import type { LessonBlock } from '../api/contracts';

export type ProductRole = 'student' | 'teacher';
export type LessonStatus = 'locked' | 'available' | 'completed';
export type SubmissionStatus = 'draft' | 'pending' | 'graded';

export interface ProductUser {
    id: number;
    name: string;
    username: string | null;
    role: ProductRole;
    isBlocked: boolean;
    courseId: number | null;
    streakDays: number;
}

export interface ProductCourse {
    id: number;
    title: string;
    description: string;
    level: string;
    order: number;
    lessonCount?: number;
}

export interface ProductLesson {
    id: number;
    courseId: number;
    order: number;
    title: string;
    subtitle: string;
    durationMinutes: number;
    status: LessonStatus;
    unlocksAt: string | null;
    completedAt: string | null;
    score: number | null;
    revision: number;
    blocks: LessonBlock[];
}

export interface LessonResult {
    studentId: number;
    lessonId: number;
    total: number;
    correct: number;
    wrong: number;
    skipped: number;
    score: number;
}

export type LessonProgress = Pick<ProductLesson, 'status' | 'unlocksAt' | 'completedAt' | 'score'>;
export type CardProgress = Pick<ProductCard, 'state' | 'due' | 'timesShown' | 'timesCorrect' | 'timesWrong' | 'easeFactor' | 'intervalDays' | 'nextReviewAt'>;

export interface ProductHomework {
    assetId?: string;
    id: string;
    studentId: number;
    lessonId: number;
    promptHtml: string;
    answer: string;
    fileName: string | null;
    status: SubmissionStatus;
    grade: number | null;
    comment: string | null;
    submittedAt: string | null;
    assets?: Array<{ assetId: string; storageKey: string; mimeType: string; bytes: number; sha256: string; fileName?: string }>;
}

export interface ProductCard {
    id: number;
    lessonId: number;
    front: string;
    back: string;
    example: string;
    state: 'new' | 'learning' | 'learned';
    due: boolean;
    timesShown: number;
    timesCorrect: number;
    timesWrong: number;
    easeFactor: number;
    intervalDays: number;
    nextReviewAt: string | null;
}

export interface ProductMessage {
    id: string;
    studentId: number;
    from: ProductRole;
    body: string;
    createdAt: string;
    read: boolean;
}

export interface ProductStudent {
    id: number;
    name: string;
    username: string | null;
    courseId: number | null;
    isBlocked: boolean;
    completedLessons: number;
    totalLessons: number;
    averageScore: number | null;
    lastActive: string;
}

export interface ProductBroadcast {
    id: string;
    caption: string;
    imageName: string;
    scheduledAt: string;
    status: 'scheduled' | 'sent';
    viewedBy: number[];
    assetId?: string;
}

export interface ProductState {
    currentUser: ProductUser;
    courses: ProductCourse[];
    lessons: ProductLesson[];
    results: LessonResult[];
    homework: ProductHomework[];
    cards: ProductCard[];
    messages: ProductMessage[];
    students: ProductStudent[];
    broadcasts: ProductBroadcast[];
    lessonAttempts: Record<number, Record<number, Record<number, 'correct' | 'wrong'>>>;
    lessonProgress: Record<number, Record<number, LessonProgress>>;
    cardProgress: Record<number, Record<number, CardProgress>>;
}
