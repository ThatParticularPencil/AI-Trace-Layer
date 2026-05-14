import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      policyAction: true,
      verification: true,
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return Response.json({ conversations });
}
