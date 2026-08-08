import type { ReactNode } from 'react';
import { BackgroundEntry } from './entries/BackgroundEntry';

export interface Entry {
    id: string;
    label: string;
    /** Full-bleed entries get the whole viewport instead of a padded stage. */
    bleed?: boolean;
    render: () => ReactNode;
}

/**
 * Every component in the app, one per entry, shown on its own.
 *
 * The list is the build order. A component is not finished because it renders
 * - it is finished when every state it can be in is here and looks right, and
 * that is much easier to see when nothing else is on screen.
 */
export const ENTRIES: Entry[] = [
    { id: 'scene', label: 'Сцена', bleed: true, render: () => <BackgroundEntry /> },
];
