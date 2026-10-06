import { formatCurrentInformationContext, loadFriendAnswerContext } from "../src/services/interviewFriend.js";
import { formatFriendKnowledgeContext } from "../src/services/friendRetrieval.js";

const failures = [];

function check(name, ok) {
  if (!ok) failures.push(name);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
}

const listedUrl = "https://example.com/fresh-fact";
const otherUrl = "https://example.com/not-returned";
const supporting = formatCurrentInformationContext(
  [{ title: "Current release notes", url: listedUrl }],
  { currentInformation: true }
);
check("supporting result is included", supporting.includes("Current release notes") && supporting.includes(listedUrl));
check("supporting result is the only fresh-fact evidence", /only evidence available for current or fresh facts/i.test(supporting));
check("supporting result forbids guessed fresh values", /do not guess values/i.test(supporting));
check("unlisted URL is not added", !supporting.includes(otherUrl));

const unrelated = formatCurrentInformationContext(
  [{ title: "Unrelated page", url: listedUrl }],
  { currentInformation: true }
);
check("incomplete result says not to confirm a missing detail", /do not confirm it/i.test(unrelated));
check("incomplete result still limits URLs to the list", unrelated.includes(listedUrl) && !unrelated.includes(otherUrl));

const empty = formatCurrentInformationContext([], { currentInformation: true });
check("empty search does not confirm fresh facts", /do not state a current or fresh fact as confirmed/i.test(empty));
check("empty search does not claim a search occurred", /do not claim that a web search was performed/i.test(empty));
check("empty search includes no URL", !/https?:\/\//i.test(empty));

const failedSearch = await loadFriendAnswerContext({
  intent: "current_information",
  effectiveText: "What is the current public figure?",
  topic: "figure",
  searchWeb: async () => {
    throw new Error("search unavailable");
  },
});
const failed = formatCurrentInformationContext(failedSearch.web, { currentInformation: true });
check("failed search leaves no web results", failedSearch.web.length === 0);
check("failed search uses the no-evidence instruction", failed === empty);

const stable = formatCurrentInformationContext([], { currentInformation: false });
check("stable question adds no web grounding", stable === "");

const knowledge = formatFriendKnowledgeContext([{ title: "Product note", content: "Existing product behavior." }]);
check("product knowledge instructions stay separate", /trusted product context/i.test(knowledge) && !/web results/i.test(knowledge));

if (failures.length) {
  console.log(`Failed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("All Interview Friend web-grounding checks passed.");
