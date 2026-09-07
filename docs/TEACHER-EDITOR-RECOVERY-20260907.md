# Teacher editor recovery — 2026-09-07

## Restored workflow

- Teacher dashboard → Courses → lesson editor; dashboard also labels the dictionary/cards entry explicitly.
- Visible block-type buttons, individual quiz options with correct-answer selection, paired matching fields, and one sentence field for word ordering.
- Rich-text selection survives toolbar use. Plain-text newlines and contentEditable div boundaries survive sanitization and rendering. Pasted bold/italic/underline styles become semantic tags.
- Preview saves the current draft before navigating, instead of silently displaying older content.
- Lesson vocabulary supports individual word/translation fields, multiline/tabular paste, and AI-generated drafts from the saved lesson. AI output requires review and explicit saving.

## Data preservation

Migration `v3-003-lesson-vocabulary` was applied to the existing Turso production database. It only creates the additive vocabulary table and migration receipt; legacy lessons, flashcards and progress were not rewritten.

Vocabulary overlays retain existing flashcard IDs. Removing a word hides it from the effective dictionary without deleting legacy records or review history. New cards are also supported for V3-only lessons. Optimistic revisions reject stale vocabulary updates. Teacher routes require verified teacher authentication.

The first V3 review now inherits the legacy SRS state instead of resetting its counters.

## Verification

- API regression tests, including vocabulary authorization, revision conflicts, retained progress, new card reviews, text paragraph preservation, and mocked AI-provider responses.
- Mobile-size production-composition browser test: author two formatted paragraphs, paste vocabulary, save, reload, open the actual preview route, then verify the student dictionary.
- Existing course/lesson CRUD, chat, homework, SRS, media and role-guard flows retained.

## Limits

Automated signed-user tests run against the local production composition and isolated SQLite, not real teacher/student production sessions. AI-provider behavior is mocked in tests; a real generation depends on the configured key/provider availability. Formatting already irreversibly removed from stored content cannot be invented; this fix preserves surviving paragraph/newline structure and future edits. Title/blocks and vocabulary remain separate API saves, with surfaced errors rather than a false success message if either fails.
