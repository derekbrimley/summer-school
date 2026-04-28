import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { LessonJson } from "./types";

const styles = StyleSheet.create({
  page: {
    padding: 48,
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#1a1a1a",
  },
  // Page 1: Lesson content
  titleBlock: { marginBottom: 24 },
  title: { fontSize: 28, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  subtitle: { fontSize: 16, color: "#6b7280" },
  heroImage: { width: "100%", height: 200, marginBottom: 24, objectFit: "cover" },
  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 14, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  body: { lineHeight: 1.6, color: "#374151" },
  infoBox: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoBoxYellow: { backgroundColor: "#fefce8", borderLeft: "4px solid #eab308" },
  infoBoxPurple: { backgroundColor: "#faf5ff", borderLeft: "4px solid #a855f7" },
  infoBoxLabel: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  bullet: { marginBottom: 4, paddingLeft: 8 },
  // Page 2: Activity
  activityPage: { padding: 48, fontFamily: "Helvetica", fontSize: 12, color: "#1a1a1a" },
  activityPromptBox: {
    backgroundColor: "#f0fdf4",
    borderLeft: "4px solid #22c55e",
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  activityLabel: { fontSize: 16, fontFamily: "Helvetica-Bold", marginBottom: 8, color: "#15803d" },
  activityPrompt: { fontSize: 14, lineHeight: 1.5 },
  drawingArea: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 8,
    height: 360,
    marginTop: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  drawingAreaLabel: { color: "#9ca3af", fontSize: 13 },
  // Page 3: Project card
  projectPage: { padding: 48, fontFamily: "Helvetica", fontSize: 12, color: "#1a1a1a" },
  projectTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  projectDesc: { color: "#6b7280", marginBottom: 16 },
  materialsLabel: { fontFamily: "Helvetica-Bold", marginBottom: 6 },
  stepItem: { marginBottom: 4 },
  stepsGrid: { flexDirection: "row", gap: 16 },
  stepsCol: { flex: 1 },
  stepsColLabel: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#6b7280", marginBottom: 4 },
  // Page 4: What's next
  nextPage: { padding: 48, fontFamily: "Helvetica", fontSize: 12, color: "#1a1a1a" },
  nextTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 20 },
  topicGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  topicCard: {
    width: "47%",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
  },
  topicCardTitle: { fontFamily: "Helvetica-Bold", fontSize: 13, marginBottom: 4 },
  topicCardTeaser: { fontSize: 11, color: "#6b7280", marginBottom: 4 },
  topicCardConnection: { fontSize: 10, color: "#9ca3af" },
  pageNumber: { position: "absolute", bottom: 24, right: 48, fontSize: 10, color: "#9ca3af" },
});

function Page1({ content, age }: { content: LessonJson; age: number }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
      </View>

      {content.narrative.map((section, i) => (
        <View key={i} style={styles.section}>
          <Text style={styles.sectionHeading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}

      {content.did_you_know.length > 0 && (
        <View style={[styles.infoBox, styles.infoBoxYellow]}>
          <Text style={styles.infoBoxLabel}>Did You Know?</Text>
          {content.did_you_know.map((fact, i) => (
            <Text key={i} style={styles.bullet}>• {fact}</Text>
          ))}
        </View>
      )}

      {content.wonder_questions.length > 0 && (
        <View style={[styles.infoBox, styles.infoBoxPurple]}>
          <Text style={styles.infoBoxLabel}>Wonder Questions</Text>
          {content.wonder_questions.map((q, i) => (
            <Text key={i} style={styles.bullet}>• {q}</Text>
          ))}
        </View>
      )}

      <Text style={styles.pageNumber}>1</Text>
    </Page>
  );
}

function Page2({ content, age }: { content: LessonJson; age: number }) {
  const instructions = age <= 4
    ? content.activity.instructions_4yo
    : content.activity.instructions_7yo;

  return (
    <Page size="LETTER" style={styles.activityPage}>
      <View style={styles.activityPromptBox}>
        <Text style={styles.activityLabel}>Your Turn!</Text>
        <Text style={styles.activityPrompt}>{content.activity.prompt}</Text>
        {instructions && (
          <Text style={[styles.activityPrompt, { marginTop: 8, color: "#166534" }]}>
            {instructions}
          </Text>
        )}
      </View>

      <View style={styles.drawingArea}>
        <Text style={styles.drawingAreaLabel}>Draw here</Text>
      </View>

      <Text style={styles.pageNumber}>2</Text>
    </Page>
  );
}

function Page3({ content, age }: { content: LessonJson; age: number }) {
  const steps = age <= 4
    ? content.project_card.steps_4yo
    : content.project_card.steps_7yo;

  return (
    <Page size="LETTER" style={styles.projectPage}>
      <Text style={styles.projectTitle}>{content.project_card.title}</Text>
      <Text style={styles.projectDesc}>{content.project_card.description}</Text>

      <Text style={styles.materialsLabel}>Materials:</Text>
      {content.project_card.materials.map((m, i) => (
        <Text key={i} style={styles.bullet}>• {m}</Text>
      ))}

      <View style={{ marginTop: 16 }}>
        <Text style={styles.materialsLabel}>Steps:</Text>
        {steps.map((s, i) => (
          <Text key={i} style={styles.stepItem}>{i + 1}. {s}</Text>
        ))}
      </View>

      {content.project_card.wonder_questions.length > 0 && (
        <View style={[styles.infoBox, styles.infoBoxPurple, { marginTop: 20 }]}>
          <Text style={styles.infoBoxLabel}>Wonder Questions</Text>
          {content.project_card.wonder_questions.map((q, i) => (
            <Text key={i} style={styles.bullet}>• {q}</Text>
          ))}
        </View>
      )}

      <Text style={{ marginTop: 20, color: "#9ca3af", fontSize: 11 }}>
        📸 Take a photo of your project!
      </Text>

      <Text style={styles.pageNumber}>3</Text>
    </Page>
  );
}

function Page4({ content }: { content: LessonJson }) {
  return (
    <Page size="LETTER" style={styles.nextPage}>
      <Text style={styles.nextTitle}>Where Will You Explore Next?</Text>
      <View style={styles.topicGrid}>
        {content.branching_topics.map((bt, i) => (
          <View key={i} style={styles.topicCard}>
            <Text style={styles.topicCardTitle}>{bt.title}</Text>
            <Text style={styles.topicCardTeaser}>{bt.teaser}</Text>
            <Text style={styles.topicCardConnection}>{bt.connection}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.pageNumber}>4</Text>
    </Page>
  );
}

export function LessonDocument({ content, age }: { content: LessonJson; age: number }) {
  return (
    <Document>
      <Page1 content={content} age={age} />
      <Page2 content={content} age={age} />
      <Page3 content={content} age={age} />
      <Page4 content={content} />
    </Document>
  );
}
