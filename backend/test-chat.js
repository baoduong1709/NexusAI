const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: "sk-1O6r1xOga2yJzGzMxm8bqVbtsVXt8i8JaukGhHiA37BZb43L",
  baseURL: "https://api.ai-box.vn/v1",
});

async function main() {
  try {
    console.log("Calling OpenAI API...");
    const stream = await openai.chat.completions.create({
      model: "deepseek-v4-flash[1m]",
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
