/**
 * LinkedLess — THE CATALOG
 *
 * This file is data, not logic. Every entry describes one kind of LinkedIn
 * post and how to recognise it.
 *
 * A genre does NOT decide what a card says. Card text is written by
 * src/engine/compress.js out of the post's own sentences. A genre decides two
 * things only:
 *
 *   1. Whether the sensitive rail applies (`rail: true`). Rail posts are
 *      trimmed from the top rather than filtered, because deciding a sentence
 *      in someone's obituary scores badly is not a judgement worth making.
 *      This is the load-bearing use, and the reason the catalog still exists.
 *   2. Which family the post is muted under, for the family toggles in
 *      Settings.
 *
 * ─── Entry shape ────────────────────────────────────────────────────────
 *   id          stable snake_case identifier, also the corpus label
 *   family      F0–F10, drives precedence and the mute toggles
 *   intent      what the author wants from you, or null (informational only)
 *   substance   0–3, how much verifiable information the post carries
 *   rail        true = trim, never filter; see above
 *   detect      { all?, any?, none? } of predicates, all must hold
 *   examples    sample posts; also seed corpus/posts.seed.jsonl
 *
 * ─── Predicates ─────────────────────────────────────────────────────────
 *   { phrase: [...] }        any substring present in the body
 *   { regex: "..." }         case-insensitive regex over the body
 *   { capture: "MONEY" }     that Layer D capture is non-null
 *   { native: "poll" }       Layer A DOM signal is set
 *   { flag: "companyMismatch" }
 *   { structure: { wordCount: { min: 20 } } }
 *   { score: { slop: { min: 60 } } }
 *   { and: [...] } / { or: [...] }   compose the above
 *
 * Writing a regex for a language with accents? JavaScript's \b is ASCII-only,
 * so /\bcomentá\b/ never matches. Use (?:^|[^\wÀ-ÿ]) and (?![\wÀ-ÿ]).
 *
 * Precedence runs low-to-high: F0 (the sensitive rail) wins over everything,
 * F10 (fallback) loses to everything.
 */

(function () {
  var _global = typeof window !== "undefined" ? window : {};
  var ns = (_global._ll = _global._ll || {});

  var FAMILIES = {
    F0: { precedence: 0,  label: "Sensitive",    tone: "quiet" },
    F9: { precedence: 10, label: "Substance",    tone: "plain" },
    F1: { precedence: 20, label: "Format",       tone: "neutral" },
    F3: { precedence: 30, label: "Hiring",       tone: "neutral" },
    F2: { precedence: 40, label: "Announcement", tone: "neutral" },
    F4: { precedence: 50, label: "Reach farming", tone: "blunt" },
    F5: { precedence: 60, label: "Narrative",    tone: "blunt" },
    F7: { precedence: 65, label: "Newsjacking",  tone: "blunt" },
    F6: { precedence: 70, label: "Opinion",      tone: "blunt" },
    F8: { precedence: 80, label: "Promotion",    tone: "blunt" },
    F10:{ precedence: 90, label: "Unclassified", tone: "plain" },
  };

  var CATALOG = [

    // ─────────────────────────────────────────────────────────────────────
    // F0 · SENSITIVE RAIL
    // Evaluated first and short-circuits everything below. No intent is ever
    // inferred here, no matter what else the post matches. A false negative
    // in this family is a release blocker.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "bereavement", family: "F0", intent: null, substance: 1, rail: true,
      detect: { any: [
        { phrase: ["passed away", "rest in peace", "rest in power", "in loving memory",
                   "my condolences", "our condolences", "the funeral", "obituary",
                   "celebration of life", "no longer with us", "left us too soon",
                   "sudden passing", "untimely passing"] },
        { and: [
          { regex: "\\b(died|death|passing|we lost|lost (his|her|their) life|took (his|her|their) own life)\\b" },
          { phrase: ["heartbroken", "heavy heart", "condolences", "our thoughts",
                     "will be missed", "devastated", "mourning", "the loss of",
                     "he was", "she was", "survived by", "gone too soon", "rest well",
                     "sad news", "difficult news"] },
        ] },
      ] },
      examples: ["It is with a heavy heart that I share that my mentor John Reeves passed away last night."],
    },
    {
      id: "illness_health", family: "F0", intent: null, substance: 1, rail: true,
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [
          { phrase: ["my diagnosis", "was diagnosed", "chemotherapy", "chemo", "my surgery",
                     "cancer treatment", "in remission", "my recovery from", "mental health crisis",
                     "my burnout", "hospitalised", "hospitalized", "medical leave", "sick leave"] },
          { regex: "\\b(a stroke|heart attack|tumou?r|leukemia|leukaemia|lymphoma|icu|intensive care|palliative|hospice|transplant|seizures?|relapse|chronic illness|long covid)\\b" },
        ],
        none: [
          { phrase: ["caring for my", "my dad", "my father", "my mum", "my mom", "my mother",
                     "my wife", "my husband", "my partner's", "my son", "my daughter"] },
        ],
      },
      examples: ["Three months ago I was diagnosed with stage 2 lymphoma. I start chemo on Monday."],

    },
    {
      id: "layoff_self", family: "F0", intent: "job", substance: 2, rail: true,
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [
          { phrase: ["i was impacted by", "impacted by the recent", "my role was eliminated",
                     "my position was eliminated", "i was laid off", "i was made redundant",
                     "part of the layoffs", "affected by the layoffs", "let go from"] },
        ],
      },
      examples: ["After 6 years, I was impacted by the recent layoffs at Twilio. Open to what comes next."],
    },
    {
      id: "layoff_company", family: "F0", intent: null, substance: 2, rail: true,
      detect: { any: [
        { and: [
          { phrase: ["layoffs", "reducing our headcount", "reduction in force", "letting go of",
                     "difficult decision to", "parting ways with some", "restructuring our team",
                     "roles were eliminated", "we are reducing", "downsizing"] },
          { regex: "\\b(we|our team|the company|today we|yesterday we)\\b" },
        ] },
        { and: [
          { phrase: ["said goodbye to", "saying goodbye to", "had to let go", "we lost"] },
          { regex: "\\b(\\d+|many|several|some|dozens of|hundreds of)\\s+(colleagues|teammates|team members|people|employees|roles|of our)\\b" },
        ] },
      ] },
      examples: ["Today we made the difficult decision to reduce our headcount by 15%."],
    },
    {
      id: "personal_crisis", family: "F0", intent: null, substance: 1, rail: true,
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [{ phrase: ["my divorce", "my separation", "caring for my", "my caregiving",
                         "lost my home", "my house burned", "i hit rock bottom", "suicidal",
                         "my father's illness", "my mother's illness"] }],
      },
      examples: ["I have not posted in a while. I have been caring for my father full time since March."],
    },
    {
      id: "tribute_memorial", family: "F0", intent: null, substance: 1, rail: true,
      detect: { any: [
        { phrase: ["in memory of", "in loving memory", "remembering", "one year ago we lost",
                   "anniversary of his death", "anniversary of her death", "a tribute to"] },
      ] },
      examples: ["In memory of Ana Duarte, who taught half this industry how to write."],
    },
    {
      id: "disaster_solidarity", family: "F0", intent: null, substance: 1, rail: true,
      detect: { all: [
        { phrase: ["earthquake", "hurricane", "wildfire", "flooding", "the shooting",
                   "the war in", "humanitarian crisis", "the attacks in", "the tragedy in"] },
        { phrase: ["our thoughts", "thinking of", "solidarity", "donate", "relief efforts",
                   "affected", "victims", "support"] },
      ] },
      examples: ["Our thoughts are with everyone affected by the earthquake in Antakya."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F1 · NATIVE FORMATS
    // Signals LinkedIn hands us directly in the DOM. Near-100% accurate and
    // immune to changes in how people write.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "promoted_ad", family: "F1", intent: "sell", substance: 0,
      detect: { all: [{ native: "promoted" }] },
      examples: ["Promoted — Ship faster with Acme CI. Start your free trial."],
    },
    {
      id: "poll", family: "F1", intent: "reach", substance: 0,
      detect: { all: [{ native: "poll" }] },
      examples: ["What matters most in a first engineering hire? Speed / Depth / Attitude"],
    },
    {
      id: "carousel_document", family: "F1", intent: "reach", substance: 1,
      detect: { all: [{ native: "document" }] },
      examples: ["The 9 slides every seed deck needs. Swipe →"],
    },
    {
      id: "native_video", family: "F1", intent: null, substance: 1,
      detect: { all: [{ native: "video" }] },
      examples: ["Watch how we rebuilt onboarding in four weeks."],
    },
    {
      id: "article_newsletter", family: "F1", intent: "reach", substance: 1,
      detect: { all: [{ native: "newsletter" }] },
      examples: ["New edition of The Growth Memo is out — this week, pricing experiments."],
    },
    {
      id: "event_promo", family: "F1", intent: "attend", substance: 1,
      detect: { any: [
        { native: "event" },
        { phrase: ["register now", "save your seat", "join us live", "doors open",
                   "rsvp", "limited spots", "sign up here"] },
      ],
        none: [{ phrase: ["webinar", "masterclass", "free training", "free workshop"] }],
      },
      examples: ["Join us live on Oct 14 for a teardown of five B2B onboarding flows. Register now."],
    },
    {
      id: "job_posting_native", family: "F1", intent: "candidates", substance: 3,
      detect: { all: [{ native: "job" }] },
      examples: ["Acme is hiring a Senior Backend Engineer — Remote, EU."],
    },
    {
      id: "celebration_template", family: "F1", intent: "validation", substance: 1,
      detect: { any: [
        { native: "celebration" },
        { phrase: ["congratulate", "congratulations to", "congrats to", "please join me in welcoming",
                   "excited to welcome"] },
      ] },
      examples: ["Please join me in welcoming Marta Ruiz to the team as Head of Design!"],
    },
    {
      id: "reshare_bare", family: "F1", intent: "reach", substance: 0,
      detect: { all: [{ native: "reshare" }, { structure: { wordCount: { max: 12 } } }] },
      examples: ["♻️"],
    },
    {
      id: "reshare_commented", family: "F1", intent: null, substance: 1,
      detect: { all: [{ native: "reshare" }, { structure: { wordCount: { min: 13 } } }] },
      examples: ["Worth reading. The section on pricing tiers matches what we saw last quarter."],
    },
    {
      id: "feed_injection", family: "F1", intent: null, substance: 0,
      detect: { all: [{ native: "injection" }] },
      examples: ["Dan Alvarez commented on this"],
    },
    {
      id: "link_share", family: "F1", intent: "inform", substance: 2,
      detect: { all: [{ capture: "URL_DOMAIN" }, { structure: { wordCount: { max: 60 } } }] },
      examples: ["Good breakdown of the new EU AI rules: https://example.com/ai-act-summary"],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F2 · ANNOUNCEMENTS & STATUS
    // Something genuinely happened. The template states it and stops; most
    // of these carry real information and don't need commentary.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "new_job_announce", family: "F2", intent: "validation", substance: 2,
      detect: {
        all: [{ phrase: ["excited to announce", "thrilled to announce", "happy to announce",
                         "excited to share", "thrilled to share", "delighted to share",
                         "proud to share", "pleased to announce", "new chapter", "i'm joining",
                         "i am joining", "i've accepted", "i have accepted", "day one at",
                         "first day at", "starting a new"] }],
        any: [{ phrase: ["joining", "accepted", "new role", "new chapter", "new adventure",
                         "started", "starting", "day one", "first day", "as their", "as the new"] }],
        none: [{ phrase: ["hiring", "we're looking for", "open role"] }],
      },
      examples: ["Excited to share that I'm joining Stripe as a Staff Product Designer."],
    },
    {
      id: "promotion_announce", family: "F2", intent: "validation", substance: 2,
      detect: { any: [
        { phrase: ["i've been promoted", "i have been promoted", "promoted to",
                   "stepping into the role", "stepping up as", "taking on the role of",
                   "now leading", "moving into the role"] },
      ] },
      examples: ["Humbled to share that I've been promoted to Director of Engineering at Acme."],
    },
    {
      id: "work_anniversary", family: "F2", intent: "validation", substance: 1,
      detect: { all: [
        { phrase: ["work anniversary", "years at", "years with", "anniversary at",
                   "years ago today i joined", "year at"] },
        { capture: "DURATION" },
      ] },
      examples: ["5 years at Datadog today. What a journey it has been."],
    },
    {
      id: "funding_announce", family: "F2", intent: "validation", substance: 3,
      detect: {
        all: [
          { phrase: ["raised", "closed our", "we've raised", "we have raised", "funding round",
                     "led our round", "backed by", "our seed", "our series"] },
        ],
        any: [{ capture: "MONEY" }, { capture: "ROUND" }],
      },
      examples: ["We've raised a $12M Series A led by Sequoia to rebuild B2B onboarding."],
    },
    {
      id: "acquisition_announce", family: "F2", intent: "validation", substance: 3,
      detect: { any: [
        { phrase: ["has been acquired", "we've been acquired", "we have been acquired",
                   "acquired by", "we're acquiring", "we have acquired", "joining forces with",
                   "signed the acquisition"] },
      ] },
      examples: ["Big news: Loom has been acquired by Atlassian."],
    },
    {
      id: "award_recognition", family: "F2", intent: "validation", substance: 1,
      detect: { any: [
        { phrase: ["honored to be named", "honoured to be named", "humbled to be named",
                   "recognized as", "recognised as", "named to the", "made the list",
                   "won the award", "award winner", "top 50", "top 100", "30 under 30",
                   "40 under 40", "voted best"] },
      ] },
      examples: ["Humbled to be named to the Forbes 30 Under 30 list this year."],
    },
    {
      id: "certification_course", family: "F2", intent: "validation", substance: 1,
      detect: { any: [
        { phrase: ["i'm now certified", "just earned my", "completed the certification",
                   "passed my", "earned my certificate", "completed the course",
                   "finished the program", "graduated from the"] },
      ] },
      examples: ["Just earned my AWS Solutions Architect certification after 3 months of study."],
    },
    {
      id: "milestone_metric", family: "F2", intent: "validation", substance: 2,
      detect: {
        all: [{ phrase: ["we just hit", "we just crossed", "just crossed", "just passed",
                         "we reached", "milestone", "we hit our", "officially at"] }],
        any: [{ capture: "MONEY" }, { capture: "PERCENT" }, { capture: "NUMBER" }],
      },
      examples: ["We just crossed $1M ARR, 26 months after launch."],
    },
    {
      id: "launch_announce", family: "F2", intent: "sell", substance: 2,
      detect: { any: [
        { phrase: ["we're launching", "we are launching", "launching today", "is live",
                   "now available", "introducing", "we just shipped", "out now",
                   "ships today", "general availability"] },
      ] },
      examples: ["Introducing Acme Flow — the fastest way to wire up an approval chain. Live today."],
    },
    {
      id: "speaking_appearance", family: "F2", intent: "attend", substance: 1,
      detect: { any: [
        { phrase: ["excited to speak at", "i'll be speaking at", "speaking at", "keynote at",
                   "join me at", "catch me at", "i'm on the panel", "presenting at"] },
      ] },
      examples: ["Excited to speak at SaaStr Annual next month on pricing for PLG companies."],
    },
    {
      id: "press_feature", family: "F2", intent: "validation", substance: 1,
      detect: { any: [
        { phrase: ["featured in", "was interviewed by", "covered by", "my piece in",
                   "wrote about us", "our story in", "made the cover"] },
      ] },
      examples: ["Grateful to be featured in TechCrunch this morning talking about the raise."],
    },
    {
      id: "book_release", family: "F2", intent: "sell", substance: 2,
      detect: { any: [
        { phrase: ["my book", "pre-order", "preorder", "out on shelves", "my new book",
                   "published my book", "the book is out"] },
      ] },
      examples: ["My book, The Quiet Operator, is out today. Pre-orders ship this week."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F3 · HIRING & JOB MARKET
    // The one family where Layer A pays for itself: comparing the author's
    // headline company against the company named in the post separates a
    // real hiring manager from someone farming a referral bonus.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "third_party_referral", family: "F3", intent: "referral bonus", substance: 2,
      detect: {
        all: [{ phrase: ["is hiring", "are hiring", "we're hiring", "we are hiring",
                         "open role", "open position", "looking for a", "join the team",
                         "great opportunity", "role at"] }],
        any: [
          { flag: "companyMismatch" },
          { phrase: ["my friend's team", "a friend of mine", "a client of mine",
                     "a company i know", "a portfolio company", "one of my clients",
                     "a great company i", "someone in my network"] },
        ],
        none: [
          { phrase: ["we're hiring", "we are hiring", "join our team", "join us as",
                     "our team is growing", "we have an opening", "come work with us"] },
        ],
      },
      // Guard against the common false positive: "we're hiring" is itself
      // evidence the author works there, whatever their headline says.
      examples: ["My friend's team at Globex is hiring a Senior Backend Engineer. DM me for an intro."],
    },
    {
      id: "we_are_hiring", family: "F3", intent: "candidates", substance: 2,
      detect: {
        all: [{ phrase: ["we're hiring", "we are hiring", "my team is hiring", "we have an opening",
                         "join our team", "join us as", "now hiring", "we're looking for",
                         "we are looking for", "adding to the team"] }],
      },
      examples: ["We're hiring a Senior Backend Engineer at Acme. Remote within EU, apply below."],
    },
    {
      id: "open_to_work", family: "F3", intent: "job", substance: 2,
      detect: {
        all: [{ structure: { firstPerson: true } }],
        any: [{ phrase: ["#opentowork", "open to work", "open to opportunities",
                         "actively seeking", "actively looking for my next", "available immediately",
                         "looking for my next role", "seeking my next", "back on the market",
                         "if you know of any roles", "would appreciate any leads"] }],
      },
      examples: ["After 8 great years I'm back on the market. Open to Head of Design roles, remote or NYC."],
    },
    {
      id: "recruiter_pitch", family: "F3", intent: "candidates", substance: 2,
      detect: { any: [
        { phrase: ["send me your cv", "send me your resume", "dm me your cv", "dm me your resume",
                   "i have a role", "i'm recruiting for", "i am recruiting for",
                   "drop your cv", "share your profile with me"] },
      ] },
      examples: ["I have a role for a Senior Data Engineer in Berlin. DM me your CV."],
    },
    {
      id: "referral_request", family: "F3", intent: "job", substance: 1,
      detect: { any: [
        { phrase: ["any warm intros", "would appreciate a referral", "looking for a referral",
                   "anyone hiring", "if anyone can refer me", "know anyone at"] },
      ] },
      examples: ["Anyone hiring PMs in fintech? Would appreciate a referral into Monzo or Revolut."],
    },
    {
      id: "hiring_advice", family: "F3", intent: "reach", substance: 1,
      detect: { all: [
        { phrase: ["as a recruiter", "as a hiring manager", "here's what i look for",
                   "red flags in interviews", "what i look for in a cv", "resume tips",
                   "i've reviewed thousands of"] },
      ] },
      examples: ["As a hiring manager I've reviewed thousands of CVs. Here's what I look for in the first 6 seconds."],
    },
    {
      id: "candidate_ghosted", family: "F3", intent: "reach", substance: 1,
      detect: { any: [
        { phrase: ["applied to 100", "applications and no", "got ghosted", "no response from",
                   "the hiring process is broken", "recruiters need to", "rejection email after"] },
      ] },
      examples: ["287 applications. 4 interviews. 0 offers. The hiring process is broken."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F4 · REACH FARMING
    // Posts whose real content is the call to action. The template names the
    // ask, because the ask is the whole message.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "comment_bait", family: "F4", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["comment", "drop a", "drop the word", "type ", "reply with"] },
          { phrase: ["i'll dm", "ill dm", "i'll send", "ill send", "i'll share",
                     "and i'll", "and ill", "send it over", "i'll get it to you"] },
        ],
      },
      examples: ["Comment GUIDE and I'll DM you my 47-page cold outreach playbook. No strings."],
    },
    {
      id: "tag_bait", family: "F4", intent: "reach", substance: 0,
      detect: { any: [
        { phrase: ["tag someone who", "tag a friend who", "tag the person who",
                   "who needs to see this", "tag your", "know someone who needs"] },
      ] },
      examples: ["Tag someone who needs to hear this today. 👇"],
    },
    {
      id: "repost_bait", family: "F4", intent: "reach", substance: 0,
      detect: { any: [
        { phrase: ["repost to help", "please repost", "share to help", "help this reach",
                   "repost this", "let's help them", "boost this post"] },
      ] },
      examples: ["Repost this to help her reach a hiring manager. It takes two seconds. ♻️"],
    },
    {
      id: "follow_bait", family: "F4", intent: "reach", substance: 0,
      detect: { any: [
        { phrase: ["follow me for more", "follow for more", "i post daily about",
                   "hit follow", "follow along for", "turn on notifications",
                   "ring the bell", "♻️ repost and follow"] },
      ] },
      examples: ["I post daily about B2B growth. Follow me for more. ♻️"],
    },
    {
      id: "list_giveaway", family: "F4", intent: "reach", substance: 1,
      detect: {
        all: [
          { regex: "\\b\\d{1,3}\\s+(?:\\w+\\s+){0,2}(tools|prompts|books|tips|lessons|mistakes|rules|ways|hacks|frameworks|templates|newsletters|websites|resources)\\b" },
          { structure: { numeralLedLineCount: { min: 4 } } },
        ],
      },
      examples: ["17 AI tools that will save you 10 hours a week:\n1. Notion AI\n2. Perplexity\n3. Claude\n4. Gamma"],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F5 · NARRATIVE / BROETRY
    // Gated behind the structural broetry signature so a genuine short story
    // written as prose doesn't get caught. The template says what shape the
    // story is and what it is missing — never what the author "really meant".
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "parable_stranger", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { regex: "\\b(a|an|the) (stranger|janitor|homeless (man|woman|person)|old (man|woman|lady)|young (man|woman|candidate)|candidate|intern|cleaner|barista|security guard|taxi driver|uber driver|waiter|waitress|little (boy|girl)|woman|man|guy|lady|passenger|customer|kid|teenager|driver|nurse|student|beggar)\\b" },
          { phrase: ["turned out to be", "it was the ceo", "was the ceo", "was actually the",
                     "he was the", "she was the", "guess who", "later that day",
                     "the next day", "two weeks later", "a week later"] },
        ],
      },
      examples: ["A stranger's car broke down.\n\nI stopped to help.\n\nHe was late for a meeting.\n\nThe next day I walked into my interview.\n\nHe was the CEO.\n\nAlways help people."],
    },
    {
      id: "hardship_to_success", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { regex: "\\b(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty)\\s+(years?|months?)\\s+ago\\b|\\bback (then|in \\d{4})\\b|\\bat my lowest\\b|\\bthis time last year\\b" },
          { phrase: ["i was broke", "i was homeless", "i was fired", "i had nothing",
                     "in my account", "couldn't pay", "could not pay", "sleeping in my car",
                     "rock bottom", "i had no money", "make rent", "on a friend's floor",
                     "could not afford", "couldn't afford", "i had lost everything"] },
        ],
      },
      examples: ["3 years ago I had $47 in my account.\n\nI was sleeping in my car.\n\nToday we crossed $2M ARR.\n\nNever give up."],
    },
    {
      id: "rejection_redemption", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["rejected", "they said no", "turned me down", "got the rejection",
                     "told me i wasn't", "told me i was not"] },
          { phrase: ["kept going", "didn't give up", "did not give up", "today i",
                     "now i", "look at me now", "best thing that ever happened"] },
        ],
      },
      examples: ["I was rejected by 62 investors.\n\nEvery single one said no.\n\nI kept going.\n\nToday we closed our Series B."],
    },
    {
      id: "firing_lesson", family: "F5", intent: "reach", substance: 0,
      detect: { any: [
        { phrase: ["i fired my best client", "i fired our biggest", "i turned down",
                   "i walked away from", "i said no to a", "i gave up a", "i rejected the offer"] },
      ] },
      examples: ["I fired my best client yesterday.\n\nHe paid us $40k a month.\n\nBut he screamed at my team.\n\nCulture beats revenue."],
    },
    {
      id: "child_wisdom", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { regex: "\\bmy (\\d+[- ]year[- ]old|son|daughter|kid|child|niece|nephew)\\b" },
          { phrase: ["asked me", "said to me", "told me", "taught me", "changed how i",
                     "and it hit me", "i had no answer"] },
        ],
      },
      examples: ["My 6-year-old asked me why I work weekends.\n\nI had no answer.\n\nThat's when I understood delegation."],
    },
    {
      id: "mundane_business_lesson", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["my barista", "my uber driver", "my taxi driver", "my dog", "my gym",
                     "the flight attendant", "my plumber", "my hairdresser", "the waiter",
                     "my neighbour", "my neighbor", "a food truck"] },
          { phrase: ["taught me", "reminded me", "is exactly like", "the same as running",
                     "about leadership", "about sales", "about business", "about marketing",
                     "about hiring", "about strategy"] },
        ],
      },
      examples: ["My barista taught me more about customer retention than any consultant.\n\nHere's what she does.\n\nShe remembers your name."],
    },
    {
      id: "confession_lesson", family: "F5", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["i'll be honest", "ill be honest", "i failed", "my biggest mistake",
                     "i was wrong", "i messed up", "i screwed up", "this is hard to admit",
                     "i've never shared this"] },
          { phrase: ["here's what i learned", "heres what i learned", "the lesson",
                     "what it taught me", "three things i", "here's what changed"] },
        ],
      },
      examples: ["I'll be honest: I failed at my first startup.\n\nWe burned $800k.\n\nHere's what I learned."],
    },
    {
      id: "dm_screenshot", family: "F5", intent: "reach", substance: 0,
      detect: { any: [
        { phrase: ["i got this message today", "received this dm", "this landed in my inbox",
                   "look at this message", "someone sent me this", "here's the message i got",
                   "check out this outreach"] },
      ] },
      examples: ["I got this message today from a recruiter. Read it and tell me the market is fine."],
    },
    {
      id: "gratitude_spiral", family: "F5", intent: "validation", substance: 0,
      detect: {
        all: [
          { regex: "(grateful|gratitude|thankful|blessed)" },
          { structure: { wordCount: { min: 25 } } },
        ],
        none: [{ capture: "MONEY" }, { capture: "PERCENT" }, { capture: "DATE" }],
      },
      examples: ["So grateful for this team.\n\nSo thankful for this journey.\n\nBlessed to be surrounded by people who show up every single day.\n\nGratitude changes everything."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F6 · OPINION / THOUGHT LEADERSHIP
    // These carry a claim, so the template quotes the claim rather than
    // characterising it. The reader can judge it in one line.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "hot_take", family: "F6", intent: "reach", substance: 1,
      detect: { any: [
        { phrase: ["unpopular opinion", "controversial take", "hot take", "i'll say it",
                   "ill say it", "someone had to say it", "this will be unpopular",
                   "i'm going to get hate for this"] },
      ] },
      examples: ["Unpopular opinion: most OKR frameworks are just quarterly theatre."],
    },
    {
      id: "false_dichotomy", family: "F6", intent: "reach", substance: 0,
      detect: { all: [{ score: { cooccurrence: { min: 30 } } },
                      { phrase: ["isn't about", "is not about", "not about"] }] },
      examples: ["Leadership isn't about titles.\n\nIt's about service.\n\nLet that sink in."],
    },
    {
      id: "nobody_talks_about", family: "F6", intent: "reach", substance: 1,
      detect: { any: [
        { phrase: ["nobody talks about", "nobody's talking about", "no one talks about",
                   "no one tells you", "nobody tells you", "most people miss",
                   "what they don't tell you", "the part nobody"] },
      ] },
      examples: ["Nobody talks about how lonely the first year of founding a company is."],
    },
    {
      id: "if_you_are_not", family: "F6", intent: "reach", substance: 0,
      detect: { all: [
        { regex: "\\bif (you'?re not|you are not|your \\w+ (is|are)n'?t|your \\w+ (is|are) not)\\b" },
        { phrase: ["already behind", "you're losing", "you are losing", "left behind",
                   "doing it wrong", "missing out", "you'll regret"] },
      ] },
      examples: ["If you're not using AI agents in your workflow by now, you're already behind."],
    },
    {
      id: "stop_start", family: "F6", intent: "reach", substance: 1,
      detect: { any: [
        { regex: "^\\s*stop\\s+\\w+ing\\b" },
        { phrase: ["stop doing", "start doing", "delete this from your vocabulary",
                   "never say this in", "stop saying", "do this instead"] },
      ] },
      examples: ["Stop saying \"just circling back\". Say what you actually want instead."],
    },
    {
      id: "framework_post", family: "F6", intent: "reach", substance: 1,
      detect: {
        all: [
          { regex: "\\bthe \\d{1,2}\\s+(pillars|laws|rules|principles|steps|stages|levers|habits|traits)\\b" },
        ],
      },
      examples: ["The 5 pillars of a durable sales org:\n1. Clear ICP\n2. Real discovery\n3. Honest forecasting"],
    },
    {
      id: "prediction", family: "F6", intent: "reach", substance: 1,
      detect: { any: [
        { regex: "\\bby (20\\d{2})\\b" },
        { phrase: ["is dead", "is officially dead", "will replace", "the future of",
                   "won't exist in", "will not exist in", "the end of"] },
      ] },
      examples: ["By 2028, the junior developer role as we know it will not exist."],
    },
    {
      id: "ai_will_replace", family: "F6", intent: "reach", substance: 1,
      detect: { all: [
        { phrase: ["ai will", "ai is going to", "chatgpt", "llms", "agents will", "prompt engineering"] },
        { phrase: ["replace", "kill", "make obsolete", "disappear", "the end of", "won't need"] },
      ] },
      examples: ["AI will replace 80% of marketing roles within 3 years. Here's why that's fine."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F7 · NEWSJACKING
    // Borrowed attention. `tragedy_lesson` carries rail:true — attaching a
    // business takeaway to a death is the exact case where the extension
    // must state the facts and say nothing clever.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "tragedy_lesson", family: "F7", intent: null, substance: 0, rail: true,
      detect: {
        all: [
          { or: [
            { phrase: ["passed away", "died suddenly", "his death", "her death", "their death",
                       "the shooting", "the earthquake", "the crash", "the tragedy in",
                       "lost his life", "lost her life", "lost their life", "was killed"] },
            { regex: "\\b[A-ZÀ-Þ][\\wÀ-ÿ]+(?:\\s+[A-ZÀ-Þ][\\wÀ-ÿ]+)*'s (death|passing)\\b" },
            { regex: "\\b(death|passing) of [A-ZÀ-Þ]" },
          ] },
          { phrase: ["taught me", "teaches us", "reminds us", "reminded me", "reminds me",
                     "lesson", "what leaders can learn", "get wrong about", "what founders",
                     "leadership", "legacy", "about business", "about sales", "about branding",
                     "as founders we", "in business we", "three things"] },
        ],
      },
      examples: ["Kobe's death taught me three things about founder discipline."],
    },
    {
      id: "celebrity_lesson", family: "F7", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["can teach you", "lessons from", "what we can learn from",
                     "playbook", "did it right", "genius move by"] },
          { regex: "\\b(elon musk|steve jobs|jeff bezos|messi|ronaldo|taylor swift|beyonc|mrbeast|sam altman|jensen huang|warren buffett)\\b" },
        ],
      },
      examples: ["What Taylor Swift's re-recordings can teach you about owning your IP."],
    },
    {
      id: "news_pivot", family: "F7", intent: "reach", substance: 1,
      detect: {
        all: [
          { phrase: ["what this means for", "here's what it means", "the real story here",
                     "everyone's talking about", "my take on the news", "breaking:"] },
        ],
      },
      examples: ["Everyone's talking about the OpenAI board news. Here's what it means for B2B founders."],
    },
    {
      id: "sports_lesson", family: "F7", intent: "reach", substance: 0,
      detect: {
        all: [
          { regex: "\\b(final|semi-?final|world cup|olympics|super ?bowl|the match|the game|championship|penalty|tournament|grand prix|the race)\\b" },
          { phrase: ["about leadership", "about teamwork", "about resilience",
                     "lessons for founders", "in business", "what managers can learn"] },
        ],
      },
      examples: ["What last night's final taught me about resilience in high-growth teams."],
    },
    {
      id: "holiday_hook", family: "F7", intent: "reach", substance: 0,
      detect: {
        all: [
          { phrase: ["it's monday", "happy new year", "new year new", "as we close out the year",
                     "this christmas", "happy friday", "end of the quarter", "q4 is here"] },
          { phrase: ["reflection", "reflecting", "grateful", "reminder", "let's make", "this year i"] },
        ],
      },
      examples: ["It's Monday. A reminder that consistency beats motivation every single time."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F8 · SALES & PROMOTION
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "webinar_lead_magnet", family: "F8", intent: "leads", substance: 1,
      detect: { any: [
        { phrase: ["webinar", "masterclass", "register for the", "save your seat",
                   "limited spots", "spots left", "free workshop", "free training",
                   "live session on"] },
      ],
        none: [{ phrase: ["cohort", "enrollment closes", "enrolment closes", "my course"] }],
      },
      examples: ["Free webinar Thursday: how we cut CAC by 40%. Only 100 seats — register now."],
    },
    {
      id: "course_cohort_promo", family: "F8", intent: "sell", substance: 1,
      detect: { any: [
        { phrase: ["enrollment closes", "enrolment closes", "next cohort", "seats left",
                   "doors close", "join the cohort", "early bird pricing", "my course"] },
      ] },
      examples: ["Cohort 7 of my B2B Positioning course opens Monday. 12 seats left."],
    },
    {
      id: "cold_outreach_public", family: "F8", intent: "leads", substance: 0,
      detect: { any: [
        { phrase: ["dm me if", "book a call", "let's chat — link", "calendar link below",
                   "my calendly", "happy to walk you through it, just dm",
                   "send me a dm and", "link in the comments to book"] },
      ] },
      examples: ["If you're struggling with pipeline, DM me and let's book a call."],
    },
    {
      id: "testimonial_client_win", family: "F8", intent: "leads", substance: 1,
      detect: {
        all: [
          { phrase: ["our client", "a client", "we helped them", "we took them from",
                     "went from", "the results speak"] },
        ],
        any: [{ capture: "PERCENT" }, { capture: "MONEY" }],
      },
      examples: ["We took a client from 2% to 11% reply rate in six weeks. Same list, better copy."],
    },
    {
      id: "product_pitch", family: "F8", intent: "sell", substance: 1,
      detect: { any: [
        { phrase: ["try it free", "start your free trial", "link in the comments",
                   "check it out here", "we built this", "our product", "sign up today",
                   "get started for free"] },
      ] },
      examples: ["We built Acme Flow because approval chains are broken. Try it free — link in comments."],
    },
    {
      id: "agency_flex", family: "F8", intent: "leads", substance: 0,
      detect: { any: [
        { phrase: ["another one", "we just closed", "just signed", "welcome aboard to our newest",
                   "excited to partner with our new client", "closed another"] },
      ] },
      examples: ["Just signed another 6-figure retainer. Another one. 🚀"],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F9 · GENUINE SUBSTANCE
    // Posts carrying verifiable information. These get summarised straight
    // and never mocked — if good posts don't feel served, the extension is
    // just a different kind of noise.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "technical_explainer", family: "F9", intent: "inform", substance: 3,
      detect: {
        all: [
          { regex: "\\b(latency|throughput|p9[59]|kubernetes|postgres|redis|typescript|python|rust|golang|api|sdk|webgpu|inference|token|cache|schema|migration|deployment|regex|compiler|runtime)\\b" },
          { structure: { wordCount: { min: 25 } } },
        ],
        none: [{ score: { slop: { min: 50 } } }],
      },
      examples: ["We cut p99 latency from 840ms to 120ms by moving session lookups out of Postgres into a local LRU with a 30s TTL. The tradeoff is a stale-read window we bounded with a version check."],
    },
    {
      id: "data_research", family: "F9", intent: "inform", substance: 3,
      detect: {
        all: [
          { phrase: ["the study", "new study", "study of", "the report", "the survey",
                     "survey of", "researchers", "research shows", "the data shows",
                     "according to", "the paper", "sample of", "respondents", "median", "n ="] },
        ],
        any: [{ capture: "PERCENT" }, { capture: "NUMBER" }],
      },
      examples: ["New Stanford study of 4,800 developers: AI assistance raised throughput 21% but review time 34%."],
    },
    {
      id: "case_study_numbers", family: "F9", intent: "inform", substance: 3,
      detect: {
        all: [
          { regex: "\\bfrom\\s+[\\d$€£][\\d.,]*\\s*[%\\w]*\\s+to\\s+[\\d$€£][\\d.,]*" },
          { structure: { wordCount: { min: 25 } } },
        ],
        none: [{ score: { slop: { min: 50 } } }],
      },
      examples: ["We moved checkout conversion from 2.4% to 3.9% over 11 weeks. Three changes did almost all of it: removing the account gate, inlining the address form, and prefetching the payment sheet."],
    },
    {
      id: "tutorial_howto", family: "F9", intent: "inform", substance: 2,
      detect: {
        all: [
          { phrase: ["here's how", "step 1", "step one", "how to", "walkthrough", "the process is"] },
          { structure: { numeralLedLineCount: { min: 3 } } },
        ],
      },
      examples: ["Here's how we run a 45-minute incident review:\n1. Timeline, no blame\n2. Contributing factors\n3. Two actions with owners"],
    },
    {
      id: "industry_news_factual", family: "F9", intent: "inform", substance: 3,
      detect: {
        all: [
          { capture: "MONEY" },
          { capture: "DATE" },
        ],
        none: [{ structure: { firstPerson: true } }, { score: { slop: { min: 40 } } }],
      },
      examples: ["On Sept 3, Figma closed its acquisition of Payload for $22M in cash and stock."],
    },

    // ─────────────────────────────────────────────────────────────────────
    // F10 · AI SLOP & FALLBACK
    // Last resort. `fallback_short` deliberately renders nothing — making a
    // short post worse is the fastest way to lose a user's trust.
    // ─────────────────────────────────────────────────────────────────────
    {
      id: "ai_generated", family: "F10", intent: "reach", substance: 0,
      detect: { all: [
        { score: { slop: { min: 70 } } },
        { structure: { wordCount: { min: 20 } } },
      ] },
      examples: ["In today's ever-evolving landscape, we must leverage synergies to unlock transformative growth — and foster a holistic ecosystem where every stakeholder can thrive."],
    },
    {
      id: "fallback_long", family: "F10", intent: null, substance: 1,
      detect: { all: [{ structure: { wordCount: { min: 150 } } }] },
      examples: [],
    },
    {
      id: "fallback_short", family: "F10", intent: null, substance: 1, passthrough: true,
      detect: { all: [] },
      examples: [],
    },
  ];

  ns.catalog = { CATALOG: CATALOG, FAMILIES: FAMILIES };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = ns.catalog;
  }
})();
