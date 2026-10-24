import { apiAdmin, route } from "@/lib/api";
import { systemStatus } from "@/lib/status";

export const GET = route(async () => {
  await apiAdmin();
  return Response.json(await systemStatus());
});
