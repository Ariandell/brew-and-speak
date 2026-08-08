import { useState } from 'react';
import { Welcome } from '../screens/welcome/Welcome';
import { Home } from '../screens/home/Home';
import { Curtain } from './Curtain';
import { useCurtain } from './useCurtain';
import type { Anchor } from '../ui/cupLanding';

type ScreenName = 'welcome' | 'home';

/**
 * Where the accent planes come to rest on each screen. They are the same
 * elements throughout, so a screen does not get its own blue plane - it says
 * where the one stack should be, and the transition carries it there.
 *
 * Home rests in the bottom corner because that is where the mascot lands when
 * it turns into background. The plane has to be there to receive it, or the
 * white shape would end up on paper and simply not exist.
 */
const REST: Record<ScreenName, string> = {
    welcome: 'translate(24%, -22%) rotate(-12deg) scale(0.32)',
    home: 'translate(-24%, 33%) rotate(-16deg) scale(0.92, 0.56)',
};

/**
 * Screens are wired here and nowhere else. A screen never decides what comes
 * after it - it reports the intent and this decides, so re-ordering the flow
 * touches one file.
 *
 * The cup's home position is held here too. The welcome screen measures where
 * its mascot ended up and reports it; home needs that same point to send the
 * cup back along the path it arrived by. Neither screen can ask the other
 * directly - only one of them is mounted at a time.
 *
 * The page background lives here as well. Screens paint no opaque backdrop of
 * their own, or they would cover the planes sitting behind them.
 */
export const App = () => {
    const [screen, setScreen] = useState<ScreenName>('welcome');
    const [cupOrigin, setCupOrigin] = useState<Anchor>();
    const { phase, travelling, go } = useCurtain();
    const covering = phase === 'covering';

    return (
        <div className="relative mx-auto min-h-[100dvh] w-full max-w-[480px] overflow-hidden bg-paper">
            <Curtain phase={phase} rest={REST[screen]} />
            {screen === 'welcome' && (
                <Welcome
                    leaving={covering}
                    travelling={travelling}
                    onAnchor={setCupOrigin}
                    onStart={() => go(() => setScreen('home'))}
                />
            )}
            {screen === 'home' && (
                <Home leaving={covering} cupOrigin={cupOrigin} onBack={() => go(() => setScreen('welcome'))} />
            )}
        </div>
    );
};
