import type { CoursePathResponse } from '../../../src/api/contracts.js';
import type { LegacyCoursePathRecord, LegacyUser } from '../legacy/repositories.js';

const isoOrNull = (value: string | null): string | null => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
};

const unlockReady = (value: string | null, now: number): boolean => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && timestamp <= now;
};

const homeworkState = (record: LegacyCoursePathRecord): 'none' | 'pending' | 'graded' => {
  if (!record.hasHomework) return 'none';
  if (record.homeworkGrade !== null || record.homeworkStatus === 'graded' || record.homeworkStatus === 'approved') {
    return 'graded';
  }
  return record.homeworkStatus ? 'pending' : 'none';
};

export const deriveCoursePath = (
  user: LegacyUser,
  records: readonly LegacyCoursePathRecord[],
  now = new Date(),
): CoursePathResponse => {
  const hasAnyProgress = records.some((record) => record.status !== null);
  const nowMs = now.getTime();

  return {
    courseId: user.enrolledCourseId ?? 0,
    items: records.map((record, index) => {
      let status: 'locked' | 'available' | 'completed' = 'locked';
      if (record.status === 'completed') {
        status = 'completed';
      } else if (record.status === 'unlocked' || (index === 0 && !hasAnyProgress)) {
        status = 'available';
      } else if (unlockReady(record.unlocksAt, nowMs)) {
        status = 'available';
      }

      if (user.role === 'teacher' && status === 'locked') status = 'available';

      return {
        lessonId: record.lessonId,
        title: record.title,
        order: record.order,
        status,
        unlocksAt: status === 'locked' ? isoOrNull(record.unlocksAt) : null,
        completedAt: isoOrNull(record.completedAt),
        score: record.score ?? null,
        homework: {
          status: homeworkState(record),
          hasHomework: record.hasHomework,
          grade: record.homeworkGrade,
        },
      };
    }),
  };
};
