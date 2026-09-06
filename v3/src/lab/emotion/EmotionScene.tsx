import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import {
    Box3,
    Color,
    Group,
    MathUtils,
    Mesh,
    ShaderMaterial,
    NoToneMapping,
    SRGBColorSpace,
    Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { geometryWithArmMask } from './paintMasks';
import { POSE_URLS, type EmotionLabSettings, type FaceAxis } from './types';

const VERTEX_SHADER = `
attribute float aArmMask;

varying vec3 vLocalPosition;
varying vec3 vWorldNormal;
varying float vArmMask;

uniform vec3 uModelCentre;
uniform float uModelRadius;

void main() {
    vLocalPosition = (position - uModelCentre) / max(uModelRadius, 0.0001);
    vWorldNormal = normalize(normalMatrix * normal);
    vArmMask = aArmMask;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision highp float;

uniform vec3 uLid;
uniform vec3 uBody;
uniform vec3 uSleeveTop;
uniform vec3 uSleeveBottom;
uniform vec3 uFace;
uniform vec3 uShade;
uniform vec3 uRim;
uniform float uSleeveBottomAt;
uniform float uSleeveTopAt;
uniform float uLidAt;
uniform float uBandSoftness;
uniform float uPaintArmMask;
uniform float uSilhouette;
uniform float uFaceOpacity;
uniform float uFaceAxis;
uniform float uModelYaw;
uniform float uFaceUnit;
uniform float uFaceCentreY;
uniform float uEyeSeparation;
uniform vec2 uEyeSize;
uniform float uMouthVertexY;
uniform float uMouthWidth;
uniform float uMouthSag;
uniform float uMouthThickness;
uniform float uLight;
uniform float uAmbient;
uniform float uRimStrength;

varying vec3 vLocalPosition;
varying vec3 vWorldNormal;
varying float vArmMask;

const float FACE_EDGE = 0.013;
const float SLEEVE_RADIUS = 0.60;

void main() {
    vec3 normal = normalize(vWorldNormal);
    float y = clamp((vLocalPosition.y + 1.0) * 0.5, 0.0, 1.0);
    float soft = max(uBandSoftness, 0.002);
    float sleeveBand = smoothstep(uSleeveBottomAt - soft, uSleeveBottomAt + soft, y)
        * (1.0 - smoothstep(uSleeveTopAt - soft, uSleeveTopAt + soft, y));

    float faceAxisAngle = 0.0;
    float rawAngle = atan(vLocalPosition.x, vLocalPosition.z);

    if (uFaceAxis > 0.5 && uFaceAxis < 1.5) {
        faceAxisAngle = 3.14159265359;
    } else if (uFaceAxis > 1.5 && uFaceAxis < 2.5) {
        faceAxisAngle = 1.57079632679;
    } else if (uFaceAxis > 2.5) {
        faceAxisAngle = -1.57079632679;
    }

    /* Generated poses do not share one authored front direction. The lab's
       yaw is therefore calibration, not a physical turn of an already-painted
       cup. Counter it here so the procedural face stays on the sleeve surface
       that faces the camera. Auto-rotation remains physical because its live
       angle is deliberately not included in this uniform. */
    float angle = atan(
        sin(rawAngle - faceAxisAngle + uModelYaw),
        cos(rawAngle - faceAxisAngle + uModelYaw)
    );
    float front = cos(angle);

    float arm = clamp(vArmMask, 0.0, 1.0);
    float paintedArm = arm * uPaintArmMask;

    float sleeve = max(sleeveBand, paintedArm);
    float lid = smoothstep(uLidAt - soft, uLidAt + soft, y) * (1.0 - paintedArm);
    float sleeveMix = clamp((y - uSleeveBottomAt) / max(uSleeveTopAt - uSleeveBottomAt, 0.001), 0.0, 1.0);
    vec3 sleeveColour = mix(uSleeveBottom, uSleeveTop, sleeveMix);
    vec3 albedo = mix(uBody, sleeveColour, sleeve);
    albedo = mix(albedo, uLid, lid);

    /* This is the same measured face used by the current production cup: two
       exact ellipses and a circular arc with round caps. It stays crisp at any
       resolution and every number interpolates cleanly between emotions. */
    vec2 facePoint = vec2(angle * SLEEVE_RADIUS, vLocalPosition.y - uFaceCentreY)
        / max(uFaceUnit, 0.0001);
    vec2 eye = vec2(abs(facePoint.x) - uEyeSeparation, facePoint.y)
        / max(uEyeSize, vec2(0.0001));
    float ink = 1.0 - smoothstep(
        1.0 - FACE_EDGE / max(uEyeSize.x, 0.0001),
        1.0 + FACE_EDGE / max(uEyeSize.x, 0.0001),
        length(eye)
    );

    float signedSag = uMouthSag >= 0.0 ? max(uMouthSag, 0.004) : min(uMouthSag, -0.004);
    float bend = signedSag >= 0.0 ? 1.0 : -1.0;
    float mouthRadius = (uMouthWidth * uMouthWidth + signedSag * signedSag)
        / (2.0 * abs(signedSag));
    vec2 mouthCentre = vec2(0.0, uMouthVertexY + bend * mouthRadius);
    float halfSpan = asin(clamp(uMouthWidth / mouthRadius, 0.0, 1.0));
    vec2 mouthDelta = facePoint - mouthCentre;
    float along = atan(mouthDelta.x, -bend * mouthDelta.y);
    float toStroke;
    if (abs(along) <= halfSpan) {
        toStroke = abs(length(mouthDelta) - mouthRadius);
    } else {
        vec2 cap = mouthCentre + mouthRadius * vec2(
            sign(mouthDelta.x) * sin(halfSpan),
            -bend * cos(halfSpan)
        );
        toStroke = length(facePoint - cap);
    }
    ink = max(ink, 1.0 - smoothstep(
        uMouthThickness - FACE_EDGE,
        uMouthThickness + FACE_EDGE,
        toStroke
    ));

    /* Only the central sleeve wall may receive a face. A foreground palm can
       cover an eye, but the eye can never be projected onto that palm. */
    float faceSurface = sleeveBand * (1.0 - arm);
    albedo = mix(albedo, uFace, ink * smoothstep(0.20, 0.55, front) * faceSurface * uFaceOpacity);

    vec3 keyDirection = normalize(vec3(-0.46, 0.72, 0.54));
    float wrapped = clamp((dot(normal, keyDirection) + 0.42) / 1.42, 0.0, 1.0);
    vec3 shaded = albedo * (uAmbient + wrapped * uLight);
    shaded += albedo * pow(max(dot(normal, keyDirection), 0.0), 3.0) * 0.14;
    shaded += uRim * pow(1.0 - max(normal.z, 0.0), 3.5) * uRimStrength;
    shaded = mix(shaded, uShade, clamp((0.30 - vLocalPosition.y) * 0.12, 0.0, 0.26));
    vec3 colour = mix(shaded, vec3(1.0), uSilhouette);

    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
`;

const axisNumber = (axis: FaceAxis) => ({ '+z': 0, '-z': 1, '+x': 2, '-x': 3 })[axis];

const setColour = (uniform: { value: Color }, value: string) => uniform.value.set(value);

interface ModelProps {
    settings: EmotionLabSettings;
}

const EmotionModel = ({ settings }: ModelProps) => {
    const gltf = useLoader(GLTFLoader, POSE_URLS[settings.pose]);
    const group = useRef<Group>(null);
    const { invalidate } = useThree();

    const bounds = useMemo(() => {
        const box = new Box3().setFromObject(gltf.scene);
        const size = box.getSize(new Vector3());
        const centre = box.getCenter(new Vector3());
        const radius = Math.max(size.x, size.y, size.z) * 0.5;
        return { centre, radius };
    }, [gltf.scene]);

    const material = useMemo(
        () =>
            new ShaderMaterial({
                vertexShader: VERTEX_SHADER,
                fragmentShader: FRAGMENT_SHADER,
                uniforms: {
                    uModelCentre: { value: bounds.centre.clone() },
                    uModelRadius: { value: bounds.radius },
                    uLid: { value: new Color() },
                    uBody: { value: new Color() },
                    uSleeveTop: { value: new Color() },
                    uSleeveBottom: { value: new Color() },
                    uFace: { value: new Color() },
                    uShade: { value: new Color() },
                    uRim: { value: new Color() },
                    uSleeveBottomAt: { value: 0 },
                    uSleeveTopAt: { value: 0 },
                    uLidAt: { value: 0 },
                    uBandSoftness: { value: 0 },
                    uPaintArmMask: { value: 1 },
                    uSilhouette: { value: 0 },
                    uFaceOpacity: { value: 1 },
                    uFaceAxis: { value: 0 },
                    uModelYaw: { value: 0 },
                    uFaceUnit: { value: 0 },
                    uFaceCentreY: { value: 0 },
                    uEyeSeparation: { value: 0 },
                    uEyeSize: { value: [0, 0] },
                    uMouthVertexY: { value: 0 },
                    uMouthWidth: { value: 0 },
                    uMouthSag: { value: 0 },
                    uMouthThickness: { value: 0 },
                    uLight: { value: 0 },
                    uAmbient: { value: 0 },
                    uRimStrength: { value: 0 },
                },
            }),
        [bounds.centre, bounds.radius],
    );

    const model = useMemo(() => {
        const clone = gltf.scene.clone(true);
        clone.traverse(object => {
            if (object instanceof Mesh) {
                object.geometry = geometryWithArmMask(object.geometry, settings.pose);
                object.material = material;
            }
        });
        return clone;
    }, [gltf.scene, material, settings.pose]);

    useEffect(
        () => () => {
            model.traverse(object => {
                if (object instanceof Mesh) object.geometry.dispose();
            });
            material.dispose();
        },
        [material, model],
    );

    useEffect(() => {
        const { uniforms } = material;
        setColour(uniforms.uLid, settings.colours.lid);
        setColour(uniforms.uBody, settings.colours.body);
        setColour(uniforms.uSleeveTop, settings.colours.sleeveTop);
        setColour(uniforms.uSleeveBottom, settings.colours.sleeveBottom);
        setColour(uniforms.uFace, settings.colours.face);
        setColour(uniforms.uShade, settings.colours.shade);
        setColour(uniforms.uRim, settings.colours.rim);
        uniforms.uSleeveBottomAt.value = settings.bands.sleeveBottom;
        uniforms.uSleeveTopAt.value = settings.bands.sleeveTop;
        uniforms.uLidAt.value = settings.bands.lidStart;
        uniforms.uBandSoftness.value = settings.bands.softness;
        uniforms.uPaintArmMask.value = settings.pose === 'wait' ? 0 : 1;
        uniforms.uSilhouette.value = settings.silhouette ? 1 : 0;
        uniforms.uFaceOpacity.value = settings.face.opacity;
        uniforms.uFaceAxis.value = axisNumber(settings.faceAxis);
        uniforms.uModelYaw.value = MathUtils.degToRad(settings.render.yaw);
        uniforms.uFaceUnit.value = settings.face.unit;
        uniforms.uFaceCentreY.value = settings.face.centreY;
        uniforms.uEyeSeparation.value = settings.face.eyeSeparation;
        uniforms.uEyeSize.value = [settings.face.eyeWidth, settings.face.eyeHeight];
        uniforms.uMouthVertexY.value = settings.face.mouthVertexY;
        uniforms.uMouthWidth.value = settings.face.mouthWidth;
        uniforms.uMouthSag.value = settings.face.mouthSag;
        uniforms.uMouthThickness.value = settings.face.mouthThickness;
        uniforms.uLight.value = settings.render.light;
        uniforms.uAmbient.value = settings.render.ambient;
        uniforms.uRimStrength.value = settings.render.rim;
        invalidate();
    }, [invalidate, material, settings]);

    useFrame((state, delta) => {
        if (!group.current || !settings.autoRotate) return;
        group.current.rotation.y += delta * 0.28;
        state.invalidate();
    });

    return (
        <group
            ref={group}
            scale={settings.render.scale}
            rotation={[
                MathUtils.degToRad(settings.render.pitch),
                MathUtils.degToRad(settings.render.yaw),
                MathUtils.degToRad(settings.render.roll),
            ]}
        >
            <group position={[-bounds.centre.x, -bounds.centre.y, -bounds.centre.z]}>
                <primitive object={model} />
            </group>
        </group>
    );
};

interface Props {
    settings: EmotionLabSettings;
}

export const EmotionScene = ({ settings }: Props) => (
    <div
        className="relative h-full min-h-[420px] overflow-hidden"
        style={{
            backgroundColor: settings.colours.background,
            backgroundImage: `radial-gradient(circle at 32% 24%, #ffffffcc, transparent 34%), radial-gradient(circle at 70% 78%, ${settings.colours.rim}66, transparent 40%)`,
        }}
    >
        <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" />
        <Canvas
            frameloop={settings.autoRotate ? 'always' : 'demand'}
            dpr={[1, 1.75]}
            camera={{ fov: 32, near: 0.1, far: 30, position: [0, 0, 4.2] }}
            gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
            onCreated={({ gl }) => {
                gl.toneMapping = NoToneMapping;
                gl.outputColorSpace = SRGBColorSpace;
            }}
        >
            <Suspense fallback={null}>
                <EmotionModel key={settings.pose} settings={settings} />
            </Suspense>
        </Canvas>
        <div className="pointer-events-none absolute inset-x-[23%] bottom-[8%] h-8 rounded-[50%] bg-[#16213d]/15 blur-xl" />
        <div className="pointer-events-none absolute left-5 top-5 rounded-pill border border-white/60 bg-white/70 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#27304b] shadow-sm">
            {settings.pose} · {settings.facePreset}
        </div>
    </div>
);
