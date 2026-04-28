export interface LessonNarrativeSection {
  heading: string;
  body: string;
  image_suggestion: string;
  image_url?: string;
}

export interface LessonActivity {
  type: "drawing" | "labeling" | "sorting" | "matching" | "free_response";
  prompt: string;
  instructions_4yo: string;
  instructions_7yo: string;
}

export interface ProjectCard {
  title: string;
  description: string;
  materials: string[];
  steps_4yo: string[];
  steps_7yo: string[];
  wonder_questions: string[];
}

export interface BranchingTopic {
  title: string;
  teaser: string;
  connection: string;
}

export interface VideoSuggestion {
  title: string;
  channel: string;
  url: string;
  duration_minutes: number;
}

export interface LessonJson {
  title: string;
  subtitle: string;
  narrative: LessonNarrativeSection[];
  did_you_know: string[];
  wonder_questions: string[];
  activity: LessonActivity;
  project_card: ProjectCard;
  branching_topics: BranchingTopic[];
  video_suggestions?: VideoSuggestion[];
  conversation_starters?: string[];
}
