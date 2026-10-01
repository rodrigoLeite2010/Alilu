"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { analyzePackage, costBreakdown, economicsForCredits, formatBrl, retryCreditCost, suggestedCreditCost, worstCostPerCredit } from "@/lib/ai-video/pricing";
import { AI_VIDEO_TIER_LABEL, type AiCreditPackage, type AiPricingConfig, type AiVideoModelPricing } from "@/lib/ai-video/types";
import { readErrorMessage } from "../client-utils";

const CONFIG_FIELDS: { key: keyof AiPricingConfig; label: string; step: string; suffix?: string }[] = [
  { key: "targetGrossMarginPct", label: "Margem bruta alvo", step: "0.5", suffix: "%" },
  { key: "minimumGrossMarginPct", label: "Margem bruta mínima", step: "0.5", suffix: "%" },
  { key: "creditValueBrl", label: "Valor de venda de 1 crédito", step: "0.001", suffix: "R$" },
  { key: "usdBrlReferenceRate", label: "Câmbio de referência (US$ → R$)", step: "0.01", suffix: "R$" },
  { key: "providerCostSafetyMultiplier", label: "Multiplicador de segurança do custo", step: "0.01", suffix: "×" },
  { key: "paymentFeePct", label: "Taxa de pagamento (Asaas)", step: "0.1", suffix: "%" },
  { key: "taxPct", label: "Impostos", step: "0.1", suffix: "%" },
  { key: "infraCostBrlPerGeneration", label: "Infra/storage/retries por geração", step: "0.01", suffix: "R$" },
  { key: "welcomeBonusCredits", label: "Bônus de boas-vindas", step: "1", suffix: "créditos" },
  { key: "maxProviderCostUsd", label: "Custo máximo por geração", step: "0.01", suffix: "US$" },
  { key: "dailyProviderSpendLimitUsd", label: "Limite de gasto diário com o provedor", step: "1", suffix: "US$" },
  { key: "monthlyProviderSpendLimitUsd", label: "Limite de gasto mensal com o provedor", step: "1", suffix: "US$" },
  { key: "maxGenerationsPerUserPerHour", label: "Gerações por usuário por hora", step: "1" },
  { key: "moderationStrikesBeforeBlock", label: "Recusas de moderação antes do bloqueio", step: "1" },
  { key: "moderationBlockHours", label: "Horas de bloqueio por moderação", step: "1" },
  { key: "retentionDaysFree", label: "Retenção do vídeo (sem compra)", step: "1", suffix: "dias" },
  { key: "retentionDaysPaid", label: "Retenção do vídeo (com compra)", step: "1", suffix: "dias" },
  { key: "purchaseRefundWindowDays", label: "Prazo de reembolso de compra (mín. 7)", step: "1", suffix: "dias" },
  { key: "retryDiscountPct", label: "Desconto em “Gerar novamente” (nunca abaixo do custo)", step: "1", suffix: "%" },
  { key: "maxRetriesPerGeneration", label: "Regenerações com desconto por vídeo", step: "1" },
  { key: "postprocessCostBrl", label: "Custo do pós-processamento (só registro)", step: "0.01", suffix: "R$" },
  { key: "issueReviewThreshold", label: "Reportes em 30 dias para marcar revisão", step: "1" },
  { key: "maxConcurrentGenerationsPerUser", label: "Vídeos gerando ao mesmo tempo por usuário", step: "1" },
];

function pct(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "—";
}

export function AiPricingAdmin({
  config,
  models,
  packages,
  providers,
}: {
  config: AiPricingConfig;
  models: AiVideoModelPricing[];
  packages: AiCreditPackage[];
  providers: ProviderAccountDto[];
}) {
  const router = useRouter();
  const [configDraft, setConfigDraft] = useState<AiPricingConfig>(config);
  const [modelDrafts, setModelDrafts] = useState<AiVideoModelPricing[]>(models);
  const [packageDrafts, setPackageDrafts] = useState<AiCreditPackage[]>(packages);
  const [simulation, setSimulation] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const costPerCredit = useMemo(() => worstCostPerCredit(configDraft, modelDrafts), [configDraft, modelDrafts]);

  async function save(key: string, body: Record<string, unknown>) {
    setBusy(key);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/ai-video/pricing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response, "Não foi possível salvar."));
      setMessage({ tone: "ok", text: "Salvo." });
      router.refresh();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-10">
      {message ? (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${message.tone === "ok" ? "bg-teal-50 text-teal-800" : "bg-red-50 text-red-700"}`}>
          {message.text}
        </p>
      ) : null}

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Modelos e preço por geração</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Margem bruta sobre a venda, já descontando taxa de pagamento e impostos: (receita líquida − custo total) ÷ receita. Use
          “Simular” para ver a margem com outra quantidade de créditos antes de salvar.
        </p>
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full min-w-[1100px] text-left text-xs">
            <thead className="bg-zinc-50 uppercase text-zinc-500">
              <tr>
                <th className="px-2 py-2">Qualidade / modelo</th>
                <th className="px-2 py-2">Duração</th>
                <th className="px-2 py-2">Créd. provedor/s</th>
                <th className="px-2 py-2">Créd. fixos/vídeo</th>
                <th className="px-2 py-2">Custo API</th>
                <th className="px-2 py-2">Custo R$</th>
                <th className="px-2 py-2">Protegido</th>
                <th className="px-2 py-2">Custo total</th>
                <th className="px-2 py-2">Créditos Alilu</th>
                <th className="px-2 py-2">Preço comercial</th>
                <th className="px-2 py-2">Margem</th>
                <th className="px-2 py-2">Sugerido</th>
                <th className="px-2 py-2">Gerar novamente</th>
                <th className="px-2 py-2">Simular</th>
                <th className="px-2 py-2">Ativo</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {modelDrafts.map((row, index) => {
                const costs = costBreakdown(configDraft, row);
                const economics = economicsForCredits(configDraft, row, row.aliluCreditCost);
                const suggested = suggestedCreditCost(configDraft, row);
                const simulated = Number(simulation[row.id]);
                const simulatedEconomics = Number.isFinite(simulated) && simulated > 0 ? economicsForCredits(configDraft, row, simulated) : null;
                const below = economics.grossMarginPct < configDraft.minimumGrossMarginPct;
                return (
                  <tr key={row.id} className="border-t border-zinc-100 align-top">
                    <td className="px-2 py-2">
                      <span className="font-medium text-zinc-900">{AI_VIDEO_TIER_LABEL[row.tier]}</span>
                      <span className="block text-zinc-500">
                        {row.provider} · {row.providerModel} · {row.resolution}
                      </span>
                    </td>
                    <td className="px-2 py-2">{row.durationSeconds}s</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.1"
                        value={row.providerCreditsPerSecond}
                        onChange={(event) =>
                          setModelDrafts((list) => list.map((item, i) => (i === index ? { ...item, providerCreditsPerSecond: Number(event.target.value) } : item)))
                        }
                        className="w-16 rounded border border-zinc-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="1"
                        value={row.providerFixedCredits}
                        onChange={(event) =>
                          setModelDrafts((list) => list.map((item, i) => (i === index ? { ...item, providerFixedCredits: Number(event.target.value) } : item)))
                        }
                        className="w-16 rounded border border-zinc-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-2">US$ {costs.providerCostUsd.toFixed(3)}</td>
                    <td className="px-2 py-2">{formatBrl(costs.providerCostBrl)}</td>
                    <td className="px-2 py-2">{formatBrl(costs.protectedProviderCostBrl)}</td>
                    <td className="px-2 py-2">{formatBrl(costs.totalCostBrl)}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="5"
                        value={row.aliluCreditCost}
                        onChange={(event) =>
                          setModelDrafts((list) => list.map((item, i) => (i === index ? { ...item, aliluCreditCost: Math.round(Number(event.target.value)) } : item)))
                        }
                        className="w-20 rounded border border-zinc-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-2">{formatBrl(economics.revenueBrl)}</td>
                    <td className={`px-2 py-2 font-medium ${below ? "text-red-700" : "text-teal-800"}`}>{pct(economics.grossMarginPct)}</td>
                    <td className="px-2 py-2">{suggested ?? "—"}</td>
                    <td className="px-2 py-2">{retryCreditCost(configDraft, row)}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        placeholder="ex.: 80"
                        value={simulation[row.id] ?? ""}
                        onChange={(event) => setSimulation((map) => ({ ...map, [row.id]: event.target.value }))}
                        className="w-16 rounded border border-zinc-300 px-1 py-0.5"
                      />
                      {simulatedEconomics ? (
                        <span className="block text-zinc-600">
                          {pct(simulatedEconomics.grossMarginPct)} · lucro {formatBrl(simulatedEconomics.grossProfitBrl)}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={row.isActive}
                        onChange={(event) => setModelDrafts((list) => list.map((item, i) => (i === index ? { ...item, isActive: event.target.checked } : item)))}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          save(`model-${row.id}`, {
                            action: "model",
                            id: row.id,
                            aliluCreditCost: row.aliluCreditCost,
                            providerCreditsPerSecond: row.providerCreditsPerSecond,
                            providerFixedCredits: row.providerFixedCredits,
                            isActive: row.isActive,
                          })
                        }
                      >
                        Salvar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Pacotes de créditos</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Margem calculada no pior modelo ativo ({formatBrl(costPerCredit)} de custo por crédito). Pacote abaixo da margem
          mínima não pode ser ativado nem vendido.
        </p>
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-200">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-zinc-50 uppercase text-zinc-500">
              <tr>
                <th className="px-2 py-2">Pacote</th>
                <th className="px-2 py-2">Créditos</th>
                <th className="px-2 py-2">Bônus</th>
                <th className="px-2 py-2">Preço (R$)</th>
                <th className="px-2 py-2">R$/crédito</th>
                <th className="px-2 py-2">Margem</th>
                <th className="px-2 py-2">Preço mínimo</th>
                <th className="px-2 py-2">Ativo</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {packageDrafts.map((pkg, index) => {
                const analysis = analyzePackage(configDraft, pkg, costPerCredit);
                const update = (patch: Partial<AiCreditPackage>) =>
                  setPackageDrafts((list) => list.map((item, i) => (i === index ? { ...item, ...patch } : item)));
                return (
                  <tr key={pkg.id} className="border-t border-zinc-100">
                    <td className="px-2 py-2 font-medium text-zinc-900">{pkg.name}</td>
                    <td className="px-2 py-2">
                      <input type="number" value={pkg.credits} onChange={(event) => update({ credits: Math.round(Number(event.target.value)) })} className="w-20 rounded border border-zinc-300 px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-2">
                      <input type="number" value={pkg.bonusCredits} onChange={(event) => update({ bonusCredits: Math.round(Number(event.target.value)) })} className="w-16 rounded border border-zinc-300 px-1 py-0.5" />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        step="0.01"
                        value={(pkg.priceCents / 100).toFixed(2)}
                        onChange={(event) => update({ priceCents: Math.round(Number(event.target.value) * 100) })}
                        className="w-24 rounded border border-zinc-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-2">{formatBrl(analysis.pricePerCreditBrl)}</td>
                    <td className={`px-2 py-2 font-medium ${analysis.belowMinimum ? "text-red-700" : "text-teal-800"}`}>
                      {pct(analysis.worstCaseMarginPct)} {analysis.belowMinimum ? <Badge tone="warning">abaixo do mínimo</Badge> : null}
                    </td>
                    <td className="px-2 py-2">{analysis.minimumPriceBrl === null ? "—" : formatBrl(analysis.minimumPriceBrl)}</td>
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={pkg.isActive} onChange={(event) => update({ isActive: event.target.checked })} />
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() =>
                          save(`package-${pkg.id}`, {
                            action: "package",
                            id: pkg.id,
                            credits: pkg.credits,
                            bonusCredits: pkg.bonusCredits,
                            priceCents: pkg.priceCents,
                            isActive: pkg.isActive,
                          })
                        }
                      >
                        Salvar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Regra comercial</h2>
        <p className="mt-1 text-xs text-zinc-500">Salvar cria uma nova versão (o histórico fica no banco). As tabelas acima já mostram o efeito antes de salvar.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONFIG_FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-zinc-700">
                {field.label}
                {field.suffix ? <span className="text-zinc-400"> ({field.suffix})</span> : null}
              </span>
              <input
                type="number"
                step={field.step}
                value={String(configDraft[field.key])}
                onChange={(event) => setConfigDraft((draft) => ({ ...draft, [field.key]: Number(event.target.value) }))}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </label>
          ))}
        </div>
        <Button type="button" className="mt-4" disabled={busy !== null} onClick={() => save("config", { action: "config", ...configDraft })}>
          {busy === "config" ? "Salvando…" : "Salvar regra comercial"}
        </Button>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-zinc-900">Contas nos provedores</h2>
        <p className="mt-1 text-xs text-zinc-500">
          O Alilu paga cada provedor com saldo próprio (créditos comprados no portal de cada um, com recarga automática configurada
          lá). Atualize aqui o saldo que aparece no portal para receber o alerta de saldo baixo.
        </p>
        <div className="mt-3 space-y-4">
          {providers.map((account) => (
            <ProviderAccountCard key={account.provider} account={account} busy={busy} save={save} />
          ))}
        </div>
      </section>
    </div>
  );
}

interface ProviderAccountDto {
  provider: string;
  currentEstimatedBalanceUsd: number | null;
  autoRechargeEnabled: boolean;
  lowBalanceThresholdUsd: number;
}

const PROVIDER_LABEL: Record<string, string> = { runway: "Runway (dev.runwayml.com)", fal: "fal.ai (fal.ai/dashboard)" };

function ProviderAccountCard({
  account,
  busy,
  save,
}: {
  account: ProviderAccountDto;
  busy: string | null;
  save: (key: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const [draft, setDraft] = useState({
    balance: account.currentEstimatedBalanceUsd === null ? "" : String(account.currentEstimatedBalanceUsd),
    threshold: String(account.lowBalanceThresholdUsd),
    autoRecharge: account.autoRechargeEnabled,
  });
  const key = `provider-${account.provider}`;
  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <p className="text-sm font-medium text-zinc-900">{PROVIDER_LABEL[account.provider] ?? account.provider}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-700">Saldo atual (US$)</span>
          <input value={draft.balance} onChange={(event) => setDraft((d) => ({ ...d, balance: event.target.value }))} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-700">Alertar abaixo de (US$)</span>
          <input value={draft.threshold} onChange={(event) => setDraft((d) => ({ ...d, threshold: event.target.value }))} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 pt-6 text-sm text-zinc-700">
          <input type="checkbox" checked={draft.autoRecharge} onChange={(event) => setDraft((d) => ({ ...d, autoRecharge: event.target.checked }))} />
          Recarga automática ligada no portal
        </label>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="mt-3"
        disabled={busy !== null}
        onClick={() =>
          save(key, {
            action: "provider",
            provider: account.provider,
            currentEstimatedBalanceUsd: draft.balance === "" ? null : Number(draft.balance),
            lowBalanceThresholdUsd: Number(draft.threshold),
            autoRechargeEnabled: draft.autoRecharge,
          })
        }
      >
        {busy === key ? "Salvando…" : "Salvar"}
      </Button>
    </div>
  );
}
