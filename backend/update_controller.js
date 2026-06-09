const fs = require('fs');

const path = './src/ai/ai.controller.ts';
let code = fs.readFileSync(path, 'utf-8');

// 1. Add Response and Res
code = code.replace(
  /} from "@nestjs\/common";/,
  `  Res,\n} from "@nestjs/common";\nimport { Response } from "express";`
);

// 2. Add chatStream method
const chatMethodRegex = /  @Post\("chat"\)[\s\S]*?dto\.summary\);\n  }/;
const chatStreamMethod = `

  @Post("chat-stream")
  @RequirePermissions("ai:analyze")
  @ApiOperation({ summary: "Stream chat with AI" })
  async chatStream(
    @Param("projectId", ParseIntPipe) projectId: number,
    @CurrentUser() user: { id: number },
    @Body() dto: AiChatDto,
    @Res() res: Response,
  ) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    
    await this.aiService.chatStream(
      projectId,
      user.id,
      dto.messages,
      dto.summary,
      res,
    );
  }`;

code = code.replace(chatMethodRegex, match => match + chatStreamMethod);

fs.writeFileSync(path, code);
console.log("Updated ai.controller.ts");
