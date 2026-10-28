"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="estate-panel">
      <h1 className="text-xl font-bold">
        Os imóveis estão temporariamente indisponíveis
      </h1>
      <p className="my-4 text-zinc-600">
        Tente novamente em instantes. Se persistir, entre em contato com a
        Alilu.
      </p>
      <button className="estate-button" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
