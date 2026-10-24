import { apiAdmin, route } from "@/lib/api";
import { listAudit } from "@/lib/audit-log";

export const GET = route(async (req: Request) => {
  await apiAdmin();
  const url = new URL(req.url);
  const before = Number(url.searchParams.get("before")) || undefined;
  const action = url.searchParams.get("action")?.slice(0, 40) || undefined;
  const format = url.searchParams.get("format");
  const rows = await listAudit({ before, action, limit: format === "csv" ? 500 : 100 });

  if (format === "csv") {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      "id,at,user,action,target,detail",
      ...rows.map((r) =>
        [r.id, r.at.toISOString(), r.user_email, r.action, r.target, JSON.stringify(r.detail)].map(esc).join(","),
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }
  return Response.json(rows);
});
