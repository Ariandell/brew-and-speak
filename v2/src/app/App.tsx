import { Welcome } from '../screens/welcome/Welcome';

/**
 * Screens are wired here and nowhere else. A screen never decides what comes
 * after it - it reports the intent and this decides, so re-ordering the flow
 * touches one file.
 */
export const App = () => <Welcome onStart={() => console.log('start')} />;
