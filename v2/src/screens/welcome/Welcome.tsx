import { Screen } from '../../ui/Screen';
import { Panel } from '../../ui/Panel';
import { Button } from '../../ui/Button';
import { MonoNote } from '../../ui/MonoNote';
import { Mascot } from '../../ui/Mascot';
import { Backdrop } from './Backdrop';

interface Props {
    onStart: () => void;
}

/** First screen: title, mascot, one action. */
export const Welcome = ({ onStart }: Props) => (
    <Screen className="bg-sand">
        <Backdrop />

        <section className="relative z-20 flex flex-col px-6 pt-12">
            <div className="relative w-full">
                <h1 className="skew-plane -translate-x-2 text-[72px] font-black italic leading-none tracking-tighter text-paper drop-shadow-lg">
                    BREW
                </h1>
                <h1 className="skew-plane text-outline-light pointer-events-none absolute left-0 top-0 translate-x-1 translate-y-1 text-[72px] font-black italic leading-none opacity-50">
                    BREW
                </h1>
            </div>

            <div className="relative z-30 mt-[-10px] flex w-full justify-end">
                <Panel tilt="right" className="border-l-4 border-coral bg-ink px-4 py-2 shadow-xl">
                    <h2 className="text-[28px] font-extrabold italic leading-none tracking-tight text-paper">
                        YOUR ENGLISH
                    </h2>
                </Panel>
            </div>
        </section>

        <section className="relative z-30 mt-[-20px] flex flex-grow items-center justify-center">
            <div className="animate-float relative flex h-[300px] w-[300px] items-center justify-center">
                <Panel tilt="left" className="absolute h-[210px] w-[210px] -translate-x-5 translate-y-5 rounded-3xl bg-blue-deep opacity-80 mix-blend-multiply" />
                {/* The cup is the accent colour, so on the blue plane it needs
                    something light behind it or it reads as a silhouette. */}
                <Panel tilt="right" className="absolute z-0 h-[250px] w-[250px] border-4 border-blue-hot bg-paper shadow-2xl" />

                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <div className="h-px w-full bg-blue-hot/40" />
                    <div className="absolute h-full w-px bg-blue-hot/40" />
                </div>

                {/* `neutral` is the only pose exported large enough to stay sharp
                    at this size. Swap to `happy` once we have it at 3x. */}
                <Mascot
                    mood="neutral"
                    size={230}
                    className="relative z-20 drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-snappy hover:scale-110"
                />
            </div>
        </section>

        <section className="relative z-40 flex flex-col items-center justify-end px-6 pb-12 pt-8">
            <div className="relative mb-8 -skew-x-12 border-2 border-ink bg-paper px-4 py-2 shadow-[4px_4px_0_#0F1B33]">
                <div className="absolute -left-2 -top-2 h-2 w-2 bg-coral" />
                <p className="text-[14px] font-bold uppercase italic tracking-wider text-ink">
                    Вчи англійську зі смаком кави та літнім настроєм.
                </p>
            </div>

            <Button onClick={onStart} trailing="→">
                Почати навчання
            </Button>

            <div className="mt-6 flex w-full justify-between text-ink-soft/70">
                <MonoNote>// SYS_READY</MonoNote>
                <MonoNote>ENG_MODULE_01</MonoNote>
            </div>
        </section>
    </Screen>
);
