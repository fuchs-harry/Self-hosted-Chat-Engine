import { apiAdmin, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { loadDemoData } from "@/lib/knowledge/demo";

export const POST = route(async () => {
  const user = await apiAdmin();
  const result = await loadDemoData(user);
  if (!result.existed) {
    await audit("knowledge.create", { userId: user.id, target: result.id, detail: { demo: true } });
  }
  return Response.json(result, { status: result.existed ? 200 : 201 });
});
