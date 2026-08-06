import { Mascot } from '../components/Mascot';

interface Props {
    onStart: () => void;
}

/**
 * First screen. Persona-styled: skewed planes, a hard offset shadow on the
 * action, and the mascot framed dead centre.
 */
export const Welcome = ({ onStart }: Props) => (
    <main className="relative mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col overflow-hidden bg-sand">

        {/* Background composition — decorative only, never catches a tap */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            <div className="bg-dots absolute inset-0" />

            {/* Blue slice across the top */}
            <div className="skew-plane absolute left-[-20%] top-[-10%] h-[60%] w-[150%] origin-top-left overflow-hidden bg-blue-hot shadow-2xl">
                <div className="moving-bar absolute bottom-4 left-0 h-px w-full bg-paper/30" />
                <div className="moving-bar absolute bottom-8 left-0 h-0.5 w-full bg-paper/20" style={{ animationDuration: '5s' }} />
            </div>

            {/* Paper slice under it, tilted the other way */}
            <div className="skew-plane-reverse absolute right-[-10%] top-[40%] h-[30%] w-[120%] bg-paper shadow-[0_-10px_30px_rgba(15,27,51,0.1)]" />

            {/* Coral hairline where the two planes meet */}
            <div className="skew-plane absolute left-[-10%] top-[38%] z-10 h-[15px] w-[120%] bg-coral" />

            <div className="absolute right-[5%] top-[10%] origin-right rotate-90 text-right font-mono text-[10px] tracking-widest text-paper/70">
                SYS.INIT // v.3.0<br />
                LOC: EN-UK // BREW
            </div>

            <div className="absolute bottom-[20%] left-[5%] flex gap-1">
                <div className="h-2 w-2 rounded-sm bg-blue-deep" />
                <div className="h-2 w-2 animate-pulse-fast rounded-sm bg-blue-hot" />
                <div className="h-2 w-2 rounded-sm border border-blue-hot" />
            </div>
        </div>

        {/* Title */}
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
                <div className="skew-plane-reverse border-l-4 border-coral bg-ink px-4 py-2 shadow-xl">
                    <h2 className="text-[28px] font-extrabold italic leading-none tracking-tight text-paper">
                        YOUR ENGLISH
                    </h2>
                </div>
            </div>
        </section>

        {/* Mascot */}
        <section className="relative z-30 mt-[-20px] flex flex-grow items-center justify-center">
            <div className="animate-float relative flex h-[300px] w-[300px] items-center justify-center">
                {/* Offset accent, sits behind and to one side */}
                <div className="skew-plane absolute h-[210px] w-[210px] -translate-x-5 translate-y-5 rounded-3xl bg-blue-deep opacity-80 mix-blend-multiply" />
                {/* The cup is the accent colour, so on a blue plane it needs
                    something light behind it or it reads as a silhouette. This
                    panel is what separates it - not the recolour. */}
                <div className="skew-plane-reverse absolute z-0 h-[250px] w-[250px] border-4 border-blue-hot bg-paper shadow-2xl" />

                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                    <div className="h-px w-full border-t border-dashed bg-blue-hot/40" />
                    <div className="absolute h-full w-px border-l border-dashed bg-blue-hot/40" />
                </div>

                <Mascot
                    mood="happy"
                    size={230}
                    className="relative z-20 drop-shadow-[0_20px_30px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-snappy hover:scale-110"
                />
            </div>
        </section>

        {/* Action */}
        <section className="relative z-40 flex flex-col items-center justify-end px-6 pb-12 pt-8">
            <div className="relative mb-8 -skew-x-12 border-2 border-ink bg-paper px-4 py-2 shadow-[4px_4px_0_#0F1B33]">
                <div className="absolute -left-2 -top-2 h-2 w-2 bg-coral" />
                <p className="text-[14px] font-bold uppercase italic tracking-wider text-ink">
                    Вчи англійську зі смаком кави та літнім настроєм.
                </p>
            </div>

            <button
                onClick={onStart}
                className="group relative flex h-[64px] w-full -skew-x-12 items-center justify-between overflow-hidden bg-blue-hot px-6 text-[22px] font-black uppercase italic text-paper shadow-[8px_8px_0_#0F1B33] transition-all duration-150 ease-out hover:-translate-y-1 hover:translate-x-1 hover:shadow-[12px_12px_0_#0F1B33] active:translate-x-2 active:translate-y-2 active:shadow-none"
            >
                <span className="glare absolute left-[-100%] top-0 h-full w-1/2 skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                <span className="relative z-10 tracking-widest drop-shadow-md">Почати навчання</span>
                <span className="relative z-10 flex h-10 w-10 skew-x-12 items-center justify-center rounded-full bg-paper text-[24px] font-bold text-blue-hot shadow-inner transition-transform duration-200 group-hover:rotate-45">
                    →
                </span>
            </button>

            <div className="mt-6 flex w-full justify-between font-mono text-[10px] uppercase text-ink-soft/70">
                <span>// SYS_READY</span>
                <span>ENG_MODULE_01</span>
            </div>
        </section>
    </main>
);
