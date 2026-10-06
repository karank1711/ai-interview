import { buildFriendMemory, resolveFriendReference, routeFriendIntent } from "../src/services/friendContext.js";
import {
  allowsFollowUpQuestion,
  enforceCurrentEvidence,
  formatCurrentInformationContext,
  friendAnswerInstructions,
  requestedAnswerScope,
} from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function turn(message, history = []) {
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(message, memory);
  return { resolution, intent: routeFriendIntent(message, resolution) };
}

function guide(message, resolution = { mode: "new", topic: "" }) {
  return friendAnswerInstructions({ resolution, message, mode: "general" });
}

const versionQuestion = "what is the react new version";
const versionRoute = turn(versionQuestion);
const evidence = [{ title: "The current release is 19.2", url: "https://example.com/releases" }];
const grounded = formatCurrentInformationContext(evidence, { currentInformation: true });
const staleAnswer = enforceCurrentEvidence("React 18 is the latest version.", evidence);
const supportedAnswer = enforceCurrentEvidence("The current release is 19.2.", evidence);

check("fresh version question uses current information", versionRoute.intent === "current_information");
check("fresh version question keeps the returned evidence", grounded.includes("19.2") && /only evidence available for current or fresh facts/i.test(grounded));
check("fresh version question does not keep a stale value", !/\b18\b/.test(staleAnswer) && /19\.2/.test(staleAnswer) && /older knowledge/i.test(staleAnswer));
check("fresh version question can keep a value that the evidence states", supportedAnswer === "The current release is 19.2.");

const weakEvidence = [{ title: "Project overview", url: "https://example.com/overview" }];
const unconfirmed = enforceCurrentEvidence("The latest version is 18.", weakEvidence);
const weakGuide = formatCurrentInformationContext(weakEvidence, { currentInformation: true });
check("weak evidence does not keep an invented current value", !/\b18\b/.test(unconfirmed) && /available search results do not confirm/i.test(unconfirmed));
check("weak evidence forbids filling the fact from memory", /do not fill missing fresh details from memory/i.test(weakGuide) && /earlier knowledge/i.test(weakGuide));

const simple = "can you explain me loops";
const simpleGuide = guide(simple, turn(simple).resolution);
check("simple explanation stays concise", requestedAnswerScope(simple) === "concise" && /concise direct answer/i.test(simpleGuide));
check("simple explanation does not request every type", /do not add a tutorial, every type or category/i.test(simpleGuide) && !/the user asked for detail/i.test(simpleGuide));

const detailed = "explain loops in detail";
const detailedGuide = guide(detailed, turn(detailed).resolution);
check("detail request asks for a fuller explanation", requestedAnswerScope(detailed) === "detail" && /fuller explanation/i.test(detailedGuide));

const types = "what are the types of loops?";
const typesGuide = guide(types, turn(types).resolution);
check("type request focuses on types", requestedAnswerScope(types) === "types" && /focus the answer on those types/i.test(typesGuide));

const examples = "give me examples of loops";
const examplesGuide = guide(examples, turn(examples).resolution);
check("example request focuses on examples", requestedAnswerScope(examples) === "examples" && /focus the answer on examples/i.test(examplesGuide));

const simpler = turn("explain it simply", [
  { role: "user", content: "can you explain me loops" },
  { role: "assistant", content: "A loop repeats a block of instructions." },
]);
check("style follow-up keeps the current topic", simpler.resolution.mode === "follow_up" && /loops/i.test(simpler.resolution.topic) && !/simply/i.test(simpler.resolution.topic));
check("style follow-up changes depth without a new subject", requestedAnswerScope("explain it simply") === "concise" && simpler.intent === "follow_up");

check("simple answer does not allow an automatic follow-up", allowsFollowUpQuestion("general", simple) === false && /do not end with a follow-up question/i.test(simpleGuide));

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend answer-quality checks passed.");
