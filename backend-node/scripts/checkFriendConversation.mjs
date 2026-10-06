import { buildFriendMemory, resolveFriendReference, routeFriendIntent } from "../src/services/friendContext.js";
import { friendAnswerInstructions, replyAsInterviewFriend } from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function turn(message, history = []) {
  const memory = buildFriendMemory(history);
  const resolution = resolveFriendReference(message, memory);
  return {
    resolution,
    intent: routeFriendIntent(message, resolution),
  };
}

const plant = [{ role: "user", content: "What is photosynthesis?" }, { role: "assistant", content: "Photosynthesis stores energy in plants." }];
const explained = turn("explain it", plant);
check("generic explain-it stays on the previous topic", explained.resolution.mode === "follow_up" && /photosynthesis/i.test(explained.resolution.resolvedText));
check("generic explain-it is not a new question", explained.intent === "follow_up" && explained.resolution.transform !== true);

const rewritten = turn("can you rewrite this in korean", plant);
const rewriteGuide = friendAnswerInstructions({
  resolution: rewritten.resolution,
  previousAnswer: "Photosynthesis stores energy in plants.",
});
check("language change keeps the previous topic", rewritten.resolution.mode === "follow_up" && /photosynthesis/i.test(rewritten.resolution.topic));
check("language change does not become the new subject", !/^korean$/i.test(rewritten.resolution.topic) && /korean/i.test(rewritten.resolution.resolvedText));
check("language change transforms the previous answer", rewritten.resolution.transform === true && /previous answer:/i.test(rewriteGuide) && /photosynthesis stores energy/i.test(rewriteGuide));
check("language change does not define the requested style", /do not explain the language or style itself/i.test(rewriteGuide));
check("language change separates subject, answer, and transformation", /active subject:/i.test(rewriteGuide) && /requested transformation:/i.test(rewriteGuide) && /keeping the same subject and meaning/i.test(rewriteGuide));

const heap = [{ role: "user", content: "What is a binary heap?" }];
const example = turn("give an example", heap);
check("example request stays on the previous topic", example.resolution.mode === "follow_up" && /binary heap/i.test(example.resolution.resolvedText));

const cell = [{ role: "user", content: "What is osmosis?" }];
const simpler = turn("make it simpler", cell);
check("simpler request stays on the previous topic", simpler.resolution.mode === "follow_up" && /osmosis/i.test(simpler.resolution.topic));

const constrained = turn("explain closures in ruby");
const constrainedGuide = friendAnswerInstructions({ resolution: constrained.resolution });
check("domain constraint stays in the subject", constrained.resolution.mode === "new" && /closures/i.test(constrained.resolution.topic) && /ruby/i.test(constrained.resolution.topic));
check("domain constraint is repeated to the answer model", /closures in ruby/i.test(constrainedGuide) && /do not replace the requested subject/i.test(constrainedGuide));

const afterOther = turn("explain closures in ruby", plant);
check("a constrained new subject does not stick to the previous topic", afterOther.resolution.mode === "new" && /ruby/i.test(afterOther.resolution.topic) && !/photosynthesis/i.test(afterOther.resolution.topic));

const premise = turn("explain garbage collection in html");
const premiseGuide = friendAnswerInstructions({ resolution: premise.resolution });
check("incorrect premise keeps the requested domain", premise.resolution.mode === "new" && /garbage collection/i.test(premise.resolution.topic) && /html/i.test(premise.resolution.topic));
check("incorrect premise is instructed to be corrected", /correct the premise/i.test(premiseGuide) && /closest relevant concept/i.test(premiseGuide) && /garbage collection in html/i.test(premiseGuide));

const missing = turn("explain it");
check("missing context asks for clarification", missing.resolution.mode === "clarify" && missing.intent === "clarify" && !missing.resolution.topic);

const missingStyle = turn("rewrite it in swahili");
check("a style request without context is not a new subject", missingStyle.resolution.mode === "clarify" && !/swahili/i.test(missingStyle.resolution.topic || ""));

const switched = [
  { role: "user", content: "What is capillary action?" },
  { role: "assistant", content: "Capillary action draws liquid through a narrow space." },
  { role: "user", content: "What is a hash table?" },
  { role: "assistant", content: "A hash table maps keys to values." },
];
const shifted = turn("explain this in tamil", switched);
const shiftedGuide = friendAnswerInstructions({
  resolution: shifted.resolution,
  previousAnswer: "A hash table maps keys to values.",
});
check("transformation after a topic switch uses the new topic", shifted.resolution.mode === "follow_up" && /hash table/i.test(shifted.resolution.topic) && !/capillary/i.test(shifted.resolution.topic));
check("transformation after a topic switch rewrites the new answer", shifted.resolution.transform === true && /hash table maps keys/i.test(shiftedGuide) && /tamil/i.test(shifted.resolution.resolvedText));

const hoistingAnswer = "Hoisting moves declarations so they can be used earlier in the same scope. It does not move initial values.";
const hoisting = [
  { role: "user", content: "explain hoisting in programming" },
  { role: "assistant", content: hoistingAnswer },
];
const hinglish = turn("can you explain in hinglish", hoisting);
const hinglishGuide = friendAnswerInstructions({
  resolution: hinglish.resolution,
  previousAnswer: hoistingAnswer,
});
const hinglishSubject = hinglishGuide.split("\n").find((line) => /^active subject:/i.test(line)) || "";
check("style rewrite keeps the programming topic", hinglish.resolution.mode === "follow_up" && hinglish.resolution.transform === true && /hoisting in programming/i.test(hinglish.resolution.topic));
check("style name is the transformation, not the subject", !/hinglish/i.test(hinglish.resolution.topic) && !/hinglish/i.test(hinglishSubject) && /hinglish/i.test(hinglishGuide.split("\n").find((line) => /^requested transformation:/i.test(line)) || ""));
check("style rewrite keeps the previous wording and technical terms", /hoisting moves declarations/i.test(hinglishGuide) && /original form/i.test(hinglishGuide) && /new heading or question/i.test(hinglishGuide));
check("style rewrite keeps a corrected premise and skips an extra question", /corrected meaning/i.test(hinglishGuide) && /followUpQuestion empty/i.test(hinglishGuide));

const explainedMe = turn("can you explain me hoisting in programming");
check("leading filler is not stored as the topic", explainedMe.resolution.mode === "new" && /^hoisting in programming$/i.test(explainedMe.resolution.topic));

const search = [{ role: "user", content: "explain binary search" }, { role: "assistant", content: "Binary search halves a sorted range until it finds the target." }];
const simple = turn("make it simple", search);
check("manner rewrite stays on the current topic", simple.resolution.transform === true && /binary search/i.test(simple.resolution.topic) && !/^simple$/i.test(simple.resolution.topic));

const effect = [{ role: "user", content: "explain React useEffect" }, { role: "assistant", content: "useEffect runs side effects after React renders a component." }];
const hindi = turn("explain it in Hindi", effect);
const hindiSubject = (hindi.resolution.topic || "");
check("language rewrite keeps the framework topic", hindi.resolution.transform === true && /react useeffect/i.test(hindiSubject) && !/^hindi$/i.test(hindiSubject));

const noTopic = turn("can you explain in hinglish");
check("style rewrite without a topic asks for clarification", noTopic.resolution.mode === "clarify" && noTopic.intent === "clarify" && !/hinglish/i.test(noTopic.resolution.topic || ""));

check("named resource request is unchanged", turn("Give me that playlist").intent === "resource_request");

const clarified = await replyAsInterviewFriend({
  userId: "conversation-check",
  message: "explain it",
  conversationContext: [],
  mode: "general",
});
check("ambiguous reply asks which subject to use", /which subject should i use/i.test(clarified.answer));
check("ambiguous reply does not guess a subject", !/photosynthesis|closures|korean|ruby/i.test(clarified.answer));

function extend(history, message) {
  return [...history, { role: "user", content: message }, { role: "assistant", content: "Noted." }];
}

const playlist = "give me a youtube playlist dsa with java by babbar";
let series = [];
const opened = turn(playlist, series);
series = extend(series, playlist);
check("playlist request establishes an active resource", opened.intent === "resource_request" && opened.resolution.resourceType === "playlist" && /dsa/i.test(opened.resolution.topic) && /java/i.test(opened.resolution.topic) && /babbar/i.test(opened.resolution.topic));

function expectsSeriesItem(result, item) {
  const query = `${result.resolution.query || ""} ${result.resolution.resolvedText || ""}`;
  return result.intent === "resource_request"
    && result.resolution.item === item
    && new RegExp(`lecture ${item}\\b`, "i").test(query)
    && /dsa/i.test(query)
    && /java/i.test(query)
    && /babbar/i.test(query)
    && !/^lecture \d+$/i.test(String(result.resolution.query || "").trim());
}

const lecture18 = turn("give me lecture 18", series);
check("lecture 18 follows the active resource", expectsSeriesItem(lecture18, 18));
series = extend(series, "give me lecture 18");
const lectureNo = turn("give me lecture no 18", series);
check("lecture no 18 follows the active resource", expectsSeriesItem(lectureNo, 18));
const lecture19 = turn("lecture 19", series);
check("lecture 19 stays on the same resource", expectsSeriesItem(lecture19, 19));
const wali = turn("18 wali lecture bhejo", series);
check("numbered lecture wording stays on the same resource", expectsSeriesItem(wali, 18));

const version = turn("what is Java 21?", series);
check("a numbered technology question is not a lecture", version.intent !== "resource_request" && version.resolution.item == null && /java 21/i.test(version.resolution.topic));

let switchedSeries = extend([], "give me Babbar Java DSA playlist");
switchedSeries = extend(switchedSeries, "what is React?");
const explainedReact = turn("explain it", switchedSeries);
check("a topic switch keeps the new subject", explainedReact.intent === "follow_up" && /react/i.test(explainedReact.resolution.topic) && explainedReact.resolution.mode !== "resource");
const restored = turn("Babbar wali lecture 19 bhejo", switchedSeries);
check("naming the earlier resource returns to it", restored.intent === "resource_request" && restored.resolution.mode === "restore" && restored.resolution.item === 19 && /babbar/i.test(restored.resolution.query) && /lecture 19/i.test(restored.resolution.query));

const unknownLecture = turn("give me lecture 18");
check("a lecture number without a resource asks which one", unknownLecture.resolution.mode === "clarify" && unknownLecture.intent === "clarify");

const searches = [];
const found = await replyAsInterviewFriend({
  userId: "conversation-check",
  message: "give me lecture 18",
  conversationContext: series,
  mode: "general",
  searchVideos: async ({ query }) => {
    searches.push(query);
    return [{ kind: "video", videoId: "lecture-check", title: "Lecture 18", url: "https://www.youtube.com/watch?v=lecture-check" }];
  },
});
check("lecture follow-up searches the active resource and item", searches.length === 1 && /lecture 18/i.test(searches[0]) && /dsa/i.test(searches[0]) && /babbar/i.test(searches[0]));
check("lecture follow-up does not answer before the resource search", !/don'?t have information|do not have information|there is no lecture/i.test(found.answer));

const unnamed = await replyAsInterviewFriend({
  userId: "conversation-check",
  message: "give me lecture 18",
  conversationContext: [],
  mode: "general",
  searchVideos: async () => {
    throw new Error("search should not run without a resource");
  },
});
check("a lecture number without a resource does not invent one", /which playlist or course/i.test(unnamed.answer));

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend conversation checks passed.");
