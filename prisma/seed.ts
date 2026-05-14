import { PrismaClient } from "@prisma/client";
import { demoScenarios } from "../app/data/demo-scenarios";

const prisma = new PrismaClient();

async function main() {
  for (const scenario of demoScenarios) {
    const existing = await prisma.conversation.findFirst({
      where: { title: scenario.title }
    });

    if (!existing) {
      await prisma.conversation.create({
        data: {
          title: scenario.title,
          domain: scenario.domain,
          messages: {
            create: {
              role: "user",
              content: scenario.prompt
            }
          }
        }
      });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
