# WonderPath — V1 Build Specification

*A custom exploration app for Sylvie (7) and Holland (4). Built as a PWA on Supabase + Claude API.*

---

## 1. Product Overview

WonderPath is a daily exploration app where kids choose topics they're curious about, read AI-generated lessons presented as annotatable PDF workbook pages, ask questions, draw and create, and build a visible map of everything they've discovered over the summer.

The parent is always present at the start of each session: the child picks a topic, the app generates a lesson, the parent reviews it on the spot, and then the child takes over.

### What V1 Is

- Topic selection from seeded or AI-suggested topics
- AI-generated lessons rendered as styled PDFs, viewable and annotatable on the tablet
- A simple AI Q&A scoped to the current lesson (5 questions max)
- A freeform drawing canvas (tldraw) for creative activities
- A curiosity map showing all explored topics and their connections
- A Wonder Book collecting drawings, annotated lessons, and audio reflections
- Project cards (print-friendly web view) for offline hands-on activities
- A parent dashboard showing lesson history, adding topics, and uploading photos

### What V1 Is Not

- Co-learning / sibling mode
- Co-reading / read-aloud mode
- Curiosity journaling
- Passport / gamification
- Push notifications or email digests
- Offline support (online-only for V1)
- RAG pipeline or curated corpus database

---

## 2. Users & Profiles

### Child Profiles

When the app opens, the child taps their name to enter:

| Profile | Name | Age | Experience |
|---------|------|-----|------------|
| Child A | Sylvie | 7 | Text is displayed and readable, with tap-to-hear on any word. Activities include writing prompts, labeling, and more complex drawing. Lessons are ~10–15 minutes. |
| Child B | Holland | 4 | All text is narrated automatically via TTS. Navigation is picture-based with large touch targets. Activities are drawing-focused. Lessons are ~5–10 minutes. |

### Parent

- Accesses the parent dashboard via a menu item (no password protection)
- Reviews generated lessons before the child begins
- Can add topics to each child's curiosity map
- Can upload photos of offline projects into the Wonder Book

---

## 3. Technical Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (React) + Tailwind CSS, deployed on Vercel |
| Drawing (freeform) | tldraw (for creative activity canvas) |
| Drawing (PDF annotation) | Lightweight HTML canvas overlay on top of react-pdf pages |
| PDF generation | @react-pdf/renderer (generates lesson PDFs server-side or via API route) |
| PDF display | react-pdf (pdf.js wrapper, renders PDF pages as canvas) |
| Backend / API | Next.js API routes (or Supabase Edge Functions) |
| AI | Claude API (Sonnet for lesson generation, Haiku for Q&A) |
| TTS | Browser SpeechSynthesis API (free, works on Android Chrome) |
| Database | Supabase (Postgres) |
| File storage | Supabase Storage (PDFs, drawings, audio recordings, photos) |
| Hosting | Vercel |

### Data Model (Supabase Postgres)

```
profiles
  id            uuid PK
  name          text          -- "Sylvie" or "Holland"
  age           int
  created_at    timestamptz

topics
  id            uuid PK
  title         text          -- "Volcanoes"
  description   text          -- Short teaser sentence
  parent_topic  uuid FK → topics.id  (nullable, for branching)
  source        text          -- "seed" | "ai_suggested" | "parent_added" | "child_requested"
  created_at    timestamptz

lessons
  id            uuid PK
  topic_id      uuid FK → topics.id
  profile_id    uuid FK → profiles.id
  status        text          -- "generating" | "ready" | "approved" | "viewed"
  lesson_json   jsonb         -- Structured lesson data from Claude
  pdf_url       text          -- Supabase Storage URL for the generated PDF
  created_at    timestamptz
  approved_at   timestamptz
  viewed_at     timestamptz

explorations
  id            uuid PK
  profile_id    uuid FK → profiles.id
  lesson_id     uuid FK → lessons.id
  topic_id      uuid FK → topics.id
  started_at    timestamptz
  completed_at  timestamptz

annotations
  id            uuid PK
  lesson_id     uuid FK → lessons.id
  profile_id    uuid FK → profiles.id
  page_number   int
  stroke_data   jsonb         -- Array of stroke objects [{points, color, width}, ...]
  created_at    timestamptz

drawings
  id            uuid PK
  profile_id    uuid FK → profiles.id
  topic_id      uuid FK → topics.id
  lesson_id     uuid FK → lessons.id (nullable)
  image_url     text          -- Supabase Storage URL (exported PNG from tldraw)
  prompt        text          -- The activity prompt that generated this
  created_at    timestamptz

reflections
  id            uuid PK
  profile_id    uuid FK → profiles.id
  lesson_id     uuid FK → lessons.id
  audio_url     text          -- Supabase Storage URL
  duration_sec  int
  created_at    timestamptz

photos
  id            uuid PK
  profile_id    uuid FK → profiles.id
  topic_id      uuid FK → topics.id (nullable)
  image_url     text          -- Supabase Storage URL
  caption       text          -- Parent-entered caption
  created_at    timestamptz

conversations
  id            uuid PK
  lesson_id     uuid FK → lessons.id
  profile_id    uuid FK → profiles.id
  messages      jsonb         -- [{role: "user"|"assistant", content: "..."}]
  question_count int          -- Capped at 5
  created_at    timestamptz

topic_connections
  id            uuid PK
  from_topic    uuid FK → topics.id
  to_topic      uuid FK → topics.id
  label         text          -- e.g., "is made of", "lives in", "is related to"
```

### File Storage Structure (Supabase Storage)

```
lessons/
  {lesson_id}.pdf

drawings/
  {drawing_id}.png

reflections/
  {reflection_id}.webm

photos/
  {photo_id}.jpg

annotations/
  (stored in DB as JSON, not as files)
```

---

## 4. Lesson Generation Pipeline

### Step 1: Topic Selection

The child (with parent present) picks a topic from:
- **Seeded topics** (10 pre-loaded at app initialization)
- **Branching suggestions** (3–5 topics suggested at the end of the previous lesson)
- **Parent-added topics** (parent adds via dashboard)
- **Child request** (child says "I want to learn about X" and parent types it in)

### Step 2: Claude Generates the Lesson

An API route calls Claude Sonnet with:

**System prompt** (simplified version — full prompt in Section 8):
```
You are a lesson generator for a children's exploration app. Generate
a structured lesson for a {age}-year-old child about "{topic}".

Use only well-established facts from reliable sources such as:
Britannica Kids, DK Children's Encyclopedia, National Geographic Kids,
NASA Space Place, Smithsonian, BBC Bitesize, and PBS LearningMedia.

If you are uncertain about any fact, flag it with [VERIFY].

Respond with a JSON object matching the provided schema.
```

**Lesson JSON schema:**

```json
{
  "title": "Volcanoes",
  "subtitle": "Mountains That Explode!",
  "narrative": [
    {
      "heading": "What Is a Volcano?",
      "body": "A volcano is an opening in the Earth's surface where hot melted rock, called magma, pushes up from deep underground...",
      "image_suggestion": "Cross-section diagram of a volcano showing magma chamber, vent, and crater"
    },
    {
      "heading": "Why Do Volcanoes Erupt?",
      "body": "Deep below the surface, the Earth is incredibly hot...",
      "image_suggestion": "Simplified diagram of tectonic plates"
    }
  ],
  "did_you_know": [
    "The word 'volcano' comes from Vulcan, the Roman god of fire.",
    "There are more than 1,500 active volcanoes on Earth right now."
  ],
  "wonder_questions": [
    "What would it be like to live near a volcano?",
    "Where do you think most volcanoes are?",
    "What do you think happens to the land after a volcano erupts?"
  ],
  "activity": {
    "type": "drawing",
    "prompt": "Draw what you think the inside of a volcano looks like. Show where the hot magma is and where it comes out.",
    "instructions_4yo": "Draw a big mountain with fire coming out the top! Use red and orange for the lava.",
    "instructions_7yo": "Draw a cross-section of a volcano. Label the magma chamber, the vent, the crater, and the lava flow."
  },
  "project_card": {
    "title": "Build a Mini Volcano",
    "description": "Make your own erupting volcano using things from the kitchen!",
    "materials": ["Baking soda", "Vinegar", "Dish soap", "Red food coloring", "A cup or small container", "A tray or plate"],
    "steps_4yo": [
      "Put your cup on the tray.",
      "Put 2 big spoons of baking soda in the cup.",
      "Add a squirt of dish soap and some red food coloring.",
      "Ask a grown-up to pour vinegar in. Watch it erupt!"
    ],
    "steps_7yo": [
      "Place your container on the tray — this is your volcano.",
      "Add 2 tablespoons of baking soda to the container.",
      "Add a squirt of dish soap and a few drops of red food coloring.",
      "Slowly pour in 1/4 cup of vinegar and observe the reaction.",
      "Try it again with more or less vinegar. What changes?"
    ],
    "wonder_questions": [
      "What do you think made it fizz?",
      "How is this like a real volcano? How is it different?"
    ]
  },
  "video_suggestions": [
    {
      "title": "How do Volcanoes Erupt?",
      "channel": "SciShow Kids",
      "url": "https://youtube.com/watch?v=example",
      "duration_minutes": 4
    }
  ],
  "branching_topics": [
    {
      "title": "Earthquakes",
      "teaser": "The ground under your feet is always moving — very, very slowly.",
      "connection": "Volcanoes and earthquakes both happen because of moving tectonic plates."
    },
    {
      "title": "Rocks and Minerals",
      "teaser": "Lava cools down and turns into rock. But did you know there are hundreds of kinds of rock?",
      "connection": "Volcanic eruptions create new types of rock, like obsidian and pumice."
    },
    {
      "title": "Dinosaurs",
      "teaser": "Millions of years ago, volcanoes helped change the whole world — and what happened to the dinosaurs.",
      "connection": "Massive volcanic eruptions may have contributed to the extinction of the dinosaurs."
    },
    {
      "title": "Hawaii",
      "teaser": "The islands of Hawaii were built entirely by volcanoes rising up from the ocean floor.",
      "connection": "Hawaii is home to some of the most active volcanoes on Earth."
    }
  ]
}
```

### Step 3: Image Generation / Sourcing

For each `image_suggestion` in the lesson JSON:
- Call an image API (options below) to generate or find an appropriate image
- Store the image in Supabase Storage
- Reference the URL in the PDF generation step

**Image sourcing options (choose one or combine):**
- **Unsplash API** (free, high-quality photos, good for nature/animals/places)
- **Pexels API** (free, similar to Unsplash)
- **DALL-E / FLUX via API** (AI-generated illustrations — better for diagrams, cross-sections, fantasy scenarios)
- **Manual fallback:** If no good image is found, use a placeholder and the parent can substitute later

**Recommendation for V1:** Use Unsplash API as the primary source (it's free and fast), with a manual "replace image" option on the parent dashboard. Add AI-generated illustrations in V2 if needed.

### Step 4: PDF Rendering

The lesson JSON + images are rendered into a PDF using `@react-pdf/renderer` in a Next.js API route.

**PDF layout:**

```
┌─────────────────────────────────────────┐
│  🌋 VOLCANOES                           │
│  Mountains That Explode!                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │        [Hero Image]             │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  WHAT IS A VOLCANO?                     │
│  A volcano is an opening in the         │
│  Earth's surface where hot melted       │
│  rock, called magma, pushes up from     │
│  deep underground...                    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │     [Section Image]             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  💡 DID YOU KNOW?                       │
│  • The word 'volcano' comes from        │
│    Vulcan, the Roman god of fire.       │
│                                         │
│  ❓ WONDER QUESTIONS                    │
│  • What would it be like to live        │
│    near a volcano?                      │
│                                         │
├─────────────────────────────────────────┤
│  Page 2: Activity                       │
│                                         │
│  ✏️ YOUR TURN: DRAW IT                  │
│  Draw what you think the inside of      │
│  a volcano looks like...                │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     [Blank drawing area]        │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
├─────────────────────────────────────────┤
│  Page 3: Project Card                   │
│                                         │
│  🔨 BUILD A MINI VOLCANO               │
│  Materials: ...                         │
│  Steps: ...                             │
│  Wonder Questions: ...                  │
│                                         │
│  📸 Take a photo of your project!      │
│                                         │
├─────────────────────────────────────────┤
│  Page 4: What's Next?                   │
│                                         │
│  🗺️ WHERE WILL YOU EXPLORE NEXT?       │
│                                         │
│  [Earthquakes]  [Rocks & Minerals]      │
│  [Dinosaurs]    [Hawaii]                │
│                                         │
│  (tappable cards with teasers)          │
│                                         │
└─────────────────────────────────────────┘
```

**Age differences in the PDF:**
- **Holland (4):** Larger font (18–20pt body), fewer words per section, simpler vocabulary, more images, the "activity" page uses `instructions_4yo`, project card uses `steps_4yo`
- **Sylvie (7):** Standard readable font (14–16pt body), richer vocabulary, includes all sections, uses `instructions_7yo` and `steps_7yo`

**PDF page size:** Letter (8.5" × 11") in portrait — familiar workbook feel, prints well, displays well on a 10" tablet.

### Step 5: Parent Review

The generated PDF is displayed to the parent (who is sitting with the child). The parent can:
- **Approve** → lesson status moves to "approved" and the child can begin
- **Regenerate** → calls Claude again with a note about what to fix
- **Edit** → (stretch goal) parent can tweak the lesson JSON and re-render

In practice this is a quick scan — the parent is right there. No async approval workflow needed.

### Step 6: Child Explores the Lesson

The approved PDF is displayed in the app via react-pdf. The child can:
- Read (Sylvie) or listen via TTS (Holland — narration auto-plays section by section)
- Annotate the PDF pages with the stylus (canvas overlay)
- Tap "Ask a question" to open the AI Q&A
- Tap the activity prompt to open the tldraw canvas
- View the project card and optionally print it
- Choose a branching topic to explore next

---

## 5. Screen-by-Screen Specification

### Screen 1: Home / Profile Select

```
┌──────────────────────────────────────┐
│                                      │
│           WonderPath                 │
│                                      │
│    ┌──────────┐   ┌──────────┐      │
│    │          │   │          │      │
│    │  Sylvie  │   │ Holland  │      │
│    │          │   │          │      │
│    └──────────┘   └──────────┘      │
│                                      │
│              [Parent ⚙️]             │
│                                      │
└──────────────────────────────────────┘
```

- Two large, tappable profile cards with the kids' names
- Small, unobtrusive "Parent" link at the bottom

### Screen 2: Curiosity Map

```
┌──────────────────────────────────────┐
│  ← Back    Sylvie's Curiosity Map    │
│                                      │
│         [Node Graph]                 │
│                                      │
│    (Volcanoes)───(Earthquakes)       │
│        │                             │
│    (Rocks)     (Dinosaurs)           │
│                    │                 │
│              (Fossils)               │
│                                      │
│  ● Explored  ○ Suggested            │
│                                      │
│  [+ New Topic]                       │
│                                      │
└──────────────────────────────────────┘
```

- d3-force or vis.js node graph
- Explored topics are solid/colored nodes
- Suggested (unexplored) topics are outlined/dimmed
- Tapping an explored node shows the lesson summary
- Tapping a suggested node starts lesson generation
- "New Topic" button lets the parent type a custom topic
- For Holland: nodes are larger, icons instead of text labels, fewer visible at once

### Screen 3: Lesson Viewer

```
┌──────────────────────────────────────┐
│  ← Map    🌋 Volcanoes    ✏️ 🎤 ❓  │
│                                      │
│  ┌──────────────────────────────────┐│
│  │                                  ││
│  │     [PDF page rendered           ││
│  │      via react-pdf]              ││
│  │                                  ││
│  │     [Transparent annotation      ││
│  │      canvas overlay]             ││
│  │                                  ││
│  └──────────────────────────────────┘│
│                                      │
│  [◀ Prev]  Page 1 of 4  [Next ▶]   │
│                                      │
│  🔊 Read Aloud                       │
│                                      │
└──────────────────────────────────────┘
```

- PDF rendered page by page with react-pdf
- Transparent canvas overlay for stylus annotation on each page
- Toolbar icons:
  - ✏️ Toggle annotation mode (pen color, size, eraser)
  - 🎤 "Tell Me About It" — opens audio recorder
  - ❓ "Ask a Question" — opens AI Q&A panel
- 🔊 "Read Aloud" button triggers browser TTS for the current page text
  - For Holland: auto-plays on page load
  - For Sylvie: manual trigger, with tap-to-hear on individual words
- Page 2 (Activity): shows the drawing prompt; tapping "Start Drawing" opens tldraw in a modal/overlay
- Page 3 (Project Card): shows the project instructions; "Print" button opens browser print dialog
- Page 4 (What's Next): shows branching topic cards; tapping one starts a new lesson generation

### Screen 4: Drawing Canvas (tldraw)

```
┌──────────────────────────────────────┐
│  ← Back to Lesson    Activity        │
│                                      │
│  Prompt: "Draw what you think the    │
│  inside of a volcano looks like."    │
│                                      │
│  ┌──────────────────────────────────┐│
│  │                                  ││
│  │         [tldraw canvas]          ││
│  │                                  ││
│  │                                  ││
│  │                                  ││
│  └──────────────────────────────────┘│
│                                      │
│  [Save to Wonder Book]              │
│                                      │
└──────────────────────────────────────┘
```

- Full-screen tldraw canvas with simplified toolbar (pen, colors, eraser, undo)
- The activity prompt is displayed at the top
- "Save to Wonder Book" exports the canvas as PNG, stores in Supabase, creates a `drawings` record

### Screen 5: AI Q&A Panel

```
┌──────────────────────────────────────┐
│  Ask about Volcanoes          ✕      │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ You: Why does lava come out?     ││
│  │                                  ││
│  │ WonderPath: Great question!      ││
│  │ Deep underground, rock gets so   ││
│  │ hot that it melts into magma...  ││
│  └──────────────────────────────────┘│
│                                      │
│  Questions left: 4 of 5             │
│                                      │
│  ┌──────────────────────────────────┐│
│  │ Type or tap a question...        ││
│  └──────────────────────────────────┘│
│                                      │
│  [Why?] [How?] [Tell me more] [What │
│   happens if...?]                    │
│                                      │
└──────────────────────────────────────┘
```

- Slide-in panel (half-screen or overlay)
- For Holland: pre-built question buttons only (no typing), answers narrated via TTS
- For Sylvie: keyboard input + pre-built question buttons, text displayed
- 5-question cap with visible counter
- After 5 questions: "You've asked 5 great questions! Ready to draw or pick your next topic?"

**AI Q&A system prompt:**

```
You are answering questions from a {age}-year-old child about "{topic}".

Rules:
- Only discuss {topic} and directly related subjects.
- If the child asks about something unrelated, say: "That's a great
  question! But right now we're learning about {topic}. Maybe ask
  your mom or dad about that one!"
- Use simple, age-appropriate language.
- Keep answers to 2-3 short sentences for a 4-year-old,
  3-5 sentences for a 7-year-old.
- Be warm, enthusiastic, and encouraging.
- Never make up facts. If unsure, say "I'm not sure about that —
  let's look it up together with your mom or dad!"
- Do not role-play as a character. Just be a helpful, friendly voice.

Context from the lesson:
{lesson_json.narrative}
```

### Screen 6: "Tell Me About It" Recorder

```
┌──────────────────────────────────────┐
│  Tell Me About It!            ✕      │
│                                      │
│  What did you learn or make?         │
│  Press the button and tell me!       │
│                                      │
│         ┌─────────┐                  │
│         │  🎙️     │                  │
│         │ Record  │                  │
│         └─────────┘                  │
│                                      │
│  [Save]  [Try Again]  [Skip]        │
│                                      │
└──────────────────────────────────────┘
```

- Simple audio recorder using MediaRecorder API
- Records in WebM/Opus format
- Shows recording duration and a simple waveform animation
- "Save" stores the audio in Supabase Storage and creates a `reflections` record
- "Skip" closes without saving — no guilt, no penalty
- Prompted after completing an activity or project, but can be accessed anytime via the 🎤 button

### Screen 7: Wonder Book

```
┌──────────────────────────────────────┐
│  ← Back    Sylvie's Wonder Book      │
│                                      │
│  [By Date]  [By Topic]  [Family]     │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │ 🌋       │  │ 🦕       │         │
│  │ Volcano  │  │ Dinosaur │         │
│  │ drawing  │  │ drawing  │         │
│  │ Jun 12   │  │ Jun 14   │         │
│  └──────────┘  └──────────┘         │
│                                      │
│  ┌──────────┐  ┌──────────┐         │
│  │ 📸       │  │ 🎤       │         │
│  │ Volcano  │  │ "I learned│         │
│  │ project  │  │ about..." │         │
│  │ photo    │  │ Jun 12    │         │
│  └──────────┘  └──────────┘         │
│                                      │
└──────────────────────────────────────┘
```

- Grid of cards showing all Wonder Book entries
- Three view modes: chronological, grouped by topic, family (both kids combined)
- Card types: drawings (thumbnail), photos (thumbnail), reflections (audio player icon with duration), annotated lesson pages (thumbnail)
- Tapping a card opens the full-size view
- For the "Family" view: entries from both children, color-coded by child

### Screen 8: Parent Dashboard

```
┌──────────────────────────────────────┐
│  ← Back    Parent Dashboard          │
│                                      │
│  [Timeline] [Wonder Books] [Topics]  │
│                                      │
│  RECENT ACTIVITY                     │
│                                      │
│  Today — June 12                     │
│  Sylvie explored Volcanoes           │
│  • Asked 4 questions                 │
│  • Drew a volcano cross-section      │
│  • Recorded a reflection (0:32)      │
│                                      │
│  Holland explored Birds              │
│  • Drew a robin                      │
│  • No reflection recorded            │
│                                      │
│  CONVERSATION STARTERS 🍽️            │
│  • Ask Sylvie what makes a           │
│    volcano erupt                     │
│  • Ask Holland what bird she drew    │
│                                      │
│  [+ Add Topic for Sylvie]            │
│  [+ Add Topic for Holland]           │
│  [📸 Upload Photos]                  │
│                                      │
│  SESSION STATS                       │
│  Sylvie: 38 min today, 14 topics     │
│  Holland: 22 min today, 9 topics     │
│                                      │
└──────────────────────────────────────┘
```

**Dashboard features:**
- **Timeline:** Chronological feed of all activity across both children
- **Wonder Books:** Quick access to each child's Wonder Book, plus the family view
- **Topics:** View and manage the curiosity maps; add new topics for either child
- **Conversation starters:** AI-generated dinner table prompts based on the day's lessons (generated alongside each lesson, stored in lesson_json)
- **Upload photos:** Parent can photograph an offline project and tag it to a child + topic
- **Session stats:** Simple counters — time spent today, total topics explored this summer
- **AI conversation logs:** Tapping into any lesson's detail shows the full Q&A transcript

---

## 6. Session Flow & Screen Time

### Timer Logic

```
0 min    → Session starts
30 min   → Soft nudge: "You've been exploring for a while!
            Want to take a break and try your project?"
45 min   → Gentle transition: "Almost time to wrap up.
            Want to save your work and tell me about it?"
60 min   → Firm close: "Great exploring today! Time to go
            do something with your hands. See you next time!"
            App shows the project card and dims.
```

- Timer is per-child, per-session (resets when the app is re-opened)
- Parent can adjust thresholds in the dashboard (stretch goal, hardcode for V1)
- Timer pauses when the child is on the project card / print view (they're about to go offline)
- "Tell Me About It" prompt appears naturally at 45 minutes and at session end

---

## 7. Seed Topics

Pre-loaded at app initialization. Each child gets the same 10 seeds; they'll diverge quickly as they branch.

| # | Topic | Teaser |
|---|-------|--------|
| 1 | Volcanoes | Mountains that explode with hot melted rock! |
| 2 | Dinosaurs | Giant creatures that lived millions of years ago. |
| 3 | The Ocean | A whole world of animals and plants lives underwater. |
| 4 | Outer Space | Stars, planets, and everything beyond our sky. |
| 5 | Bugs and Insects | Tiny creatures with superpowers — some can carry 50 times their own weight! |
| 6 | Weather | What makes it rain, snow, and thunder? |
| 7 | How Buildings Are Made | From mud huts to skyscrapers — how do people build things? |
| 8 | Music | What makes sounds into music? How do instruments work? |
| 9 | Animals of Utah | The creatures that live right here in our backyard and mountains. |
| 10 | The Human Body | What's happening inside you right now? |

---

## 8. AI Prompts (Full Versions)

### Lesson Generation Prompt

```
You are a lesson generator for WonderPath, a children's exploration app.

Generate a structured lesson about "{topic}" for a {age}-year-old child
named {name}.

CONTENT GUIDELINES:
- Use only well-established facts from reliable sources: Britannica Kids,
  DK Children's Encyclopedia, National Geographic Kids, NASA Space Place,
  Smithsonian, BBC Bitesize, PBS LearningMedia.
- If you are uncertain about any fact, flag it with [VERIFY] so the
  parent can check.
- Use warm, enthusiastic, age-appropriate language.
- For a 4-year-old: very simple sentences, concrete and sensory
  descriptions, relate everything to the child's experience. Target
  300–500 words total for the narrative.
- For a 7-year-old: slightly more complex vocabulary (but still
  accessible), include cause-and-effect reasoning, some numbers and
  comparisons. Target 500–800 words total for the narrative.
- Include 2–3 narrative sections, each with an image suggestion.
- Include 2–3 "Did You Know?" facts.
- Include 3 open-ended "Wonder Questions" (not quiz questions — genuine
  invitations to think and wonder).

ACTIVITY:
- Choose one activity type from: drawing, labeling, sorting, matching,
  or free response.
- Provide separate instructions for a 4-year-old and a 7-year-old.
- The activity should be completable in 5–10 minutes with a stylus
  on a tablet.

PROJECT CARD:
- Design a hands-on offline project using common household materials.
- Provide separate steps for a 4-year-old (simpler, with adult help)
  and a 7-year-old (more independent).
- Include 2 "wonder questions" to discuss while doing the project.

BRANCHING TOPICS:
- Suggest 3–5 related topics the child might explore next.
- For each, provide a title, a one-sentence teaser (exciting and
  curiosity-provoking), and a one-sentence connection explaining
  how it relates to the current topic.
- At least one branch should be cross-disciplinary (e.g., a science
  topic branching to history, art, or geography).

VIDEO SUGGESTIONS:
- Suggest 1–2 videos from these channels ONLY: SciShow Kids,
  Crash Course Kids, National Geographic Kids, PBS Kids,
  Sesame Street, StoryBots.
- Provide the video title, channel name, and approximate duration.
- If you cannot confidently identify a real video from these channels,
  omit this section entirely rather than guessing.

CONVERSATION STARTERS (for the parent):
- Provide 2 conversation starters the parent can use at dinner to
  discuss this topic with the child.

Respond ONLY with a valid JSON object matching this schema:
{schema}
```

### Q&A Prompt

(See Screen 5 above for the full prompt.)

---

## 9. Nature & Real-World Tie-Ins (Lightweight V1)

Rather than a separate system, nature tie-ins are built into the lesson generation prompt:

- Add to the system prompt: "Where relevant, include a 'Go Find It' suggestion — a simple real-world observation the child can do related to this topic. Examples: 'Go outside and look for three different kinds of rocks in your yard' or 'Tonight, look up at the moon — what shape is it?' These should be specific to the Salt Lake City / Wasatch Front area when possible."
- This gets embedded as an optional field in the lesson JSON and rendered on the project card page of the PDF.

---

## 10. Build Order

### Phase 1: Foundation
- [x] Set up Next.js project on Vercel
- [x] Set up Supabase project (database schema, storage buckets)
- [x] Build profile selection screen
- [x] Build the lesson generation API route (Claude API call → structured JSON)
- [x] Build a minimal lesson viewer (render JSON as HTML, no PDF yet)
- [x] Seed 10 starter topics

### Phase 2: Core Lesson Experience
- [x] Integrate @react-pdf/renderer to generate lesson PDFs from JSON
- [x] Integrate react-pdf to display lesson PDFs in the app
- [x] Build the annotation canvas overlay on PDF pages
- [x] Build TTS narration (browser SpeechSynthesis API)
- [x] Build the AI Q&A panel (Claude Haiku, 5-question cap)
- [x] Build lesson status flow (generating → ready → approved → viewed)
- [x] Integrate image sourcing (Unsplash API)

### Phase 3: Creation & Wonder Book
- [x] Integrate tldraw for freeform drawing activities
- [x] Build "Save to Wonder Book" flow (export PNG, store in Supabase)
- [x] Build the Wonder Book gallery (by date, by topic, family view)
- [x] Build the audio recorder for "Tell Me About It"
- [x] Build photo upload for parent

### Phase 4: Curiosity Map & Dashboard
- [x] Build the curiosity map (SVG force simulation, no external dep)
- [x] Connect branching topics to map (tapping a suggestion creates a new node)
- [x] Build the parent dashboard (timeline, conversation starters, stats)
- [x] Build "Add Topic" for parent
- [x] Implement session timer with soft/gentle/firm nudges

### Phase 5: Polish
- [ ] Print-friendly project card view
- [ ] Age-appropriate UI polish (larger targets for Holland, etc.)
- [ ] Session flow refinement based on testing with the kids
- [ ] Bug fixes and performance optimization
