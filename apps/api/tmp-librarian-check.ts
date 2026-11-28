import "dotenv/config";
import { runChat } from "./src/ai/agent.ts";

const questions = [
  "Hello, what can you do?",
  "Who wrote Treasure Island?",
  "Tell me more about the first one",
  "What mysteries do you have?",
  "Compare Treasure Island and Dracula",
  "How many books can a guest download?",
  "What is the weather today?",
  "Who wrote Dracula? What year was it published?",
  "What books are by Charles Dickens?",
  "How many books are in the catalog?",
  "Recommend a mystery",
  "Who wrote Adventures?",
];

async function main() {
const sessionId = "verify-local-librarian";
const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

for (const content of questions) {
  messages.push({ role: "user", content });
  const result = await runChat({ sessionId, messages });
  console.log("\nQ: " + content);
  console.log(result.reply);
  console.log("TOOLS: " + result.toolTrace.map((item) => `${item.name} ${JSON.stringify(item.arguments)}`).join(" || "));
  console.log("PENDING: " + JSON.stringify(result.pendingAction));
  messages.push({ role: "assistant", content: result.reply });
}

const save = await runChat({
  sessionId: "verify-local-save",
  messages: [{ role: "user", content: "Add Treasure Island to my library" }],
});
console.log("\nQ: Add Treasure Island to my library");
console.log(save.reply);
console.log("TOOLS: " + save.toolTrace.map((item) => `${item.name} ${JSON.stringify(item.arguments)}`).join(" || "));
console.log("PENDING: " + JSON.stringify(save.pendingAction));
}

main();
