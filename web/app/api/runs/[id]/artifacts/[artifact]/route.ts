import { readFile } from "fs/promises";
import { artifactMap, runPath, safeRunId } from "@/lib/runs";
export const runtime = "nodejs";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; artifact: string }> },
) {
  try {
    const { id, artifact } = await params;
    safeRunId(id);
    if (!(artifact in artifactMap)) throw new Error();
    if (process.env.DEMA_REMOTE_WORKER_URL) {
      const result = await fetch(
        `${process.env.DEMA_REMOTE_WORKER_URL}/jobs/${id}/artifacts/${artifact}`,
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
          "content-disposition": `attachment; filename="${artifact}.json"`,
          "cache-control": "no-store",
        },
      });
    }
    const rel = artifactMap[artifact as keyof typeof artifactMap];
    const body = await readFile(runPath(id, ...rel.split("/")));
    return new Response(body, {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${artifact}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return Response.json({ error: "Artifact not found" }, { status: 404 });
  }
}
