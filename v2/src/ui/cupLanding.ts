/**
 * Where the mascot comes to rest once it stops being a character and becomes
 * part of the background.
 *
 * Shared, because two screens have to agree on it to the pixel: the welcome
 * screen animates the cup to this point and the home screen draws it there,
 * and the swap between them happens while both are on screen. A few pixels out
 * and the landing reads as a jump.
 *
 * Measured from the bottom-left corner of the app frame, so it holds on any
 * phone width without being re-tuned.
 */
export const CUP_LANDING = {
    /** Rendered height of the landed shape, in px. */
    height: 366,
    rotate: 80,
    opacity: 0.22,
    /** Centre of the landed shape, in px from the frame's left and bottom. */
    centreX: 108,
    centreY: 118,
};

/** The landed shape, centred on the landing point. */
export const landedTransform = `translate(-50%, -50%) rotate(${CUP_LANDING.rotate}deg)`;
