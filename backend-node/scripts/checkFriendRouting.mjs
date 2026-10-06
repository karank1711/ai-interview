import { buildFriendMemory, resolveFriendReference, routeFriendIntent } from "../src/services/friendContext.js";
import { classifyInterviewFriendNeed, loadFriendAnswerContext } from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function route(message, history = []) {
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(message, memory);
  return routeFriendIntent(message, resolution);
}

const webCalls = [];
const searchWeb = async (query) => {
  webCalls.push(query);
  return [{ title: "Result", url: "https://example.com/result" }];
};

check("latest version routes to current information", route("What is the latest React version?") === "current_information");
check("newest release also routes to current information", route("What is the newest Python release?") === "current_information");
check("match result routes to current information", route("Who won yesterday's match?") === "current_information");
check("timed event routes to current information", route("What happened in today's match?") === "current_information");
check("current price routes to current information", route("What is the current price?") === "current_information");
check("fresh updates route to current information", route("What are the latest updates about that library?") === "current_information");

check("product question stays on knowledge", route("How does InterviewIQ face analysis work?") === "rag_required");
check("product capability is not a web request", route("What does InterviewIQ currently support?") === "rag_required");
check("incidental time word stays on knowledge", route("How does InterviewIQ face analysis work today?") === "rag_required");

const productHistory = [{ role: "user", content: "How does InterviewIQ face analysis work?" }];
check("product follow-up stays a follow-up", route("Explain it simply", productHistory) === "follow_up");

const topicHistory = [{ role: "user", content: "What is React?" }];
check("explicit fresh follow-up asks for current information", route("What is the latest version?", topicHistory) === "current_information");
check("plain follow-up does not inherit a web search", route("Explain it", topicHistory) === "follow_up");

check("named lecture stays a resource request", route("Send me Babbar Java DSA lecture 20") === "resource_request");
check("playlist request stays a resource request", route("Give me that playlist") === "resource_request");

const classified = classifyInterviewFriendNeed({
  message: "What is the latest React version?",
  includeReportContext: false,
  mode: "general",
});
check("classifier no longer decides web search", classified.needsWebSearch !== true);
check("classifier still reports the analyze mode", classifyInterviewFriendNeed({ message: "hello", includeReportContext: false, mode: "analyze" }).wantsReport === true);

const current = await loadFriendAnswerContext({
  intent: "current_information",
  effectiveText: "What is the latest stable release?",
  topic: "release",
  searchWeb,
  retrieve: async () => [{ title: "should not load", content: "knowledge" }],
});
check("current information calls web search", webCalls.length === 1 && current.web.length === 1 && current.knowledge.length === 0);

webCalls.length = 0;
const follow = await loadFriendAnswerContext({
  intent: "follow_up",
  effectiveText: "Regarding face analysis: Explain it simply",
  topic: "face analysis",
  searchWeb,
  retrieve: async () => [],
});
check("follow-up does not call web search", webCalls.length === 0 && follow.web.length === 0);

const failed = await loadFriendAnswerContext({
  intent: "current_information",
  effectiveText: "What is the current price?",
  topic: "price",
  searchWeb: async () => {
    throw new Error("search unavailable");
  },
});
check("web failure still returns an empty result", failed.web.length === 0 && failed.knowledge.length === 0);

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend routing checks passed.");
