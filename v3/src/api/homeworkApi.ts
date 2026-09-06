import { z } from 'zod';
import { ApiError, type ApiClient } from './client.js';
import { assetMetadataSchema, gradeHomeworkRequestSchema, homeworkListResponseSchema, homeworkSubmissionSchema,
    sandboxAssetUploadRequestSchema, submitHomeworkRequestSchema } from './contracts.js';
import { encodedId, resourceIdSchema } from './productWriteContracts.js';

export type SubmitHomeworkInput = z.input<typeof submitHomeworkRequestSchema> & { lessonId: number; file?: File };

/** This adapter never reads demo storage and never accepts a client user ID. */
export function createHomeworkApi(client: ApiClient, prefix = '') {
    async function upload(assetId: string, file: File, teacher = false, signal?: AbortSignal) {
        encodedId(assetId, 160);
        if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('Файл має бути непорожнім і не більшим за 20 МБ.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
        const digest = Array.from(hash, n => n.toString(16).padStart(2, '0')).join('');
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        const body = sandboxAssetUploadRequestSchema.parse({ assetId, fileName: file.name,
            mimeType: file.type, base64Data: btoa(binary) });
        const metadata = await client.request(`${prefix}/${teacher ? 'teacher' : 'me'}/assets`, assetMetadataSchema,
            { method: 'POST', body, signal });
        if (metadata.assetId !== assetId || metadata.sha256.toLowerCase() !== digest || metadata.bytes !== bytes.length || metadata.mimeType !== file.type) {
            throw new ApiError(200, 'API returned mismatched asset metadata');
        }
        return metadata;
    }
    return {
        upload,
        list: (teacher: boolean) => client.request(`${prefix}/${teacher ? 'teacher' : 'me'}/homework`, homeworkListResponseSchema),
        async grade(id: string, grade: number, teacherComment: string, signal?: AbortSignal) {
            return client.request(`${prefix}/teacher/homework/${encodedId(id)}/grade`, homeworkSubmissionSchema,
                { method: 'POST', body: gradeHomeworkRequestSchema.parse({ grade, teacherComment }), signal });
        },
        async download(id: string, signal?: AbortSignal) { return client.download(`${prefix}/assets/${encodedId(id, 160)}`, signal); },
        async submit(input: SubmitHomeworkInput, signal?: AbortSignal) {
            const { lessonId, file, ...request } = input;
            resourceIdSchema.parse(lessonId);
            const body = submitHomeworkRequestSchema.strict().parse(request);
            if (input.file) {
                if (body.assets.length >= 5) throw new Error('Homework supports at most five assets');
                // Stable ID across retries of this logical submission; changed content conflicts.
                const metadata = await upload(`${body.submissionId}-attachment`, input.file, false, signal);
                body.assets.push({ ...metadata, storageKey: metadata.assetId, fileName: input.file.name });
            }
            return client.request(`${prefix}/lessons/${lessonId}/homework`, homeworkSubmissionSchema,
                { method: 'POST', body: submitHomeworkRequestSchema.parse(body), signal });
        },
    };
}
