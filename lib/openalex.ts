import { AppError, shortText } from "@/lib/core";

type OpenAlexWork = {
  id?: string;
  doi?: string;
  title?: string;
  publication_date?: string;
  publication_year?: number;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  authorships?: Array<{
    author?: { id?: string; display_name?: string; orcid?: string };
    institutions?: Array<{ id?: string; display_name?: string }>;
  }>;
};

type OpenAlexInstitution = {
  homepage_url?: string;
  display_name?: string;
};

export type ResearchWork = {
  title: string;
  date: string;
  url: string;
  citedBy: number;
};

export type ResearchCandidate = {
  fullName: string;
  institution: string;
  officialProfileUrl: string | undefined;
  openAlexAuthorUrl: string;
  sourceUrls: string[];
  works: ResearchWork[];
  researchSummary: string;
  whyMatch: string;
};

type CandidateSeed = {
  authorId: string;
  fullName: string;
  institutionId: string;
  institution: string;
  works: OpenAlexWork[];
  score: number;
};

function abstractText(index?: Record<string, number[]>) {
  if (!index) return "";
  return Object.entries(index)
    .flatMap(([word, positions]) => positions.map((position) => [position, word] as const))
    .sort((left, right) => left[0] - right[0])
    .map((item) => item[1])
    .join(" ");
}

function words(value: string) {
  return value.toLowerCase().match(/[a-z][a-z-]{2,}/g) || [];
}

function workUrl(work: OpenAlexWork) {
  return work.doi || work.id || "";
}

function toWork(work: OpenAlexWork): ResearchWork | undefined {
  if (!work.title || !workUrl(work)) return undefined;
  return {
    title: shortText(work.title, 240),
    date: work.publication_date || String(work.publication_year || "Date unavailable"),
    url: workUrl(work),
    citedBy: Number(work.cited_by_count || 0)
  };
}

async function openAlex(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json"
    },
    next: { revalidate: 0 }
  });
  if (!response.ok) {
    throw new AppError("Professor matching is temporarily unavailable. Your credits have not changed.", 503);
  }
  return response.json();
}

async function recentAuthorWorks(authorId: string) {
  const endpoint = "https://api.openalex.org/works?filter=author.id:" + encodeURIComponent(authorId) + "&per-page=5&sort=publication_date:desc";
  const data = await openAlex(endpoint) as { results?: OpenAlexWork[] };
  return (data.results || []).map(toWork).filter((work): work is ResearchWork => Boolean(work));
}

async function institutionHomepage(institutionId: string) {
  try {
    const data = await openAlex(institutionId) as OpenAlexInstitution;
    return data.homepage_url || undefined;
  } catch {
    return undefined;
  }
}

function relatedScore(work: OpenAlexWork, queryWords: string[]) {
  const haystack = (work.title || "") + " " + abstractText(work.abstract_inverted_index);
  const lower = haystack.toLowerCase();
  return queryWords.reduce((total, term) => total + (lower.includes(term) ? 1 : 0), 0);
}

function matchReason(disciplines: string[], specialisation: string, purpose: string, works: ResearchWork[]) {
  const focus = shortText([disciplines.slice(0, 2).join(", "), specialisation].filter(Boolean).join("; "), 180);
  const sample = works.slice(0, 2).map((work) => "“" + work.title + "”").join(" and ");
  const intent = words(purpose).slice(0, 5).join(", ");
  return shortText("Recent work including " + sample + " overlaps with your stated focus in " + focus + (intent ? ". Your purpose mentions " + intent + "." : "."), 600);
}

export async function findResearchers(input: {
  disciplines: string[];
  specialisation: string;
  purpose: string;
}) {
  const searchText = shortText(
    input.disciplines.slice(0, 3).join(" ") + " " + input.specialisation + " " + input.purpose,
    420
  );
  if (words(searchText).length < 3) {
    throw new AppError("Add a little more detail about your discipline, specialisation, and purpose.", 422);
  }

  const endpoint = "https://api.openalex.org/works?search=" + encodeURIComponent(searchText) + "&per-page=80&sort=cited_by_count:desc";
  const result = await openAlex(endpoint) as { results?: OpenAlexWork[] };
  const works = result.results || [];
  const queryWords = Array.from(new Set(words(searchText))).slice(0, 22);
  const seeds = new Map<string, CandidateSeed>();

  for (const work of works) {
    const relevance = relatedScore(work, queryWords);
    if (relevance < 2) continue;

    for (const authorship of work.authorships || []) {
      const authorId = authorship.author?.id;
      const fullName = authorship.author?.display_name;
      const institution = authorship.institutions?.[0];
      if (!authorId || !fullName || !institution?.id || !institution.display_name) continue;

      const existing = seeds.get(authorId);
      if (existing) {
        existing.works.push(work);
        existing.score += relevance;
      } else {
        seeds.set(authorId, {
          authorId,
          fullName,
          institutionId: institution.id,
          institution: institution.display_name,
          works: [work],
          score: relevance
        });
      }
    }
  }

  const shortlisted = Array.from(seeds.values())
    .filter((candidate) => candidate.works.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  const candidates = (await Promise.all(shortlisted.map(async (seed): Promise<ResearchCandidate | undefined> => {
    try {
      const [recentWorks, officialProfileUrl] = await Promise.all([
        recentAuthorWorks(seed.authorId),
        institutionHomepage(seed.institutionId)
      ]);
      const matchingWorks = seed.works
        .map(toWork)
        .filter((work): work is ResearchWork => Boolean(work));
      const allWorks = Array.from(new Map([...matchingWorks, ...recentWorks].map((work) => [work.url, work])).values())
        .slice(0, 5);

      if (allWorks.length < 3) return undefined;

      const authorUrl = seed.authorId;
      const sourceUrls = Array.from(new Set([authorUrl, officialProfileUrl, ...allWorks.map((work) => work.url)].filter(Boolean))) as string[];
      return {
        fullName: seed.fullName,
        institution: seed.institution,
        officialProfileUrl,
        openAlexAuthorUrl: authorUrl,
        sourceUrls,
        works: allWorks,
        researchSummary: shortText(allWorks.map((work) => work.title).join(". ") + ".", 900),
        whyMatch: matchReason(input.disciplines, input.specialisation, input.purpose, allWorks)
      } satisfies ResearchCandidate;
    } catch {
      return undefined;
    }
  }))).filter((candidate): candidate is ResearchCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    throw new AppError("No strong, verifiable matches were found. Try a more specific specialisation or purpose.", 422);
  }

  return {
    candidates,
    profilesChecked: shortlisted.length,
    papersReviewed: works.length
  };
}
