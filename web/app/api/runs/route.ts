import { spawn } from "child_process";
import { writeFile } from "fs/promises";
import path from "path";
import {
  newRun,
  parseMode,
  runPath,
  validateUpload,
  writeJson,
} from "@/lib/runs";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("document");
    if (!(file instanceof File)) throw new Error("Choose a document");
    const name = validateUpload(file);
    const mode = parseMode(form.get("mode"));
    const country = String(form.get("country") || "").trim();
    if (!country || country.length > 80)
      throw new Error("Enter a valid country");
    if (process.env.VERCEL && !process.env.DEMA_REMOTE_WORKER_URL)
      throw new Error("Live processing requires the configured remote worker");
    const id = await newRun();
    if (process.env.DEMA_REMOTE_WORKER_URL) {
      const remoteForm = new FormData();
      remoteForm.set("run_id", id);
      remoteForm.set("country", country);
      remoteForm.set("mode", mode);
      remoteForm.set("document", file, name);
      const response = await fetch(
        `${process.env.DEMA_REMOTE_WORKER_URL}/jobs`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${process.env.DEMA_REMOTE_WORKER_TOKEN || ""}`,
          },
          body: remoteForm,
        },
      );
      if (!response.ok) throw new Error("Remote worker rejected the job");
    } else {
      await writeFile(
        runPath(id, "upload", name),
        Buffer.from(await file.arrayBuffer()),
      );
      await writeJson(runPath(id, "status.json"), {
        run_id: id,
        state: "Uploaded",
      });
      const root = path.resolve(process.cwd(), "..");
      const child = spawn(
        /* turbopackIgnore: true */ process.env.PYTHON_BIN || "python",
        [
          "-m",
          "dashboard_adapter.job",
          runPath(id),
          "--country",
          country,
          "--mode",
          mode,
        ],
        { cwd: root, detached: true, stdio: "ignore", env: process.env },
      );
      child.unref();
    }
    return Response.json({ run_id: id, state: "Uploaded" }, { status: 202 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
