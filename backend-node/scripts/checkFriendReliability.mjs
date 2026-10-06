import { retrieveFriendKnowledge } from "../src/services/friendRetrieval.js";
import { sameResourceSearchQuery } from "../src/services/interviewFriend.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

function hang() {
  return new Promise(() => {});
}

check("same resource query matches after spacing and case changes", sameResourceSearchQuery("Lecture   20", "lecture 20"));
check("different resource query still searches", !sameResourceSearchQuery("lecture 20", "lecture 21"));
check("empty prior query does not block a search", !sameResourceSearchQuery("", "lecture 20"));

const embedStarted = Date.now();
let embedCalls = 0;
let vectorCalls = 0;
const embedFallback = await retrieveFriendKnowledge("Interview Friend voice", 4, {
  embed: () => {
    embedCalls += 1;
    return hang();
  },
  searchVectors: () => {
    vectorCalls += 1;
    return hang();
  },
});
const embedElapsed = Date.now() - embedStarted;
check("embedding timeout uses lexical fallback", embedFallback.some((item) => /interview friend/i.test(item.title)));
check("embedding timeout does not search vectors or retry", embedCalls === 1 && vectorCalls === 0 && embedElapsed < 12000);
check("embedding timeout does not return an error", embedFallback.every((item) => !item.error && !/timed out|gemini|supabase/i.test(JSON.stringify(item))));

const vectorStarted = Date.now();
embedCalls = 0;
vectorCalls = 0;
const vectorFallback = await retrieveFriendKnowledge("Interview Friend voice", 4, {
  embed: async () => {
    embedCalls += 1;
    return Array.from({ length: 768 }, () => 0);
  },
  searchVectors: () => {
    vectorCalls += 1;
    return hang();
  },
});
const vectorElapsed = Date.now() - vectorStarted;
check("vector timeout uses lexical fallback", vectorFallback.some((item) => /interview friend/i.test(item.title)));
check("vector timeout embeds once and does not retry", embedCalls === 1 && vectorCalls === 1 && vectorElapsed < 12000);

const thrown = await retrieveFriendKnowledge("Interview Friend voice", 4, {
  embed: async () => {
    throw new Error("provider key=secret failed");
  },
});
check("embedding failure uses lexical fallback", thrown.some((item) => /interview friend/i.test(item.title)));
check("provider error is not included in the fallback", thrown.every((item) => !/secret|provider/i.test(JSON.stringify(item))));

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend reliability checks passed.");
