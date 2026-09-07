import { z } from 'zod';

export const vocabularyCardSchema = z.object({
    id: z.number().int().positive().safe(),
    front: z.string().trim().min(1).max(500),
    back: z.string().trim().min(1).max(2000),
});
export const vocabularySchema = z.object({
    revision: z.number().int().nonnegative(),
    items: z.array(vocabularyCardSchema).max(1000),
});
export type LessonVocabulary = z.infer<typeof vocabularySchema>;
export const generatedVocabularySchema = z.object({ items: z.array(vocabularyCardSchema.omit({ id: true })).min(1).max(40) });
