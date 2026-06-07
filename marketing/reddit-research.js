const queries = [
  '"too many documents"',
  '"summarize long document"',
  '"meeting notes" "action items"',
  '"clean up notes"',
  '"turn notes into summary"',
  '"email thread summary"',
  '"AI summarizer" "action items"'
];

const subreddits = [
  "productivity",
  "freelance",
  "smallbusiness",
  "Entrepreneur",
  "consulting",
  "projectmanagement",
  "GetStudying",
  "GradSchool",
  "Notion",
  "ObsidianMD",
  "ChatGPT",
  "SaaS",
  "SideProject",
  "buildinpublic"
];

function searchUrl(query, subreddit) {
  const scoped = subreddit ? `subreddit:${subreddit} ${query}` : query;
  return `https://www.reddit.com/search/?q=${encodeURIComponent(scoped)}&sort=new&t=month`;
}

function draftReply({ title, url }) {
  return {
    title,
    url,
    reply:
      "I’d handle this by extracting four things: the short summary, action items, open risks, and a clean copy-ready version. That keeps the output useful instead of just shorter. Disclosure: I’m building BriefTidy, a small tool for this paste-in, structured-brief workflow, so I’m biased. I’d only mention it here because it matches the problem you described."
  };
}

function main() {
  const targets = [];
  for (const subreddit of subreddits) {
    for (const query of queries) {
      targets.push({
        subreddit: `r/${subreddit}`,
        query,
        searchUrl: searchUrl(query, subreddit)
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        product: "BriefTidy",
        rule: "Research and draft only. Do not auto-post. Get explicit approval before any reply is posted.",
        targets,
        sampleDraft: draftReply({
          title: "Example target post",
          url: "https://www.reddit.com/"
        })
      },
      null,
      2
    )
  );
}

main();
