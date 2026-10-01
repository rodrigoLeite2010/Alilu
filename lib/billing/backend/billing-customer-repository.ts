import "server-only";
import { getDb } from "@/lib/db/client";

/**
 * Cliente Asaas por usuário, para qualquer produto pago além da
 * assinatura do Piloto (que continua usando automation_subscriptions —
 * esta tabela nunca é escrita pelo fluxo da assinatura).
 */

export interface BillingCustomerRecord {
  userId: string;
  asaasCustomerId: string;
  cpfCnpj: string;
}

export async function getBillingCustomer(userId: string): Promise<BillingCustomerRecord | null> {
  const db = getDb();
  const rows = await db`select * from billing_customers where user_id = ${userId}`;
  const row = rows[0];
  return row
    ? { userId: row.user_id as string, asaasCustomerId: row.asaas_customer_id as string, cpfCnpj: row.cpf_cnpj as string }
    : null;
}

export async function saveBillingCustomer(record: BillingCustomerRecord): Promise<void> {
  const db = getDb();
  await db`
    insert into billing_customers (user_id, asaas_customer_id, cpf_cnpj)
    values (${record.userId}, ${record.asaasCustomerId}, ${record.cpfCnpj})
    on conflict (user_id) do update set asaas_customer_id = excluded.asaas_customer_id, cpf_cnpj = excluded.cpf_cnpj, updated_at = now()
  `;
}
