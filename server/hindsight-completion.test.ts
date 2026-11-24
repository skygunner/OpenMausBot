import { expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { retainCompletion } from "./hindsight-completion.ts";

it("retains only a structured outcome for an owner task", async () => {
  const dir = await mkdtemp(join(tmpdir(), "omb-completion-"));
  const file = join(dir, "test.json");
  const post = vi.fn().mockResolvedValue({ ok: true });
  const writer = { generateText: vi.fn().mockResolvedValue(JSON.stringify({ goal: "Repair import", outcome: "Fixture passed", extra: "not shared" })) };
  const turn = { owner: true, turnId: "fixture", person: "private request", bot: "private reply" };
  try {
    await writeFile(file, JSON.stringify({ apiUrl: "https://fixture.invalid", bankId: "fixture" }));
    vi.stubGlobal("fetch", post);
    await retainCompletion(file, { ...turn, owner: false }, writer);
    expect(writer.generateText).not.toHaveBeenCalled();
    await retainCompletion(file, turn, writer);
    expect(JSON.parse(post.mock.calls[0]![1].body).items[0]).toMatchObject({ document_id: "openmausbot-task-fixture", content: "goal: Repair import\noutcome: Fixture passed" });
    writer.generateText.mockResolvedValue("null");
    await retainCompletion(file, turn, writer);
    expect(post).toHaveBeenCalledTimes(1);
  } finally { vi.unstubAllGlobals(); await rm(dir, { recursive: true }); }
});
