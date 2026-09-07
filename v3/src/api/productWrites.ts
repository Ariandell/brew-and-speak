import { z } from 'zod';
import { generatedVocabularySchema, vocabularySchema, type LessonVocabulary } from './vocabularyContracts.js';
import type { ApiClient } from './client.js';
import * as c from './contracts.js';
import { createHomeworkApi, type SubmitHomeworkInput } from './homeworkApi.js';
import { attemptAnswerResponseSchema, encodedId, resourceIdSchema as id, saveLessonDraftRequestSchema,
    schedulePhotoResponseSchema, studentBlockResponseSchema, teacherConversationsResponseSchema,
    type SaveLessonDraftRequest } from './productWriteContracts.js';

/** Canonical route bindings. Deployment must mount the corresponding handlers.
 * No retries: callers retain attemptId/blockId, idempotencyKey, submissionId,
 * assetId, messageId and photoId for retries of the SAME logical operation.
 * Course creation has no idempotency contract; draft saves use expectedRevision.
 */
export function createProductWrites(client: ApiClient) {
    const homework = createHomeworkApi(client);
    const send = <T>(path: string, schema: z.ZodType<T>, body?: unknown, signal?: AbortSignal, method = 'POST') =>
        client.request(path, schema, { method, body, signal, cache: 'no-store' });
    const read = <T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) =>
        client.request(path, schema, { method: 'GET', signal, cache: 'no-store' });
    const empty = (path: string, body?: unknown, signal?: AbortSignal, method = 'POST') =>
        client.request(path, z.undefined(), { method, body, signal, cache: 'no-store', expectedStatus: 204 });
    const digest = async (bytes: Uint8Array) => {
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        return Array.from(hash, value => value.toString(16).padStart(2, '0')).join('');
    };
    const base64 = (bytes: Uint8Array) => {
        let binary = '';
        for (let offset = 0; offset < bytes.length; offset += 8192) {
            binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
        }
        return btoa(binary);
    };
    const uploadAsset = async (assetId: string, file: File, signal?: AbortSignal) => {
        encodedId(assetId, 160);
        if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Файл має бути непорожнім і не більшим за 20 МБ.');
        if (!file.type) throw new Error('Файл повинен мати відомий MIME-тип.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sha256 = await digest(bytes);
        const uploadKey = new TextEncoder().encode(`${assetId}\n${sha256}`);
        const uploadId = `upload-${(await digest(uploadKey)).slice(0, 40)}`;
        const chunkSize = 512 * 1024;
        const totalChunks = Math.ceil(bytes.length / chunkSize);
        const request = c.assetUploadSessionRequestSchema.strict().parse({ uploadId, assetId, mimeType: file.type,
            fileName: file.name, totalBytes: bytes.length, sha256, chunkSize, totalChunks });
        const session = await send('/assets/uploads', c.assetUploadSessionSchema, request, signal);
        for (let index = session.nextChunkIndex; index < totalChunks; index += 1) {
            const chunk = bytes.subarray(index * chunkSize, Math.min(bytes.length, (index + 1) * chunkSize));
            const body = c.assetUploadChunkRequestSchema.strict().parse({ base64Data: base64(chunk), sha256: await digest(chunk) });
            await send(`/assets/uploads/${encodedId(uploadId)}/chunks/${index}`, c.assetUploadSessionSchema, body, signal, 'PUT');
        }
        const metadata = await send(`/assets/uploads/${encodedId(uploadId)}/finalize`, c.assetMetadataSchema, undefined, signal);
        if (metadata.assetId !== assetId || metadata.sha256.toLowerCase() !== sha256
            || metadata.bytes !== bytes.length || metadata.mimeType !== file.type) {
            throw new Error('API returned mismatched asset metadata');
        }
        return metadata;
    };
    return {
        loadLessonVocabulary: (lessonId: number) => read(`/teacher/lessons/${id.parse(lessonId)}/vocabulary`, vocabularySchema),
        generateLessonVocabulary: (lessonId: number) => send(`/teacher/lessons/${id.parse(lessonId)}/vocabulary/generate`, generatedVocabularySchema),
        saveLessonVocabulary: (lessonId: number, input: LessonVocabulary) => send(`/teacher/lessons/${id.parse(lessonId)}/vocabulary`, vocabularySchema, vocabularySchema.parse(input), undefined, 'PUT'),
        async enroll(input: z.input<typeof c.enrollmentRequestSchema>, signal?: AbortSignal) {
            return send('/me/enrollment', c.enrollmentResponseSchema, c.enrollmentRequestSchema.strict().parse(input), signal);
        },
        async startAttempt(input: c.StartAttemptRequest, signal?: AbortSignal) {
            return send('/attempts', c.attemptSnapshotSchema, c.startAttemptRequestSchema.strict().parse(input), signal);
        },
        async answerAttempt(attemptId: string, input: c.RecordAttemptAnswerRequest, signal?: AbortSignal) {
            return send(`/attempts/${encodedId(attemptId)}/answers`, attemptAnswerResponseSchema,
                c.recordAttemptAnswerRequestSchema.parse(input), signal);
        },
        async finishAttempt(attemptId: string, signal?: AbortSignal) {
            return send(`/attempts/${encodedId(attemptId)}/finish`, c.attemptSnapshotSchema, undefined, signal);
        },
        async reviewCard(cardId: number, input: z.input<typeof c.srsReviewRequestSchema>, signal?: AbortSignal) {
            return send(`/me/flashcards/${id.parse(cardId)}/review`, c.srsReviewResponseSchema,
                c.srsReviewRequestSchema.strict().parse(input), signal);
        },
        async uploadHomeworkAsset(assetId: string, file: File, signal?: AbortSignal) {
            return uploadAsset(assetId, file, signal);
        },
        async uploadTeacherAsset(assetId: string, file: File, signal?: AbortSignal) {
            return uploadAsset(assetId, file, signal);
        },
        async abortAssetUpload(uploadId: string, signal?: AbortSignal) {
            return empty(`/assets/uploads/${encodedId(uploadId)}`, undefined, signal, 'DELETE');
        },
        async submitHomework(input: SubmitHomeworkInput, signal?: AbortSignal) {
            id.parse(input.lessonId);
            const { lessonId, file, ...request } = input;
            const body = c.submitHomeworkRequestSchema.strict().parse(request);
            if (file) {
                if (body.assets.length >= 5) throw new Error('Homework supports at most five assets');
                const metadata = await uploadAsset(`${body.submissionId}-attachment`, file, signal);
                body.assets.push({ ...metadata, storageKey: metadata.assetId, fileName: file.name });
            }
            return homework.submit({ lessonId, ...body }, signal);
        },
        async gradeHomework(submissionId: string, input: z.input<typeof c.gradeHomeworkRequestSchema>, signal?: AbortSignal) {
            const body = c.gradeHomeworkRequestSchema.strict().parse(input);
            return homework.grade(submissionId, body.grade, body.teacherComment, signal);
        },
        async downloadHomeworkAsset(assetId: string, signal?: AbortSignal) { return homework.download(assetId, signal); },
        async saveTeacherLessonDraft(lessonId: number, input: SaveLessonDraftRequest, signal?: AbortSignal) {
            // Only blocks are writable. Semantic content validation remains server-owned.
            return send(`/teacher/lessons/${id.parse(lessonId)}/blocks`, c.lessonResponseSchema,
                saveLessonDraftRequestSchema.parse(input), signal, 'PUT');
        },
        async createLesson(courseId: number, input: z.input<typeof c.createLessonRequestSchema>, signal?: AbortSignal) {
            return send(`/teacher/courses/${id.parse(courseId)}/lessons`, c.lessonResponseSchema,
                c.createLessonRequestSchema.strict().parse(input), signal);
        },
        async updateLesson(lessonId: number, input: z.input<typeof c.updateLessonRequestSchema>, signal?: AbortSignal) {
            return send(`/teacher/lessons/${id.parse(lessonId)}`, c.lessonResponseSchema,
                c.updateLessonRequestSchema.strict().parse(input), signal, 'PATCH');
        },
        async deleteLesson(lessonId: number, signal?: AbortSignal) {
            return empty(`/teacher/lessons/${id.parse(lessonId)}`, undefined, signal, 'DELETE');
        },
        async blockStudent(studentId: number, signal?: AbortSignal) {
            return send(`/teacher/students/${id.parse(studentId)}/block`, studentBlockResponseSchema, undefined, signal);
        },
        async unblockStudent(studentId: number, signal?: AbortSignal) {
            return send(`/teacher/students/${id.parse(studentId)}/unblock`, studentBlockResponseSchema, undefined, signal);
        },
        async createCourse(input: z.input<typeof c.createCourseRequestSchema>, signal?: AbortSignal) {
            return send('/teacher/courses', c.teacherCourseSchema, c.createCourseRequestSchema.strict().parse(input), signal);
        },
        async updateCourse(courseId: number, input: z.input<typeof c.updateCourseRequestSchema>, signal?: AbortSignal) {
            return send(`/teacher/courses/${id.parse(courseId)}`, c.teacherCourseSchema,
                c.updateCourseRequestSchema.strict().parse(input), signal, 'PATCH');
        },
        async deleteCourse(courseId: number, signal?: AbortSignal) {
            return empty(`/teacher/courses/${id.parse(courseId)}`, undefined, signal, 'DELETE');
        },
        async loadCurrentChat(signal?: AbortSignal) { return read('/me/chat', c.chatResponseSchema, signal); },
        async sendChatMessage(input: z.input<typeof c.sendChatMessageRequestSchema>, signal?: AbortSignal) {
            return send('/me/chat/messages', c.chatMessageSchema, c.sendChatMessageRequestSchema.strict().parse(input), signal);
        },
        async markChatRead(input: z.input<typeof c.readChatRequestSchema>, signal?: AbortSignal) {
            return empty('/me/chat/read', c.readChatRequestSchema.strict().parse(input), signal);
        },
        async loadTeacherConversations(signal?: AbortSignal) {
            return read('/teacher/chat/conversations', teacherConversationsResponseSchema, signal);
        },
        async loadTeacherChat(studentId: number, signal?: AbortSignal) {
            return read(`/teacher/chat/conversations/${id.parse(studentId)}`, c.chatResponseSchema, signal);
        },
        async sendTeacherChatMessage(studentId: number, input: z.input<typeof c.sendChatMessageRequestSchema>, signal?: AbortSignal) {
            return send(`/teacher/chat/conversations/${id.parse(studentId)}/messages`, c.chatMessageSchema,
                c.sendChatMessageRequestSchema.strict().parse(input), signal);
        },
        async markTeacherChatRead(input: z.input<typeof c.readChatRequestSchema>, signal?: AbortSignal) {
            return empty('/teacher/chat/read', c.readChatRequestSchema.strict().parse(input), signal);
        },
        async loadPhotoMessages(signal?: AbortSignal) { return read('/me/photo-messages', c.photoMessagesResponseSchema, signal); },
        async loadTeacherPhotoMessages(signal?: AbortSignal) { return read('/teacher/photo-messages', c.photoMessagesResponseSchema, signal); },
        async markPhotoViewed(photoId: string, signal?: AbortSignal) {
            return empty(`/me/photo-messages/${encodedId(photoId)}/viewed`, c.viewedPhotoRequestSchema.parse({}), signal);
        },
        async schedulePhoto(input: z.input<typeof c.schedulePhotoRequestSchema>, signal?: AbortSignal) {
            return send('/teacher/photo-messages', schedulePhotoResponseSchema, c.schedulePhotoRequestSchema.strict().parse(input), signal);
        },
        async deletePhoto(photoId: string, signal?: AbortSignal) {
            return empty(`/teacher/photo-messages/${encodedId(photoId)}`, undefined, signal, 'DELETE');
        },
    };
}
