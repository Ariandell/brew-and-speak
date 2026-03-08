import React, { useEffect, useRef } from 'react';

interface MascotVideoProps {
    src: string;
    isChromaKey?: boolean; // Set to true if the video has a solid #00FF00 background
    loop?: boolean;
    width?: number;
    height?: number;
}

export const MascotVideo: React.FC<MascotVideoProps> = ({
    src,
    isChromaKey = false,
    loop = true,
    width = 200,
    height = 200
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!isChromaKey || !videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        let animationFrameId: number;

        const renderLoop = () => {
            if (video.paused || video.ended) {
                animationFrameId = requestAnimationFrame(renderLoop);
                return;
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const l = frame.data.length / 4;

            for (let i = 0; i < l; i++) {
                const r = frame.data[i * 4 + 0];
                const g = frame.data[i * 4 + 1];
                const b = frame.data[i * 4 + 2];

                // Simple Chroma Key: if green is significantly higher than red/blue, make transparent
                if (g > 100 && g > r * 1.5 && g > b * 1.5) {
                    frame.data[i * 4 + 3] = 0; // Set Alpha to 0
                }
            }
            ctx.putImageData(frame, 0, 0);

            animationFrameId = requestAnimationFrame(renderLoop);
        };

        video.addEventListener('play', () => {
            animationFrameId = requestAnimationFrame(renderLoop);
        });

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [isChromaKey]);

    return (
        <div style={{ position: 'relative', width, height, margin: '0 auto' }}>
            {/* Hidden original video, used as source for canvas if chromaKey is active */}
            <video
                ref={videoRef}
                src={src}
                autoPlay
                muted
                loop={loop}
                playsInline
                crossOrigin="anonymous"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: isChromaKey ? 'none' : 'block'
                }}
            />

            {/* Visible canvas showing the background-removed version */}
            {isChromaKey && (
                <canvas
                    ref={canvasRef}
                    width={width}
                    height={height}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
            )}
        </div>
    );
};
