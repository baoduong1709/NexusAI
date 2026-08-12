const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  
  // 1. Show current configs
  const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  console.log('\n=== Current System Configs ===');
  for (const c of configs) {
    console.log(`  ${c.key} = ${c.value}`);
  }

  // 2. Update model names
  const updates = [
    { key: 'AI_FLASH_MODEL', value: 'gemini-2.5-flash' },
    { key: 'AI_PRO_MODEL', value: 'gemini-2.5-pro' },
  ];

  for (const { key, value } of updates) {
    const existing = configs.find(c => c.key === key);
    if (existing) {
      await prisma.systemConfig.update({ where: { key }, data: { value } });
      console.log(`\n✅ Updated ${key}: "${existing.value}" → "${value}"`);
    } else {
      console.log(`\n⚠️ ${key} not found in database`);
    }
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(console.error);
