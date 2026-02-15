import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const filePath = path.join(process.cwd(), "openapi.yaml");
  const contents = await readFile(filePath, "utf8");

  return new Response(contents, {
    headers: {
      "content-type": "text/yaml; charset=utf-8"
    }
  });
}
