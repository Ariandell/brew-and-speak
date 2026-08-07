import { Screen } from '../../ui/Screen';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { MascotAnimated } from '../../ui/MascotAnimated';
import { Backdrop } from './Backdrop';

interface Props {
    onStart: () => void;
}

/**
 * First screen: mascot, name, one action.
 *
 * One centred column rather than a growing hero plus a fixed footer - split in
 * two, the growing half swallows the spare height and opens a hole above the
 * mascot on tall phones while the rest stays glued to the bottom.
 */
export const Welcome = ({ onStart }: Props) => (
    <Screen className="bg-paper">
        <Backdrop />

        <div className="relative z-10 flex flex-grow flex-col items-center justify-center px-6 py-8">
            <span className="animate-rise rounded-pill bg-blue-soft px-4 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-blue">
                Англійська з Ольгою
            </span>

            <Card
                level={3}
                className="animate-rise relative mt-7 flex h-[300px] w-[300px] max-w-full items-center justify-center rounded-xl"
                style={{ animationDelay: '80ms' }}
            >
                {/* Bounced light behind the cup, then its contact shadow. Both
                    sit under the mascot so neither can catch a tap. */}
                <div className="glow-blue pointer-events-none absolute inset-x-6 bottom-12 top-6" />
                <div className="contact-shadow pointer-events-none absolute bottom-7 h-9 w-[200px]" />

                <MascotAnimated mood="perfect" size={244} className="relative -mt-2" />
            </Card>

            <h1
                className="animate-rise mt-8 text-[40px] font-extrabold leading-none tracking-tight text-ink"
                style={{ animationDelay: '160ms' }}
            >
                Brew &amp; Speak
            </h1>

            <p
                className="animate-rise mt-3 max-w-[270px] text-center text-[16px] font-medium leading-relaxed text-ink-soft"
                style={{ animationDelay: '220ms' }}
            >
                Вчи англійську зі смаком кави та літнім настроєм
            </p>

            <div className="animate-rise mt-9 w-full" style={{ animationDelay: '280ms' }}>
                <Button onClick={onStart} trailing="→">
                    Почати навчання
                </Button>
            </div>
        </div>
    </Screen>
);
