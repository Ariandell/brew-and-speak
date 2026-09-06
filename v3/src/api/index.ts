export { ApiError, createApiClient } from './client';
export type { ApiClient, ApiClientOptions, InitDataProvider, RequestOptions } from './client';
export {
  apiErrorSchema,
  capabilitySchema,
  coursePathResponseSchema,
  homeworkStatusSchema,
  lessonBlockSchema,
  lessonResponseSchema,
  meResponseSchema,
  pagedResponseSchema,
  roleSchema,
  teacherCoursesResponseSchema,
  teacherLessonsResponseSchema,
} from './contracts';
export type {
  ApiErrorBody,
  Capability,
  CoursePathItem,
  CoursePathResponse,
  HomeworkStatus,
  LessonBlock,
  LessonResponse,
  MeResponse,
  Role,
  TeacherCourse,
  TeacherCoursesResponse,
  TeacherLessonSummary,
  TeacherLessonsResponse,
} from './contracts';
