import { cancelSession, deleteSession } from "@/lib/trueforge/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/agent/decline — the human said no. Cancels any running turn and
 * deletes the session(s) so nothing is left half-open. Body: `{ sessionIds: string[] }`.
 */
export async function POST(request: Request) {
  const { sessionIds = [] } = (await request.json().catch(() => ({}))) as { sessionIds?: string[] };
  await Promise.all(
    sessionIds.filter(Boolean).map(async (id) => {
      await cancelSession(id);
      await deleteSession(id);
    }),
  );
  return Response.json({ ok: true });
}
