import { HAPPY, SAD, SURPRISED, type FaceShape } from '../../lib/cup';
import celebratePoseUrl from './assets/pose_celebrate.glb?url';
import neutralPoseUrl from './assets/pose_neutral.glb?url';
import presentPoseUrl from './assets/pose_present.glb?url';
import waitPoseUrl from './assets/pose_wait.glb?url';
import wavePoseUrl from './assets/pose_wave.glb?url';

export type EmotionPose = 'neutral' | 'wave' | 'present' | 'celebrate' | 'wait';
export type FacePreset = 'happy' | 'neutral' | 'sad' | 'surprised' | 'focused' | 'blank';
export type FaceAxis = '+z' | '-z' | '+x' | '-x';

export interface LabFaceShape {
    opacity: number;
    unit: number;
    centreY: number;
    eyeSeparation: number;
    eyeWidth: number;
    eyeHeight: number;
    mouthVertexY: number;
    mouthWidth: number;
    mouthSag: number;
    mouthThickness: number;
}

export interface EmotionLabSettings {
    pose: EmotionPose;
    facePreset: FacePreset;
    faceAxis: FaceAxis;
    silhouette: boolean;
    autoRotate: boolean;
    colours: {
        background: string;
        lid: string;
        body: string;
        sleeveTop: string;
        sleeveBottom: string;
        face: string;
        shade: string;
        rim: string;
    };
    bands: {
        sleeveBottom: number;
        sleeveTop: number;
        lidStart: number;
        softness: number;
    };
    face: LabFaceShape;
    render: {
        yaw: number;
        pitch: number;
        roll: number;
        scale: number;
        light: number;
        ambient: number;
        rim: number;
    };
}

/* The generated pose cups are about 22% wider in canonical model space than
   the current production cup. This preserves the face-to-cup ratio users
   already recognise instead of blindly copying raw shader units. */
const GENERATED_MODEL_FACE_SCALE = 1.22;

const fromProductionFace = (face: FaceShape): LabFaceShape => ({
    opacity: 1,
    unit: face.unit * GENERATED_MODEL_FACE_SCALE,
    centreY: face.centreY - 0.05,
    eyeSeparation: face.eyeSeparation,
    eyeWidth: face.eyeRadius[0],
    eyeHeight: face.eyeRadius[1],
    mouthVertexY: face.mouth[0],
    mouthWidth: face.mouth[1],
    mouthSag: face.mouth[2],
    mouthThickness: face.mouth[3],
});

/* The visual reference uses a bold, friendly ink treatment: vertical eyes and
   a filled-looking crescent rather than a hairline smile. Keep the production
   arc mathematics, but author the stroke weight from that reference. */
const REFERENCE_HAPPY: LabFaceShape = {
    ...fromProductionFace(HAPPY),
    eyeHeight: 0.205,
    mouthWidth: 0.39,
    mouthSag: 0.19,
    mouthThickness: 0.105,
};

export const DEFAULT_LAB_SETTINGS: EmotionLabSettings = {
    pose: 'neutral',
    facePreset: 'happy',
    faceAxis: '+z',
    silhouette: false,
    autoRotate: false,
    colours: {
        background: '#dbe9f7',
        lid: '#e7e5e2',
        body: '#f1efec',
        sleeveTop: '#6e58cc',
        sleeveBottom: '#7b44c2',
        face: '#241634',
        shade: '#8795b5',
        rim: '#d7e5ff',
    },
    bands: {
        sleeveBottom: 0.25,
        sleeveTop: 0.68,
        lidStart: 0.76,
        softness: 0.006,
    },
    face: REFERENCE_HAPPY,
    render: {
        yaw: 0,
        pitch: 0,
        roll: 0,
        scale: 0.94,
        light: 0.62,
        ambient: 0.5,
        rim: 0.38,
    },
};

export const POSE_URLS: Record<EmotionPose, string> = {
    neutral: neutralPoseUrl,
    wave: wavePoseUrl,
    present: presentPoseUrl,
    celebrate: celebratePoseUrl,
    wait: waitPoseUrl,
};

export const FACE_PRESETS: Record<FacePreset, Partial<LabFaceShape>> = {
    happy: REFERENCE_HAPPY,
    surprised: {
        ...fromProductionFace(SURPRISED),
        eyeHeight: 0.245,
        mouthWidth: 0.2,
        mouthSag: 0.2,
        mouthThickness: 0.085,
    },
    sad: {
        ...fromProductionFace(SAD),
        eyeHeight: 0.16,
        mouthWidth: 0.37,
        mouthSag: -0.15,
        mouthThickness: 0.08,
    },
    neutral: {
        ...fromProductionFace(HAPPY),
        eyeWidth: 0.15,
        eyeHeight: 0.15,
        mouthVertexY: -0.43,
        mouthWidth: 0.31,
        mouthSag: 0.004,
        mouthThickness: 0.055,
    },
    focused: {
        ...fromProductionFace(HAPPY),
        eyeWidth: 0.17,
        eyeHeight: 0.085,
        mouthVertexY: -0.42,
        mouthWidth: 0.3,
        mouthSag: 0.05,
        mouthThickness: 0.06,
    },
    blank: { opacity: 0 },
};
