import { z } from "zod";
import { apiUser, parseBody, route } from "@/lib/api";
import { testConnector } from "@/lib/connectors";
import { assertTypeAllowed, connectorType, loadManageableConnector } from "@/lib/connectors/http";

const schema = z.object({
  type: connectorType,
  config: z.record(z.string(), z.string().max(20_000)),
  /** When editing: reuse stored secrets the user left empty. */
  id: z.string().uuid().optional(),
});

/** Tries the connection without saving anything. */
export const POST = route(async (req: Request) => {
  const user = await apiUser();
  const input = await parseBody(req, schema);
  assertTypeAllowed(input.type, user);
  if (input.id) await loadManageableConnector({ params: Promise.resolve({ id: input.id }) }, user);
  try {
    const summary = await testConnector(input.type, input.config, input.id);
    return Response.json({ ok: true, summary });
  } catch (err) {
    return Response.json({ ok: false, error: (err as Error).message }, { status: 200 });
  }
});
