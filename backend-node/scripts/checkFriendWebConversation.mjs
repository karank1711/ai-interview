import { buildFriendMemory, resolveFriendReference, routeFriendIntent } from "../src/services/friendContext.js";
import {
  UNVERIFIED_CURRENT_FACT,
  enforceCurrentEvidence,
  formatCurrentInformationContext,
  friendAnswerInstructions,
  loadFriendAnswerContext,
  replyAsInterviewFriend,
  shouldRetrieveFriendKnowledge,
} from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function turn(message, history = []) {
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(message, memory);
  return { resolution, intent: routeFriendIntent(message, resolution), memory };
}

function historyFrom(messages) {
  return messages.map((content) => ({ role: "user", content }));
}

const javaQuestion = "What is the latest version of Java?";
const java = turn(javaQuestion);
check("latest version question is current information", java.intent === "current_information");
check("latest version question keeps the subject in the search query", /java/i.test(java.resolution.informationNeed) && /version/i.test(java.resolution.informationNeed));

const evidence = [{
  title: "Official release",
  url: "https://example.com/releases",
  snippet: "The current release is 24.",
  domain: "example.com",
  year: 2026,
}];
const grounded = formatCurrentInformationContext(evidence, { currentInformation: true });
const calls = [];
const searched = await loadFriendAnswerContext({
  intent: java.intent,
  effectiveText: javaQuestion,
  topic: java.resolution.topic,
  searchQuery: java.resolution.informationNeed,
  searchWeb: async (query, _signal, options) => {
    calls.push({ query, fresh: Boolean(options?.fresh) });
    return evidence;
  },
});
check("current question calls web search once", calls.length === 1 && /java/i.test(calls[0].query) && /version/i.test(calls[0].query));
check("web evidence reaches the answer context", searched.web.length === 1 && grounded.includes("https://example.com/releases") && grounded.includes("The current release is 24."));

const searchFollow = turn("web pr search karke batao", historyFrom([javaQuestion]));
check("search instruction keeps the earlier fact", searchFollow.intent === "current_information" && searchFollow.resolution.verify === true);
check("search instruction does not become the query", /java/i.test(searchFollow.resolution.informationNeed) && !/batao|karke/i.test(searchFollow.resolution.informationNeed));

const sure = turn("are you sure?", historyFrom([javaQuestion]));
check("are you sure verifies the earlier fact", sure.intent === "current_information" && sure.resolution.verify === true && /java/i.test(sure.resolution.informationNeed));
const sureCalls = [];
await loadFriendAnswerContext({
  intent: sure.intent,
  effectiveText: sure.resolution.resolvedText,
  searchQuery: sure.resolution.informationNeed,
  fresh: sure.resolution.verify,
  searchWeb: async (query, _signal, options) => {
    sureCalls.push({ query, fresh: Boolean(options?.fresh) });
    return evidence;
  },
});
check("verification performs a fresh search", sureCalls.length === 1 && sureCalls[0].fresh === true && /java/i.test(sureCalls[0].query));

const pakka = turn("pakka?", historyFrom([javaQuestion]));
const pakkaGuide = friendAnswerInstructions({ resolution: pakka.resolution, message: "pakka?" });
check("short challenge verifies instead of defining the word", pakka.intent === "current_information" && pakka.resolution.verify === true && !/^pakka$/i.test(pakka.resolution.informationNeed));
check("short challenge is not treated as a new subject", /do not define their words/i.test(pakkaGuide) && /java/i.test(pakka.resolution.informationNeed));

for (const phrase of ["search it", "check online", "verify this", "look it up", "double check"]) {
  const follow = turn(phrase, historyFrom([javaQuestion]));
  check(`${phrase} preserves the current fact`, follow.intent === "current_information" && /java/i.test(follow.resolution.informationNeed) && !new RegExp(phrase, "i").test(follow.resolution.informationNeed));
}

const react = turn("What about React?", historyFrom([javaQuestion]));
const reactVerify = turn("verify that", historyFrom([javaQuestion, "What about React?"]));
check("topic switch moves the current fact", /react/i.test(react.resolution.informationNeed) && !/\bjava\b/i.test(react.resolution.informationNeed));
check("verification follows the newest fact", reactVerify.intent === "current_information" && /react/i.test(reactVerify.resolution.informationNeed) && !/\bjava\b/i.test(reactVerify.resolution.informationNeed));

const loopsCalls = [];
const loops = turn("Explain loops.");
await loadFriendAnswerContext({
  intent: loops.intent,
  effectiveText: "Explain loops.",
  topic: loops.resolution.topic,
  searchWeb: async (query) => {
    loopsCalls.push(query);
    return evidence;
  },
});
check("stable explanation does not search the web", loops.intent !== "current_information" && loopsCalls.length === 0);

const node = turn("What is the current Node.js version?");
check("explicit current version searches", node.intent === "current_information" && /node/i.test(node.resolution.informationNeed) && /version/i.test(node.resolution.informationNeed));

const failed = await loadFriendAnswerContext({
  intent: "current_information",
  effectiveText: "latest version java",
  searchQuery: "latest version java",
  searchWeb: async () => {
    throw new Error("search unavailable");
  },
});
const failedReply = await replyAsInterviewFriend({
  userId: "web-check",
  message: javaQuestion,
  conversationContext: [],
  mode: "general",
  searchWeb: async () => [],
});
check("failed search returns no web results", failed.web.length === 0);
check("failed search does not invent a current fact", failedReply.answer === UNVERIFIED_CURRENT_FACT && !/\b\d{2,}\b/.test(failedReply.answer));

const conflict = formatCurrentInformationContext([
  { title: "Release one", url: "https://example.com/one", snippet: "The current release is 24.", domain: "example.com" },
  { title: "Release two", url: "https://example.com/two", snippet: "The current release is 21.", domain: "example.org" },
], { currentInformation: true });
check("conflicting sources are both shown", conflict.includes("https://example.com/one") && conflict.includes("https://example.com/two") && /sources disagree/i.test(conflict) && !conflict.includes("https://example.com/invented"));

const missing = enforceCurrentEvidence("The latest version is 19.", [{ title: "Project overview", url: "https://example.com/overview", snippet: "Documentation home." }]);
check("missing evidence does not keep an invented current value", !/\b19\b/.test(missing) && /do not confirm/i.test(missing));

const explained = turn("explain it in hinglish", historyFrom([javaQuestion]));
const simpler = turn("make it simple", historyFrom([javaQuestion]));
const example = turn("give me an example", historyFrom([javaQuestion]));
check("language rewrite stays a follow-up", explained.intent === "follow_up" && explained.resolution.transform === true);
check("simpler rewrite stays a follow-up", simpler.intent === "follow_up");
check("example request stays a follow-up", example.intent === "follow_up" && example.intent !== "current_information");

const product = turn("How does InterviewIQ face analysis work?");
check("product question still uses knowledge", product.intent === "rag_required" && shouldRetrieveFriendKnowledge(product.intent, product.resolution.resolvedText));
check("named resource request is unchanged", turn("Give me that playlist").intent === "resource_request");

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend web conversation checks passed.");
