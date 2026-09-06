import { z } from 'zod';
import { chatMessageSchema, lessonBlockSchema, schedulePhotoRequestSchema, teacherStudentSchema } from './contracts.js';

export const resourceIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export const encodedId = (value: string, max = 80): string =>
    encodeURIComponent(z.string().min(1).max(max).refine(id => id !== '.' && id !== '..').parse(value));

// Wire shapes implemented by the current handlers but absent from contracts.ts.
export const attemptAnswerResponseSchema = z.discriminatedUnion('recorded', [
    z.object({ recorded: z.literal(true), reason: z.literal('recorded'), outcome: z.enum(['correct', 'wrong']) }),
    z.object({ recorded: z.literal(false), reason: z.literal('duplicate'), outcome: z.enum(['correct', 'wrong']) }),
]);
export const saveLessonDraftRequestSchema = z.object({
    expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).nullable(),
    blocks: z.array(lessonBlockSchema),
}).strict();
export type SaveLessonDraftRequest = z.input<typeof saveLessonDraftRequestSchema>;
export const studentBlockResponseSchema = teacherStudentSchema.pick({ studentId: true, isBlocked: true });
export const schedulePhotoResponseSchema = schedulePhotoRequestSchema.pick({ photoId: true });
export const teacherConversationsResponseSchema = z.object({ items: z.array(z.object({
    studentUserId: resourceIdSchema,
    lastMessage: chatMessageSchema.nullable(),
    unreadCount: z.number().int().nonnegative(),
})) });
