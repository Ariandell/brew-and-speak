/**
 * The background on its own, with nothing over it.
 *
 * Deliberately empty: the canvas is mounted once by the workshop shell and
 * lives behind every entry, so judging it means looking at a screen with
 * nothing to distract from it. What to check here is whether the light has an
 * irregular edge, whether the gradients band, and whether the grain reads as
 * texture rather than as dirt.
 */
export const BackgroundEntry = () => (
    <div className="flex min-h-full items-end p-6">
        <p className="max-w-[280px] text-[13px] leading-relaxed text-text-soft">
            Нічого поверх фону. Дивимось на край світла, на смуги в градієнті й на зерно.
        </p>
    </div>
);
