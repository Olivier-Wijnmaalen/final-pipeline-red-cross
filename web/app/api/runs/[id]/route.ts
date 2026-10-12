import { readJson, runPath, safeRunId } from "@/lib/runs";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    safeRunId(id);
    if (process.env.DEMA_REMOTE_WORKER_URL) {
      const result = await fetch(
        `${process.env.DEMA_REMOTE_WORKER_URL}/jobs/${id}`,
        {
          headers: {
            authorization: `Bearer ${process.env.DEMA_REMOTE_WORKER_TOKEN || ""}`,
          },
          cache: "no-store",
        },
      );
      return new Response(result.body, {
        status: result.status,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    }
    const status = await readJson(runPath(id, "status.json"));
    if (status.state === "Complete")
      status.dashboard = await readJson(runPath(id, "dashboard-data.json"));
    return Response.json(status);
  } catch {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }
}
