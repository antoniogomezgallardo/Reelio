import { access, readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const candidates = [
    path.join(process.cwd(), "openapi.yaml"),
    path.join(process.cwd(), "..", "openapi.yaml"),
    path.join(process.cwd(), "..", "..", "openapi.yaml")
  ];

  let filePath: string | null = null;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      filePath = candidate;
      break;
    } catch {
      // Try next location
    }
  }

  if (!filePath) {
    return new Response("OpenAPI spec not found.", { status: 404 });
  }

  const contents = await readFile(filePath, "utf8");

  return new Response(contents, {
    headers: {
      "content-type": "text/yaml; charset=utf-8"
    }
  });
}
