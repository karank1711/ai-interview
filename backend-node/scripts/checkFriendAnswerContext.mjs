import { buildFriendMemory, resolveFriendReference, routeFriendIntent } from "../src/services/friendContext.js";
import { formatFriendKnowledgeContext } from "../src/services/friendRetrieval.js";
import { loadFriendAnswerContext, shouldRetrieveFriendKnowledge } from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function turn(message, history = []) {
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(message, memory);
  const intent = routeFriendIntent(message, resolution);
  const text = `${resolution.resolvedText || message} ${resolution.topic || ""}`;
  return { resolution, intent, text };
}

const face = turn("How does InterviewIQ face analysis work?");
check("product question requests knowledge", face.intent === "rag_required" && shouldRetrieveFriendKnowledge(face.intent, face.text));

const binary = turn("What is binary search?");
check("general question skips knowledge", binary.intent === "normal_qa" && !shouldRetrieveFriendKnowledge(binary.intent, binary.text));

const history = [{ role: "user", content: "How does InterviewIQ face analysis work?" }];
const follow = turn("Explain it simply", history);
check("product follow-up keeps topic", follow.resolution.mode === "follow_up" && /face analysis/i.test(follow.resolution.resolvedText));
check("product follow-up requests knowledge", shouldRetrieveFriendKnowledge(follow.intent, follow.text));

const codeFollow = turn("Give Java code", [{ role: "user", content: "What is binary search?" }]);
check("technical follow-up stays on topic", codeFollow.resolution.mode === "follow_up" && /binary search/i.test(codeFollow.resolution.resolvedText));
check("technical follow-up skips knowledge", !shouldRetrieveFriendKnowledge(codeFollow.intent, codeFollow.text));

const unsupported = turn("Does InterviewIQ support automatic stock trading?");
check("unsupported product question still retrieves", shouldRetrieveFriendKnowledge(unsupported.intent, unsupported.text));

const product = await loadFriendAnswerContext({
  intent: face.intent,
  effectiveText: face.resolution.resolvedText,
  topic: face.resolution.topic,
});
const productNotes = formatFriendKnowledgeContext(product.knowledge);
check("relevant RAG includes face cues", /face is visible|camera/i.test(productNotes));
check("relevant RAG includes trusted-context rules", /do not invent product features/i.test(productNotes));

const general = await loadFriendAnswerContext({
  intent: binary.intent,
  effectiveText: binary.resolution.resolvedText,
  topic: binary.resolution.topic,
});
check("unrelated question has no RAG context", general.knowledge.length === 0 && formatFriendKnowledgeContext(general.knowledge) === "");

const missing = await loadFriendAnswerContext({
  intent: unsupported.intent,
  effectiveText: unsupported.resolution.resolvedText,
  topic: unsupported.resolution.topic,
});
const missingNotes = formatFriendKnowledgeContext(missing.knowledge);
check("unsupported feature is not confirmed by notes", !/stock trading/i.test(missing.knowledge.map((item) => item.content).join(" ")));
check("unsupported feature prompt forbids invented features", /never present a guessed product detail/i.test(missingNotes));

const continued = await loadFriendAnswerContext({
  intent: follow.intent,
  effectiveText: follow.resolution.resolvedText,
  topic: follow.resolution.topic,
});
check("follow-up retrieves the face-analysis note", continued.knowledge.some((item) => /face/i.test(item.title)));

const failed = await loadFriendAnswerContext({
  intent: "rag_required",
  effectiveText: "How does InterviewIQ face analysis work?",
  topic: "face analysis",
  retrieve: async () => {
    throw new Error("retrieval unavailable");
  },
});
check("retrieval failure returns no RAG context", failed.knowledge.length === 0 && formatFriendKnowledgeContext(failed.knowledge) === "");

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend answer-context checks passed.");
