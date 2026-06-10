const { OpenAI } = require("openai");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_API_BASE || "https://api.ai-box.vn/v1",
});

async function main() {
  try {
    console.log("Calling OpenAI API...");
    const stream = await openai.chat.completions.create({
      model: process.env.AI_MODEL || "deepseek-v4-flash[1m]",
      messages: [
        { role: "user", content: "chào bạn" }
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      process.stdout.write(chunk.choices[0]?.delta?.content || "");
    }
    console.log("\nDone!");
  } catch (err) {
    console.error("Error calling API:", err);
  }
}

main();
