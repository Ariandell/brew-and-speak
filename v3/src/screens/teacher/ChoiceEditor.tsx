import { Button, inputClass } from '../../ui/ProductUI';

/** Keep answer selection attached when an option's wording is edited. */
export const ChoiceEditor = ({ options, correct, onChange }: {
    options: string[]; correct: string; onChange: (options: string[], correct: string) => void;
}) => <div className="space-y-3">
    <p className="text-sm font-bold">Варіанти відповіді — познач правильний</p>
    {options.map((option, index) => <div key={index} className="flex items-center gap-2">
        <button type="button" aria-label={`Правильна відповідь ${index + 1}`} aria-pressed={!!option && option === correct}
            onClick={() => onChange(options, option)} className={`h-11 w-11 shrink-0 rounded-full border ${option && option === correct ? 'bg-accent text-white' : 'bg-white'}`}>
            {option && option === correct ? '✓' : '○'}
        </button>
        <input aria-label={`Варіант ${index + 1}`} placeholder={`Варіант ${index + 1}`} value={option} className={`${inputClass} min-w-0 flex-1`}
            onChange={event => onChange(options.map((item, i) => i === index ? event.target.value : item), option === correct ? event.target.value : correct)} />
        <button type="button" disabled={options.length <= 2} aria-label={`Видалити варіант ${index + 1}`} className="h-11 w-8 text-alert disabled:opacity-30"
            onClick={() => onChange(options.filter((_, i) => i !== index), option === correct ? '' : correct)}>×</button>
    </div>)}
    <Button tone="secondary" onClick={() => onChange([...options, ''], correct)}>+ Ще варіант</Button>
</div>;
