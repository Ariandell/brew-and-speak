import { MASCOT_CLIPS } from '../types/mascot';

const RATIO = MASCOT_CLIPS.perfect!.ratio;
const LANDED_HEIGHT = 366;

/**
 * Where the mascot comes to rest once it stops being a character and becomes
 * part of the background.
 *
 * Shared, because two screens have to agree on it to the pixel: one animates
 * the cup to this point, the other draws it there, and the swap between them
 * happens while both are on screen. A few pixels out and the landing reads as
 * a jump.
 *
 * Measured from the bottom-left corner of the app frame, so it holds on any
 * phone width without being re-tuned.
 */
export const CUP_LANDING = {
    /** Rendered size of the landed shape, in px. */
    height: LANDED_HEIGHT,
    width: Math.round(LANDED_HEIGHT * RATIO),
    /** Rendered height of the cup while it is still a character. */
    heroHeight: 244,
    rotate: 180,
    /** Full strength. The shape is already pure white - anything less and the
     *  ground shows through and reads as grey. */
    opacity: 1,
    /** Centre of the landed shape, in px from the frame's left and bottom.
     *  High enough that the lid stays in frame - upside down and cropped at the
     *  lid, the shape stops reading as a cup and becomes a plain trapezoid. */
    centreX: 92,
    centreY: 196,
};

/**
 * A point inside the app frame, measured from its left and bottom edges.
 *
 * Bottom rather than top on purpose: the landing point is pinned to the bottom
 * corner, so both ends of the journey are described the same way and the two
 * directions are exact inverses of each other instead of two sets of numbers
 * that have to be kept in agreement.
 */
export interface Anchor {
    left: number;
    bottom: number;
}

export const LANDING_ANCHOR: Anchor = { left: CUP_LANDING.centreX, bottom: CUP_LANDING.centreY };

/** Pixels to travel from `from` to `to`, in screen coordinates. */
export const travel = (from: Anchor, to: Anchor) => ({
    dx: Math.round(to.left - from.left),
    dy: Math.round(from.bottom - to.bottom),
});
