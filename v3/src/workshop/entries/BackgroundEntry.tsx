/**
 * The scene on its own, with nothing over it.
 *
 * The canvas is mounted once by the workshop shell and lives behind every
 * entry, so judging it means looking at a screen with nothing to distract
 * from it. What to check here: whether the light has an irregular edge,
 * whether the gradients band, whether the grain reads as texture rather than
 * dirt, and whether the cup looks like it is *in* the water rather than
 * pasted over it.
 */
export const BackgroundEntry = () => (
    <div className="flex h-full flex-col justify-end p-6">
        <p className="max-w-[280px] text-[13px] leading-relaxed text-text-soft">
            Вода, бульбашки й стаканчик. Дивимось на край світла, на смуги в градієнті, на зерно —
            і чи стаканчик у воді, а не поверх неї.
        </p>
    </div>
);
