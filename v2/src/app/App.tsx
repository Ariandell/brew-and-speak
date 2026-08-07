import { useState } from 'react';
import { Welcome } from '../screens/welcome/Welcome';
import { Home } from '../screens/home/Home';
import { Curtain } from './Curtain';
import { useCurtain } from './useCurtain';

type ScreenName = 'welcome' | 'home';

/**
 * Where the accent slab comes to rest on each screen. It is the same element
 * throughout, so a screen does not get its own blue plane - it says where the
 * one blue plane should be, and the transition carries it there.
 */
const REST: Record<ScreenName, string> = {
    welcome: 'translate(24%, -22%) rotate(-12deg) scale(0.32)',
    home: 'translate(0%, -30%) rotate(-7deg) scale(1.06, 0.64)',
};

/**
 * Screens are wired here and nowhere else. A screen never decides what comes
 * after it - it reports the intent and this decides, so re-ordering the flow
 * touches one file.
 *
 * The page background lives here too. Screens paint no opaque backdrop of
 * their own, or they would cover the slab sitting behind them.
 */
export const App = () => {
    const [screen, setScreen] = useState<ScreenName>('welcome');
    const { phase, go } = useCurtain();

    return (
        <div className="relative mx-auto min-h-[100dvh] w-full max-w-[480px] overflow-hidden bg-paper">
            <Curtain phase={phase} rest={REST[screen]} />
            {screen === 'welcome' && <Welcome onStart={() => go(() => setScreen('home'))} />}
            {screen === 'home' && <Home onBack={() => go(() => setScreen('welcome'))} />}
        </div>
    );
};
