/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react";

type Partner = {
  original_url: string;
  last_synced_at: string;
  name: string;
  trade_name: string;
  logo_url: string;
  partner_type: string;
};

/** Bloco discreto do anúncio de parceiro: origem, responsável e link para o anúncio original. */
export function PartnerSource({
  propertyId,
  partner,
  available,
}: {
  propertyId: string;
  partner: Partner;
  available: boolean;
}) {
  const name = partner.trade_name || partner.name;
  return (
    <div className="space-y-3 rounded-xl bg-brand-primary-soft p-4" data-partner-listing>
      <div className="flex items-center gap-3">
        {partner.logo_url && (
          <img
            src={partner.logo_url}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-lg bg-white object-contain"
          />
        )}
        <div>
          <p className="text-xs uppercase tracking-wider text-zinc-500">
            Anúncio de parceiro
          </p>
          <p className="font-semibold text-brand-primary">{name}</p>
        </div>
      </div>
      {available && partner.original_url && (
        <a
          href={`/imoveis/saida/${propertyId}`}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="estate-button secondary w-full"
        >
          <ExternalLink size={16} aria-hidden /> Ver anúncio original
        </a>
      )}
      <p className="text-xs text-zinc-500">
        A negociação é feita diretamente com {name}. A Alilu apenas divulga o
        anúncio e não participa da corretagem.
      </p>
    </div>
  );
}
