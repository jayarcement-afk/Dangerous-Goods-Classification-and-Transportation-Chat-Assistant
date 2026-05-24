import { UlButton } from "@/components/ui/ul-button";

export function CtaBand() {
  return (
    <section className="ul-hero-gradient py-16 text-white sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          Find out how DG Assistant can support your dangerous goods workflow
        </h2>
        <p className="mt-4 text-lg text-white/85">With regulatory rigor and the future in focus.</p>
        <div className="mt-8 flex justify-center">
          <UlButton href="/chat" variant="primary">
            Ask a question
          </UlButton>
        </div>
      </div>
    </section>
  );
}
