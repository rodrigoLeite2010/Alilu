import type { ReactNode } from "react";
import { BillingNoticeBar } from "@/components/billing/BillingNoticeBar";

/** Layout das telas do Instagram: só acrescenta a faixa de aviso de plano/limite no topo (some quando não há aviso). */
export default function InstagramLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="px-4 empty:hidden">
        <BillingNoticeBar />
      </div>
      {children}
    </>
  );
}
