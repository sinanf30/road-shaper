import { GLOSSARY } from "@/poker/glossary";

export function GlossaryList() {
  return (
    <dl className="space-y-3">
      {GLOSSARY.map((t) => (
        <div key={t.term}>
          <dt className="font-semibold text-amber-200">{t.term}</dt>
          <dd className="text-sm text-zinc-300">
            <span className="text-zinc-100">{t.short}.</span> {t.long}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function GlossaryOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-2xl rounded-xl border border-white/15 bg-[#101c16] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-amber-300">
            Poker-Begriffe einfach erklärt
          </h2>
          <button
            onClick={onClose}
            className="rounded-md border border-white/20 px-3 py-1 text-sm hover:bg-white/10"
          >
            Schließen
          </button>
        </div>
        <GlossaryList />
      </div>
    </div>
  );
}
