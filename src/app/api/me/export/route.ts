import { apiUser, route } from "@/lib/api";
import { audit } from "@/lib/audit";
import { exportUserData } from "@/lib/privacy";

export const GET = route(async () => {
  const user = await apiUser();
  const data = await exportUserData(user.id);
  await audit("data.export", { userId: user.id });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="my-data-${date}.json"`,
      "cache-control": "private, no-store",
    },
  });
});
