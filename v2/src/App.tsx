import { Welcome } from './pages/Welcome';

export const App = () => (
    <Welcome onStart={() => console.log('start')} />
);
