/** Quiet print-registration marks shared by full-bleed branded screens. */
export const RegistrationMarks = () => (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
        <span className="absolute left-3 top-3 h-3 w-px bg-text/25" />
        <span className="absolute left-3 top-3 h-px w-3 bg-text/25" />
        <span className="absolute right-3 top-3 h-3 w-px bg-text/25" />
        <span className="absolute right-3 top-3 h-px w-3 bg-text/25" />
        <span className="absolute bottom-3 left-3 h-3 w-px bg-text/25" />
        <span className="absolute bottom-3 left-3 h-px w-3 bg-text/25" />
        <span className="absolute bottom-3 right-3 h-3 w-px bg-text/25" />
        <span className="absolute bottom-3 right-3 h-px w-3 bg-text/25" />
    </div>
);
