import { readFile } from "fs/promises";
import path from "path";
export const runtime = "nodejs";
export async function POST() {
  const dashboard = JSON.parse(
    await readFile(
      path.resolve(
        process.cwd(),
        "..",
        "examples",
        "synthetic",
        "dashboard-data.json",
      ),
      "utf8",
    ),
  );
  return Response.json(
    { run_id: "dema-synthetic-sample", state: "Complete", dashboard },
    { status: 200 },
  );
}
