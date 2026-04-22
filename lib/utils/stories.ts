import type { ClassifiedStory } from "@/types/news.types";

interface GroupStoriesResult {
  pendingStories: ClassifiedStory[];
  storyGroups: Record<string, ClassifiedStory[]>;
}

export function groupStoriesBySource(stories: ClassifiedStory[]): GroupStoriesResult {
  const pendingStories: ClassifiedStory[] = [];
  const storyGroups: Record<string, ClassifiedStory[]> = {};

  for (const story of stories) {
    if (story.isAnalyzed !== true) {
      pendingStories.push(story);
      continue;
    }
    const source = story.source || "newsapi";
    if (!storyGroups[source]) {
      storyGroups[source] = [];
    }
    storyGroups[source].push(story);
  }

  for (const source of Object.keys(storyGroups)) {
    storyGroups[source].sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));
  }

  pendingStories.sort((a, b) => (b.datetime ?? 0) - (a.datetime ?? 0));

  return { pendingStories, storyGroups };
}
