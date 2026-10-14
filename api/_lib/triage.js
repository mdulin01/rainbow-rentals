// Claude reads an inbound tenant text and returns a classification + suggested reply.
// Nothing is sent automatically; the draft shows up in Rent Day for a one-tap approve.
// Skipped (returns null) when ANTHROPIC_API_KEY is not set.
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `You help a small landlord (four units in Greensboro, NC) handle text messages from tenants about rent.
You read one inbound text plus context and return JSON only, no prose, with this shape:
{"intent": one of "paid" | "will_pay" | "partial" | "question" | "maintenance" | "dispute" | "stop" | "other",
 "summary": one short sentence for the landlord,
 "promised_date": "YYYY-MM-DD" or null (only when the tenant names a day they will pay),
 "reply": a short, warm, plain-English SMS reply (under 300 characters) the landlord could send as-is,
 "needs_human": true if the reply involves money terms, late fees, legal matters, or anything you are unsure about}
Rules for the reply: never waive, add, or restate fees or amounts beyond what the context states; never make promises about repairs or deadlines; never threaten; if the tenant says they paid, thank them and say it will be confirmed once it shows in the bank. Sign the reply with the landlord's name given in context.`;

export async function triageInbound({ text, tenant, property, row, settings, from }) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic();
  const context = {
    landlord_name: settings?.fromName || from || 'Mike',
    tenant_first_name: tenant?.firstName || (tenant?.name || '').split(' ')[0] || 'there',
    property: property?.name || 'unknown',
    month: row?.monthKey || null,
    rent_due: row?.due ?? null,
    paid_so_far: row?.paid ?? null,
    balance: row?.balance ?? null,
    status: row?.status || null,
    days_past_due: row?.daysPast ?? null,
    late_fee: row?.terms?.lateFee ?? null,
    payment_instructions: settings?.payInstructions || null,
  };
  try {
    const res = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 1024,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Context: ${JSON.stringify(context)}\n\nInbound text from tenant: """${String(text).slice(0, 1500)}"""` }],
    });
    if (res.stop_reason === 'refusal') return null;
    const textOut = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const m = textOut.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : null;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      intent: String(parsed.intent || 'other'),
      summary: String(parsed.summary || '').slice(0, 300),
      promisedDate: parsed.promised_date || null,
      reply: String(parsed.reply || '').slice(0, 320),
      needsHuman: parsed.needs_human !== false,
      model: res.model,
    };
  } catch (e) {
    console.error('triage failed', e?.status || '', e?.message || e);
    return null;
  }
}
