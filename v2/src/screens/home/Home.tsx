import { Screen } from '../../ui/Screen';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Backdrop } from './Backdrop';

interface Props {
    onBack: () => void;
}

/**
 * Shell only. The frame and the background treatment are real - the content
 * lands in the next pass, once the layout is agreed.
 *
 * The entrance is staggered against the curtain rather than with it. Anything
 * drawn inside the header sits under the retracting slab, so it fades in as
 * the slab arrives (~400ms); anything below is already uncovered and can come
 * in straight away.
 */
export const Home = ({ onBack }: Props) => (
    <Screen>
        <Backdrop />

        <div className="relative z-10 flex flex-grow flex-col px-6 pb-10 pt-14">
            <div className="animate-rise" style={{ animationDelay: '400ms' }}>
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-paper/75">Сьогодні</p>
                <h1 className="mt-1 text-[34px] font-extrabold leading-none tracking-tight text-paper">Привіт</h1>
            </div>

            <Card level={3} className="animate-rise mt-auto p-6" style={{ animationDelay: '120ms' }}>
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-blue">Далі</p>
                <h2 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-ink">
                    Тут буде «що робити зараз»
                </h2>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink-soft">
                    Поточний урок, борг по ДЗ, серія днів і шлях курсу.
                </p>
            </Card>

            <div className="animate-rise mt-6" style={{ animationDelay: '180ms' }}>
                <Button variant="ghost" onClick={onBack}>
                    Назад
                </Button>
            </div>
        </div>
    </Screen>
);
