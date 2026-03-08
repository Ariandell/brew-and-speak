import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoMessage {
    id: number;
    image_url: string;
    caption: string;
}

interface EnvelopeOverlayProps {
    messages: PhotoMessage[];
    onClose: () => void;
    onViewed: (id: number) => void;
}

const API = 'http://localhost:3000';

export const EnvelopeOverlay: React.FC<EnvelopeOverlayProps> = ({ messages, onClose, onViewed }) => {
    const [phase, setPhase] = useState<'envelope' | 'opening' | 'photo'>('envelope');
    const [currentIndex, setCurrentIndex] = useState(0);

    const current = messages[currentIndex];
    if (!current) return null;

    useEffect(() => {
        // Phase 1: Bounce in envelope -> wait 1s -> Phase 2: Opening
        if (phase === 'envelope') {
            const t = setTimeout(() => setPhase('opening'), 1000);
            return () => clearTimeout(t);
        }
        // Phase 2: Flap opens -> wait 0.8s -> Phase 3: Photo comes out
        if (phase === 'opening') {
            const t = setTimeout(() => setPhase('photo'), 800);
            return () => clearTimeout(t);
        }
    }, [phase, currentIndex]);

    const handleDismiss = () => {
        if (phase !== 'photo') return;

        onViewed(current.id);
        if (currentIndex < messages.length - 1) {
            setPhase('envelope');
            setCurrentIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleDismiss}
                style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(5px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    perspective: 1000,
                }}
            >
                {/* Envelope Container */}
                {phase !== 'photo' && (
                    <motion.div
                        initial={{ scale: 0, y: 100 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                        style={{
                            position: 'relative',
                            width: 300,
                            height: 200,
                        }}
                    >
                        {/* Inside/Back of Envelope */}
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#e2e8f0', // Light gray interior
                            borderRadius: '8px',
                        }} />

                        {/* The Photo peeking out */}
                        <motion.div
                            initial={{ y: 0 }}
                            animate={phase === 'opening' ? { y: -100 } : { y: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            style={{
                                position: 'absolute',
                                width: 260,
                                height: 160,
                                left: 20,
                                top: 20,
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                display: 'flex',
                                justifyContent: 'center',
                            }}
                        >
                            <img src={`${API}${current.image_url}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </motion.div>

                        {/* Front of Envelope (Triangle cut) */}
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            clipPath: 'polygon(0% 0%, 50% 50%, 100% 0%, 100% 100%, 0% 100%)',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        }} />

                        {/* Flap (Lid) */}
                        <motion.div
                            initial={{ rotateX: 0 }}
                            animate={{ rotateX: phase === 'opening' ? 180 : 0 }}
                            transition={{ duration: 0.6 }}
                            style={{
                                position: 'absolute',
                                width: '100%',
                                height: 120, // Height of the triangle
                                top: 0,
                                transformOrigin: 'top',
                                zIndex: phase === 'opening' ? -1 : 10,
                                backfaceVisibility: 'hidden',
                            }}
                        >
                            {/* Flap Graphic */}
                            <div style={{
                                width: '100%',
                                height: '100%',
                                backgroundColor: '#f8fafc',
                                clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
                                filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.1))',
                            }} />
                        </motion.div>
                    </motion.div>
                )}

                {/* Photo Display Phase */}
                <AnimatePresence>
                    {phase === 'photo' && (
                        <motion.div
                            initial={{ scale: 0.5, y: -50, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            transition={{ type: 'spring', damping: 15, stiffness: 150 }}
                            style={{
                                backgroundColor: '#fff',
                                padding: '15px 15px 25px 15px',
                                borderRadius: '12px',
                                maxWidth: '90%',
                                width: 400,
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}
                        >
                            <img
                                src={`${API}${current.image_url}`}
                                alt="Message"
                                style={{
                                    width: '100%',
                                    maxHeight: '60vh',
                                    objectFit: 'contain',
                                    borderRadius: '8px',
                                }}
                            />
                            {current.caption && (
                                <p style={{
                                    marginTop: '15px',
                                    fontSize: '1.1rem',
                                    fontWeight: 600,
                                    color: '#333',
                                    textAlign: 'center',
                                }}>{current.caption}</p>
                            )}
                            <p style={{
                                marginTop: '15px',
                                fontSize: '0.85rem',
                                color: '#94a3b8',
                                textAlign: 'center'
                            }}>Натисніть у будь-якому місці, щоб закрити</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </AnimatePresence>
    );
};
