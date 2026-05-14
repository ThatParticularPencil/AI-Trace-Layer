import { runGovernancePipeline } from "@/app/lib/governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encode(payload: unknown) {
  return new TextEncoder().encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(request: Request) {
  const { query } = (await request.json()) as { query?: string };

  if (!query || query.trim().length < 3) {
    return Response.json({ error: "A governance request requires a query." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runGovernancePipeline(query.trim(), async (event) => {
          controller.enqueue(encode({ type: "trace", event }));
        });
        controller.enqueue(encode({ type: "result", result }));
      } catch (error) {
        controller.enqueue(
          encode({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown governance pipeline failure"
          })
        );
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform"
    }
  });
}
