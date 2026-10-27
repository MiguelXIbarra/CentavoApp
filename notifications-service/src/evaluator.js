import { config } from './config.js';
import { notifications } from './db.js';

export function getPeriodDateRange(period = 'mensual', referenceDate = new Date().toISOString().slice(0, 10)) {
  const [y, m, d] = referenceDate.split('-').map(Number);

  if (period === 'semanal') {
    const curr = new Date(Date.UTC(y, m - 1, d));
    const day = curr.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr);
    monday.setUTCDate(curr.getUTCDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    return {
      from: monday.toISOString().slice(0, 10),
      to: sunday.toISOString().slice(0, 10),
    };
  }

  if (period === 'anual') {
    return {
      from: `${y}-01-01`,
      to: `${y}-12-31`,
    };
  }

  // Por defecto mensual
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${y}-${String(m).padStart(2, '0')}-01`,
    to: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Evalúa un evento de transacción contra el presupuesto correspondiente.
 */
export async function evaluateTransactionEvent({
  userId,
  amountCents,
  category,
  date,
  transactionId = null,
  budgetOverride = null,
  spentCentsOverride = null,
  authToken = null,
}) {
  const normCategory = category.trim().toLowerCase();
  let limitCents = null;
  let period = 'mensual';

  // 1. Obtener presupuesto (override directo o consulta a budgets-service)
  if (budgetOverride) {
    limitCents = budgetOverride.limit_cents ?? Math.round((budgetOverride.limit ?? budgetOverride.limit_amount ?? 0) * 100);
    period = (budgetOverride.period || 'mensual').toLowerCase();
  } else {
    try {
      const headers = authToken ? { authorization: `Bearer ${authToken}` } : {};
      const res = await fetch(
        `${config.budgetsServiceUrl}/budgets?category=${encodeURIComponent(normCategory)}`,
        { headers, signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        const found = (data.budgets || []).find((b) => b.category.toLowerCase() === normCategory);
        if (found) {
          limitCents = Math.round((found.limit ?? found.limit_amount) * 100);
          period = (found.period || 'mensual').toLowerCase();
        }
      }
    } catch (err) {
      console.error('Error al consultar budgets-service:', err.message);
    }
  }

  // Si no hay presupuesto configurado para esta categoría, no procede alerta
  if (!limitCents || limitCents <= 0) {
    return {
      alert_generated: false,
      reason: 'no_budget_configured',
      message: `No existe un presupuesto configurado para la categoría "${normCategory}"`,
      evaluation: null,
    };
  }

  // 2. Determinar gasto acumulado en el periodo
  let totalSpentCents = 0;
  const { from, to } = getPeriodDateRange(period, date);

  if (typeof spentCentsOverride === 'number') {
    totalSpentCents = spentCentsOverride;
  } else {
    try {
      const headers = authToken ? { authorization: `Bearer ${authToken}` } : {};
      const res = await fetch(
        `${config.transactionsServiceUrl}/transactions?category=${encodeURIComponent(normCategory)}&from=${from}&to=${to}`,
        { headers, signal: AbortSignal.timeout(4000) }
      );
      if (res.ok) {
        const data = await res.json();
        const txs = data.transactions || [];
        const alreadyInList = transactionId && txs.some((t) => t.id === transactionId);
        const sumPrevious = txs
          .filter((t) => !transactionId || t.id !== transactionId)
          .reduce((acc, t) => acc + Math.round(t.amount * 100), 0);
        totalSpentCents = sumPrevious + amountCents;
      } else {
        // Si no responde transactions-service, usamos el monto de la transacción recibida
        totalSpentCents = amountCents;
      }
    } catch (err) {
      console.error('Error al consultar transactions-service:', err.message);
      totalSpentCents = amountCents;
    }
  }

  const percentage = (totalSpentCents / limitCents) * 100;
  const evaluation = {
    category: normCategory,
    period,
    period_from: from,
    period_to: to,
    spent: totalSpentCents / 100,
    spent_amount: totalSpentCents / 100,
    limit: limitCents / 100,
    limit_amount: limitCents / 100,
    percentage: Number(percentage.toFixed(2)),
  };

  let notificationId = null;
  let alertType = null;
  let severity = null;
  let message = null;

  if (totalSpentCents >= limitCents) {
    // Sobregasto crítico (>= 100%)
    alertType = 'OVERSPEND_ALERT';
    severity = 'critical';
    message = `Has superado el presupuesto de ${normCategory}. Gastado: $${(totalSpentCents / 100).toFixed(2)} de un límite de $${(limitCents / 100).toFixed(2)} (${percentage.toFixed(1)}%).`;
  } else if (totalSpentCents >= Math.round(limitCents * 0.8)) {
    // Advertencia de cercanía al límite (>= 80%)
    alertType = 'BUDGET_WARNING';
    severity = 'warning';
    message = `Atención: has consumido el ${percentage.toFixed(1)}% de tu presupuesto de ${normCategory}. Gastado: $${(totalSpentCents / 100).toFixed(2)} de un límite de $${(limitCents / 100).toFixed(2)}.`;
  }

  if (alertType) {
    notificationId = notifications.create({
      userId,
      type: alertType,
      category: normCategory,
      message,
      severity,
      spentCents: totalSpentCents,
      limitCents,
      percentage,
      transactionId,
    });

    const saved = notifications.findById(notificationId);
    return {
      alert_generated: true,
      alert: {
        id: saved.id,
        user_id: saved.user_id,
        type: saved.type,
        category: saved.category,
        message: saved.message,
        severity: saved.severity,
        spent: saved.spent_cents / 100,
        spent_amount: saved.spent_cents / 100,
        limit: saved.limit_cents / 100,
        limit_amount: saved.limit_cents / 100,
        percentage: Number(saved.percentage.toFixed(2)),
        read: Boolean(saved.read),
        transaction_id: saved.transaction_id ?? null,
        created_at: saved.created_at,
      },
      evaluation: {
        ...evaluation,
        status: severity === 'critical' ? 'exceeded' : 'warning',
      },
    };
  }

  return {
    alert_generated: false,
    alert: null,
    evaluation: {
      ...evaluation,
      status: 'ok',
    },
  };
}
