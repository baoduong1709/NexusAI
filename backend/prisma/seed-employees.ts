import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  // Lấy danh sách role từ DB
  const roles = await prisma.role.findMany();
  const roleMap: Record<string, number> = {};
  roles.forEach((r) => (roleMap[r.name] = r.id));

  const defaultPassword = await bcrypt.hash("NexusAI@2024", 10);

  const employees = [
    // === PM (2 người) ===
    {
      name: "Nguyễn Văn Minh",
      email: "minh.nguyen@nexusai.com",
      role: "PM",
      skills: ["project management", "agile", "scrum", "stakeholder communication"],
    },
    {
      name: "Trần Thị Hương",
      email: "huong.tran@nexusai.com",
      role: "PM",
      skills: ["product management", "roadmap planning", "user research", "data analysis"],
    },

    // === Tech Lead (2 người) ===
    {
      name: "Lê Quốc Bảo",
      email: "bao.le@nexusai.com",
      role: "Lead",
      skills: ["system architecture", "Node.js", "React", "cloud infrastructure", "mentoring"],
    },
    {
      name: "Phạm Hoàng Long",
      email: "long.pham@nexusai.com",
      role: "Lead",
      skills: ["backend architecture", "database design", "DevOps", "code review", "team leading"],
    },

    // === Developers (8 người) ===
    {
      name: "Hoàng Văn Tú",
      email: "tu.hoang@nexusai.com",
      role: "Developer",
      skills: ["Node.js", "NestJS", "PostgreSQL", "TypeScript", "Redis"],
    },
    {
      name: "Ngô Thị Mai",
      email: "mai.ngo@nexusai.com",
      role: "Developer",
      skills: ["React", "Next.js", "TypeScript", "TailwindCSS", "Figma"],
    },
    {
      name: "Đỗ Thanh Sơn",
      email: "son.do@nexusai.com",
      role: "Developer",
      skills: ["Python", "FastAPI", "Machine Learning", "NLP", "LangChain"],
    },
    {
      name: "Vũ Đức Anh",
      email: "anh.vu@nexusai.com",
      role: "Developer",
      skills: ["Node.js", "GraphQL", "MongoDB", "Docker", "Kubernetes"],
    },
    {
      name: "Bùi Thị Lan",
      email: "lan.bui@nexusai.com",
      role: "Developer",
      skills: ["React Native", "Flutter", "Mobile Development", "Firebase", "Redux"],
    },
    {
      name: "Trịnh Công Thành",
      email: "thanh.trinh@nexusai.com",
      role: "Developer",
      skills: ["Java", "Spring Boot", "Microservices", "Kafka", "AWS"],
    },
    {
      name: "Phan Ngọc Hà",
      email: "ha.phan@nexusai.com",
      role: "Developer",
      skills: ["Vue.js", "Nuxt.js", "JavaScript", "SASS", "Storybook"],
    },
    {
      name: "Đinh Hữu Phúc",
      email: "phuc.dinh@nexusai.com",
      role: "Developer",
      skills: ["Go", "Rust", "System Programming", "WebAssembly", "gRPC"],
    },

    // === Designers (3 người) ===
    {
      name: "Lý Mỹ Linh",
      email: "linh.ly@nexusai.com",
      role: "Designer",
      skills: ["UI/UX design", "Figma", "user research", "prototyping", "design system"],
    },
    {
      name: "Mai Xuân Khôi",
      email: "khoi.mai@nexusai.com",
      role: "Designer",
      skills: ["product design", "interaction design", "motion design", "Adobe Creative Suite"],
    },
    {
      name: "Huỳnh Kim Ngân",
      email: "ngan.huynh@nexusai.com",
      role: "Designer",
      skills: ["visual design", "branding", "illustration", "wireframing", "accessibility"],
    },

    // === Testers / QA (4 người) ===
    {
      name: "Đặng Minh Tuấn",
      email: "tuan.dang@nexusai.com",
      role: "Tester",
      skills: ["manual testing", "automation testing", "Selenium", "Cypress", "test case design"],
    },
    {
      name: "Trương Thị Thảo",
      email: "thao.truong@nexusai.com",
      role: "Tester",
      skills: ["QA automation", "Playwright", "JMeter", "API testing", "performance testing"],
    },
    {
      name: "Hồ Văn Kiên",
      email: "kien.ho@nexusai.com",
      role: "Tester",
      skills: ["security testing", "penetration testing", "OWASP", "Burp Suite", "CI/CD"],
    },
    {
      name: "Tạ Ngọc Yến",
      email: "yen.ta@nexusai.com",
      role: "Tester",
      skills: ["regression testing", "smoke testing", "Postman", "JIRA", "Agile testing"],
    },
  ];

  let created = 0;

  for (const emp of employees) {
    const existing = await prisma.user.findUnique({ where: { email: emp.email } });
    if (existing) {
      console.log(`  [SKIP] ${emp.email} - đã tồn tại`);
      continue;
    }

    await prisma.user.create({
      data: {
        name: emp.name,
        email: emp.email,
        password: defaultPassword,
        roleId: roleMap[emp.role],
        skills: emp.skills,
        chatLanguage: "vi",
      },
    });

    created++;
    console.log(`  [OK] ${emp.name} (${emp.role}) - ${emp.email}`);
  }

  console.log(`\n✅ Đã tạo ${created} nhân viên mới.`);
  console.log(`🔑 Mật khẩu mặc định cho tất cả: NexusAI@2024`);

  // Tổng kết
  const totalUsers = await prisma.user.count();
  console.log(`📊 Tổng số user trong hệ thống: ${totalUsers}`);

  // Liệt kê theo role
  const stats = await prisma.user.groupBy({
    by: ["roleId"],
    _count: true,
  });

  console.log("\n📋 Thống kê theo role:");
  for (const s of stats) {
    const role = roles.find((r) => r.id === s.roleId);
    console.log(`   ${role?.name ?? "Unknown"}: ${s._count} người`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Lỗi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
