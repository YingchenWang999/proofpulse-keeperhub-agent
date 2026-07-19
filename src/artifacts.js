import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function saveRunArtifact(artifactDir, artifact) {
  await mkdir(artifactDir, { recursive: true });
  const stamp = artifact.snapshot.observedAt.replaceAll(":", "-");
  const file = path.join(artifactDir, `${stamp}-${artifact.evidence.runId.slice(2, 10)}.json`);
  await writeFile(file, `${JSON.stringify(artifact, null, 2)}\n`, { mode: 0o600 });
  return file;
}
