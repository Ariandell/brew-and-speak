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
 * The accent plane rests across the bottom here, so the greeting sits on paper
 * in ink and only the action at the foot falls on blue. The entrance is
 * staggered against the plane: the top is uncovered first and can come in
 * straight away, the foot has to wait for the plane to arrive.
 */
export const Home = ({ onBack }: Props) => (
    <Screen>
        <Backdrop />

        <div className="relative z-50 flex flex-grow flex-col px-6 pb-10 pt-14">
            <div className="animate-rise" style={{ animationDelay: '120ms' }}>
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-blue">Сьогодні</p>
                <h1 className="mt-1 text-[34px] font-extrabold leading-none tracking-tight text-ink">Привіт</h1>
            </div>

            <Card level={3} className="animate-rise mt-8 p-6" style={{ animationDelay: '200ms' }}>
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-blue">Далі</p>
                <h2 className="mt-2 text-[22px] font-extrabold leading-tight tracking-tight text-ink">
                    Тут буде «що робити зараз»
                </h2>
                <p className="mt-2 text-[15px] font-medium leading-relaxed text-ink-soft">
                    Поточний урок, борг по ДЗ, серія днів і шлях курсу.
                </p>
            </Card>

            <div className="animate-rise mt-auto" style={{ animationDelay: '440ms' }}>
                <Button variant="ghost" onClick={onBack}>
                    Назад
                </Button>
            </div>
        </div>
    </Screen>
);
