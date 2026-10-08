import "server-only";
import { addMonths, monthKey, paymentDateFor, todayInTimezone } from "../dates";
import { toLocalParts } from "@/lib/agenda/time";
import { ALLOWANCE_TIMEZONE } from "../dates";
import * as repo from "./allowance-repository";

/**
 * Mesada automática. IDEMPOTENTE: o índice único (criança, ALLOWANCE, "<plano>:<ano-mês>") garante UMA mesada
 * por mês, mesmo com cron repetido, abas simultâneas ou recuperação ao abrir a tela.
 * O cron (/api/cron/allowance) roda 1x/dia; ao abrir a Mesada, catchUpChild cobre qualquer atraso.
 */

const MAX_CATCH_UP_MONTHS = 12;

/** Lança as mesadas devidas (do mês da data inicial até hoje). Devolve quantas foram lançadas agora. */
export async function catchUpChild(plan: repo.PlanRecord, now: Date = new Date()): Promise<number> {
  if (!plan.active || plan.monthlyAmountCents <= 0) return 0;
  const today = todayInTimezone(now);
  const current = toLocalParts(now, ALLOWANCE_TIMEZONE);
  const [startYear, startMonth] = plan.startDate.split("-").map(Number);
  let launched = 0;
  for (let back = MAX_CATCH_UP_MONTHS; back >= 0; back -= 1) {
    const { year, month } = addMonths(current.year, current.month, -back);
    if (year * 12 + month < startYear * 12 + startMonth) continue;
    const date = paymentDateFor(year, month, plan.paymentDay);
    if (date < plan.startDate || date > today) continue; // ainda não chegou / antes do início
    const yearMonth = monthKey(year, month);
    if (!plan.carryOverBalance) {
      // fecha o saldo anterior (sem apagar histórico) ANTES de entrar a nova mesada
      await repo.insertClosingAdjustment({ childId: plan.childId, planId: plan.id, yearMonth, date });
    }
    const inserted = await repo.insertMonthlyAllowance({
      childId: plan.childId,
      planId: plan.id,
      planName: plan.name,
      amountCents: plan.monthlyAmountCents,
      yearMonth,
      date,
    });
    if (inserted) launched += 1;
  }
  return launched;
}

export interface AllowanceCronResult {
  plans: number;
  launched: number;
  failed: number;
}

export async function runAllowanceSchedule(now: Date = new Date()): Promise<AllowanceCronResult> {
  const plans = await repo.listActivePlansWithOwner();
  let launched = 0;
  let failed = 0;
  for (const plan of plans) {
    try {
      launched += await catchUpChild(plan, now);
    } catch (error) {
      failed += 1;
      console.error(JSON.stringify({ scope: "allowance", event: "cron.plan_failed", planId: plan.id, message: (error as Error)?.message?.slice(0, 200) }));
    }
  }
  return { plans: plans.length, launched, failed };
}
