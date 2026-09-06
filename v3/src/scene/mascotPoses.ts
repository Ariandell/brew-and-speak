export type MascotPose = 'reference' | 'neutral' | 'wave' | 'present' | 'celebrate' | 'wait';
export const mascotPoseUrl = (pose: MascotPose): string | null => pose === 'reference' ? null : `/models/poses/${pose}.msh`;
