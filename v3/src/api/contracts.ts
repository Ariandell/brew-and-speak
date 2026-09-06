import { z } from 'zod';

export const roleSchema = z.enum(['student', 'teacher']);
export type Role = z.infer<typeof roleSchema>;

export const capabilitySchema = z.enum([
  'student:learn',
  'student:submit_homework',
  'teacher:manage_courses',
  'teacher:manage_lessons',
  'teacher:grade_homework',
  'teacher:manage_students',
  'teacher:chat',
  'teacher:manage_broadcasts',
  'teacher:read_statistics',
]);
export type Capability = z.infer<typeof capabilitySchema>;

export const apiErrorCodeSchema = z.enum([
  'UNAUTHENTICATED',
  'AUTH_EXPIRED',
  'FORBIDDEN',
  'BLOCKED',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'CONTENT_INVALID',
  'CONFLICT',
  'COOLDOWN',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL',
]);

export const apiErrorSchema = z.object({
  code: apiErrorCodeSchema,
  message: z.string().min(1),
  requestId: z.string().min(1),
  fields: z.record(z.string(), z.array(z.string())).optional(),
  retryAfter: z.number().int().nonnegative().optional(),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const homeworkStatusSchema = z.enum(['none', 'pending', 'graded']);
export type HomeworkStatus = z.infer<typeof homeworkStatusSchema>;

const blockBaseSchema = z.object({
  id: z.number().int().positive(),
  order: z.number().int().nonnegative(),
});

const textBlockSchema = blockBaseSchema.extend({
  type: z.literal('text'),
  html: z.string(),
});

const audioBlockSchema = blockBaseSchema.extend({
  type: z.literal('audio'),
  assetId: z.string().min(1),
  title: z.string().optional(),
});

const photoBlockSchema = blockBaseSchema.extend({
  type: z.literal('photo'),
  assetId: z.string().min(1),
  alt: z.string(),
});

const mascotTipBlockSchema = blockBaseSchema.extend({
  type: z.literal('mascot_tip'),
  html: z.string().min(1),
  mood: z.enum(['neutral', 'happy', 'perfect', 'sad', 'surprised']).default('neutral'),
});

const unsupportedBlockSchema = blockBaseSchema.extend({
  type: z.literal('unsupported'),
  reason: z.string().min(1),
});

const quizBlockSchema = blockBaseSchema.extend({
  type: z.literal('quiz'),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).min(2),
  correctOption: z.string().min(1),
});

const fillBlankBlockSchema = blockBaseSchema.extend({
  type: z.literal('fill_blank'),
  sentence: z.string().min(1),
  options: z.array(z.string().min(1)).min(1),
  correctAnswer: z.string().min(1),
});

const trueFalseBlockSchema = blockBaseSchema.extend({
  type: z.literal('true_false'),
  statement: z.string().min(1),
  correct: z.boolean(),
});

const wordOrderBlockSchema = blockBaseSchema.extend({
  type: z.literal('word_order'),
  words: z.array(z.string().min(1)).min(2),
  correctOrder: z.array(z.string().min(1)).min(2),
});

const matchPairsBlockSchema = blockBaseSchema.extend({
  type: z.literal('match_pairs'),
  pairs: z.array(z.object({
    left: z.string().min(1),
    right: z.string().min(1),
  })).min(1),
});

const homeworkBlockSchema = blockBaseSchema.extend({
  type: z.literal('homework'),
  promptHtml: z.string().min(1),
});

export const lessonBlockSchema = z.discriminatedUnion('type', [
  textBlockSchema,
  audioBlockSchema,
  photoBlockSchema,
  mascotTipBlockSchema,
  quizBlockSchema,
  fillBlankBlockSchema,
  trueFalseBlockSchema,
  wordOrderBlockSchema,
  matchPairsBlockSchema,
  homeworkBlockSchema,
  unsupportedBlockSchema,
]);
export type LessonBlock = z.infer<typeof lessonBlockSchema>;

export const meResponseSchema = z.object({
  userId: z.number().int().positive(),
  name: z.string(),
  username: z.string().nullable(),
  role: roleSchema,
  isBlocked: z.boolean(),
  capabilities: z.array(capabilitySchema),
  enrollment: z.object({
    courseId: z.number().int().positive().nullable(),
  }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export const activityStreakResponseSchema = z.object({
  streakDays: z.number().int().nonnegative(),
});

export const coursePathItemSchema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string(),
  order: z.number().int().nonnegative(),
  status: z.enum(['locked', 'available', 'completed']),
  unlocksAt: z.string().datetime({ offset: true }).nullable(),
  completedAt: z.string().datetime({ offset: true }).nullable(),
  score: z.number().int().min(0).max(10).nullable(),
  homework: z.object({
    status: homeworkStatusSchema,
    hasHomework: z.boolean(),
    grade: z.number().int().min(0).max(10).nullable(),
  }),
});
export type CoursePathItem = z.infer<typeof coursePathItemSchema>;

export const coursePathResponseSchema = z.object({
  courseId: z.number().int().positive(),
  items: z.array(coursePathItemSchema),
});
export type CoursePathResponse = z.infer<typeof coursePathResponseSchema>;

export const teacherCourseSchema = z.object({
  courseId: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  order: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
});
export type TeacherCourse = z.infer<typeof teacherCourseSchema>;

export const createCourseRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(10_000),
  order: z.number().int().nonnegative(),
});

export const updateCourseRequestSchema = createCourseRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Потрібно передати хоча б одне поле',
);

export const teacherCoursesResponseSchema = z.object({
  items: z.array(teacherCourseSchema),
});
export type TeacherCoursesResponse = z.infer<typeof teacherCoursesResponseSchema>;

export const courseListResponseSchema = z.object({
  items: z.array(teacherCourseSchema),
});

export const meCourseResponseSchema = z.object({
  course: teacherCourseSchema,
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  nextLessonId: z.number().int().positive().nullable(),
});

export const enrollmentRequestSchema = z.object({
  courseId: z.number().int().positive(),
});

export const enrollmentResponseSchema = z.object({
  courseId: z.number().int().positive(),
});

export const teacherStatisticsSchema = z.object({
  studentCount: z.number().int().nonnegative(),
  blockedStudentCount: z.number().int().nonnegative(),
  courseCount: z.number().int().nonnegative(),
  lessonCount: z.number().int().nonnegative(),
  pendingHomeworkCount: z.number().int().nonnegative(),
  completedLessonCount: z.number().int().nonnegative(),
});

export const teacherStatisticsResponseSchema = z.object({ item: teacherStatisticsSchema });

export const teacherLessonSummarySchema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string(),
  order: z.number().int().nonnegative(),
  blockCount: z.number().int().nonnegative(),
  hasHomework: z.boolean(),
});
export type TeacherLessonSummary = z.infer<typeof teacherLessonSummarySchema>;

export const teacherLessonsResponseSchema = z.object({
  courseId: z.number().int().positive(),
  items: z.array(teacherLessonSummarySchema),
});
export type TeacherLessonsResponse = z.infer<typeof teacherLessonsResponseSchema>;

export const createLessonRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  order: z.number().int().nonnegative(),
});

export const updateLessonRequestSchema = createLessonRequestSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Потрібно передати хоча б одне поле',
);

export const teacherStudentSchema = z.object({
  studentId: z.number().int().positive(),
  name: z.string(),
  username: z.string().nullable(),
  isBlocked: z.boolean(),
  enrolledCourseId: z.number().int().positive().nullable(),
});
export const teacherStudentsResponseSchema = z.object({ items: z.array(teacherStudentSchema) });
export const teacherStudentDetailsSchema = teacherStudentSchema.extend({
  completedLessons: z.number().int().nonnegative(),
  totalLessons: z.number().int().nonnegative(),
  averageScore: z.number().min(0).max(10).nullable(),
  pendingHomework: z.number().int().nonnegative(),
});
export const teacherStudentDetailsResponseSchema = z.object({ item: teacherStudentDetailsSchema });

export const lessonResponseSchema = z.object({
  lessonId: z.number().int().positive(),
  title: z.string(),
  contentRevision: z.string().min(1),
  blocks: z.array(lessonBlockSchema),
});
export type LessonResponse = z.infer<typeof lessonResponseSchema>;

export const attemptSnapshotSchema = z.object({
  attemptId: z.string().min(1),
  userId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  contentRevision: z.string().min(1),
  status: z.enum(['active', 'finished']),
  total: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  wrong: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  score: z.number().int().min(0).max(10).nullable(),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }).nullable(),
});
export type AttemptSnapshot = z.infer<typeof attemptSnapshotSchema>;

export const startAttemptRequestSchema = z.object({
  attemptId: z.string().min(1).max(80),
  lessonId: z.number().int().positive(),
});
export type StartAttemptRequest = z.infer<typeof startAttemptRequestSchema>;

export const recordAttemptAnswerRequestSchema = z.object({
  blockId: z.string().min(1).max(80),
  answer: z.union([
    z.string().max(10000), z.boolean(),
    z.array(z.string().max(1000)).max(200),
    z.array(z.object({ left: z.string().max(1000), right: z.string().max(1000) }).strict()).max(200),
  ]),
}).strict();
export type RecordAttemptAnswerRequest = z.infer<typeof recordAttemptAnswerRequestSchema>;

export const flashcardSchema = z.object({
  flashcardId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  lessonTitle: z.string(),
  front: z.string().min(1),
  back: z.string().min(1),
  examplePhrase: z.string().nullable(),
  timesShown: z.number().int().nonnegative(),
  timesCorrect: z.number().int().nonnegative(),
  timesWrong: z.number().int().nonnegative(),
  easeFactor: z.number().min(1.3),
  intervalDays: z.number().int().nonnegative(),
  nextReviewAt: z.string().datetime({ offset: true }).nullable(),
});
export type Flashcard = z.infer<typeof flashcardSchema>;

export const dictionaryResponseSchema = z.object({
  items: z.array(flashcardSchema),
});
export type DictionaryResponse = z.infer<typeof dictionaryResponseSchema>;

export const studySessionResponseSchema = z.object({
  items: z.array(flashcardSchema).max(20),
});
export type StudySessionResponse = z.infer<typeof studySessionResponseSchema>;

export const homeworkAssetReferenceSchema = z.object({
  assetId: z.string().min(1).max(160),
  storageKey: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100),
  bytes: z.number().int().nonnegative().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  fileName: z.string().min(1).max(240).optional(),
});

export const submitHomeworkRequestSchema = z.object({
  submissionId: z.string().min(1).max(80),
  answerHtml: z.string().max(100_000),
  assets: z.array(homeworkAssetReferenceSchema).max(5).default([]),
});

export const gradeHomeworkRequestSchema = z.object({
  grade: z.number().int().min(0).max(10),
  teacherComment: z.string().max(10_000),
});

export const homeworkSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  userId: z.number().int().positive(),
  lessonId: z.number().int().positive(),
  answerHtml: z.string(),
  status: z.enum(['pending', 'graded']),
  grade: z.number().int().min(0).max(10).nullable(),
  teacherComment: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  gradedAt: z.string().datetime({ offset: true }).nullable(),
  assets: z.array(homeworkAssetReferenceSchema),
  legacyAttachment: z.object({ assetId: z.string().min(1).max(160), fileName: z.string().min(1).max(240) }).optional(),
});
export type HomeworkSubmission = z.infer<typeof homeworkSubmissionSchema>;

export const homeworkListResponseSchema = z.object({
  items: z.array(homeworkSubmissionSchema),
});

export const homeworkPromptResponseSchema = z.object({
  lessonId: z.number().int().positive(),
  promptHtml: z.string().min(1),
  submission: homeworkSubmissionSchema.nullable(),
});

export const chatMessageSchema = z.object({
  messageId: z.string().min(1),
  senderUserId: z.number().int().positive(),
  recipientUserId: z.number().int().positive(),
  body: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  readAt: z.string().datetime({ offset: true }).nullable(),
});

export const chatResponseSchema = z.object({ items: z.array(chatMessageSchema) });
export const sendChatMessageRequestSchema = z.object({
  messageId: z.string().min(1).max(80),
  body: z.string().min(1).max(10_000),
});
export const readChatRequestSchema = z.object({ messageId: z.string().min(1).max(80) });

export const photoMessageSchema = z.object({
  photoId: z.string().min(1),
  assetId: z.string().min(1),
  caption: z.string(),
  scheduledAt: z.string().datetime({ offset: true }),
  viewedAt: z.string().datetime({ offset: true }).nullable(),
});
export const photoMessagesResponseSchema = z.object({ items: z.array(photoMessageSchema) });
export const schedulePhotoRequestSchema = z.object({
  photoId: z.string().min(1).max(80),
  assetId: z.string().min(1).max(160),
  caption: z.string().max(10_000),
  scheduledAt: z.string().datetime({ offset: true }),
});
export const viewedPhotoRequestSchema = z.object({});

export const sandboxAssetUploadRequestSchema = z.object({
  assetId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._-]+$/),
  mimeType: z.string().min(1).max(160),
  fileName: z.string().min(1).max(240).optional(),
  base64Data: z.string().min(1).max(28_000_000),
});

export const assetUploadSessionRequestSchema = z.object({
  uploadId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._-]+$/),
  assetId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._-]+$/),
  mimeType: z.string().min(1).max(160),
  fileName: z.string().min(1).max(240).optional(),
  totalBytes: z.number().int().positive().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  chunkSize: z.number().int().positive().max(512 * 1024),
  totalChunks: z.number().int().positive().max(40),
});

export const assetUploadSessionSchema = z.object({
  uploadId: z.string().min(1),
  assetId: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
  chunkSize: z.number().int().positive().max(512 * 1024),
  totalChunks: z.number().int().positive().max(40),
  nextChunkIndex: z.number().int().nonnegative().max(40),
  status: z.enum(['active', 'finalized']),
});

export const assetUploadChunkRequestSchema = z.object({
  base64Data: z.string().min(1).max(700_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const assetMetadataSchema = z.object({
  assetId: z.string().min(1),
  mimeType: z.string().min(1),
  bytes: z.number().int().nonnegative().max(20 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
});

export const srsReviewRequestSchema = z.object({
  correct: z.boolean(),
  idempotencyKey: z.string().min(1).max(120),
});
export const srsReviewResponseSchema = z.object({
  flashcardId: z.number().int().positive(),
  timesShown: z.number().int().nonnegative(),
  timesCorrect: z.number().int().nonnegative(),
  timesWrong: z.number().int().nonnegative(),
  easeFactor: z.number().min(1.3),
  intervalDays: z.number().int().nonnegative(),
  nextReviewAt: z.string().datetime({ offset: true }),
});

export const pagedResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  items: z.array(itemSchema),
  nextCursor: z.string().nullable(),
});
