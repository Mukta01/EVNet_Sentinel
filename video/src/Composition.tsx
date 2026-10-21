import {
  AbsoluteFill, Composition, Html5Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame,
} from "remotion";
import scenes from "./scenes.json";
import durations from "./durations.json";

const FPS = 30;
const PAD = 0.9; // seconds of air after each line
const INTRO = 3.5;
const OUTRO = 4.5;
const FADE = 12; // frames

/** Screens shown under each scene's narration, in order. */
const SHOTS: Record<string, string[]> = {
  hook: ["hook"],
  leak: ["leak"],
  f1: ["f1-models"],
  classes: ["classes"],
  insights: ["insights"],
  story: ["story-threat", "story"],
  flood: ["flood-recommend", "flood-contained"],
  scan: ["scan-restrict", "scan-escalation"],
  car: ["car"],
  harden: ["harden-story", "harden"],
  result: ["result"],
};

type Scene = { id: string; voice: string; title: string; text: string };
const SCENES = scenes as Scene[];
const DUR = durations as Record<string, number>;

const sceneFrames = (s: Scene) => Math.round((DUR[s.id] + PAD) * FPS);
const TOTAL = Math.round(INTRO * FPS) + SCENES.reduce((n, s) => n + sceneFrames(s), 0) + Math.round(OUTRO * FPS);

const C = { bg: "#020617", text: "#F8FAFC", muted: "#94A3B8", green: "#34D399", rose: "#FB7185", amber: "#FBBF24" };
const font = "Inter, ui-sans-serif, system-ui, -apple-system, Helvetica, Arial";

export const MyComposition = () => (
  <Composition id="EVNetSentinel" component={Video} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
);

const Video: React.FC = () => {
  let at = Math.round(INTRO * FPS);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: font }}>
      <Sequence durationInFrames={Math.round(INTRO * FPS)}><TitleCard /></Sequence>
      {SCENES.map((s) => {
        const from = at;
        const len = sceneFrames(s);
        at += len;
        return (
          <Sequence key={s.id} from={from} durationInFrames={len}>
            <SceneView scene={s} len={len} />
          </Sequence>
        );
      })}
      <Sequence from={at} durationInFrames={Math.round(OUTRO * FPS)}><Outro /></Sequence>
    </AbsoluteFill>
  );
};

const fadeInOut = (frame: number, len: number) =>
  interpolate(frame, [0, FADE, len - FADE, len], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const SceneView: React.FC<{ scene: Scene; len: number }> = ({ scene, len }) => {
  const frame = useCurrentFrame();
  const shots = SHOTS[scene.id];
  const per = len / shots.length;
  return (
    <AbsoluteFill style={{ opacity: fadeInOut(frame, len) }}>
      {shots.map((name, i) => {
        const start = i * per;
        const local = frame - start;
        const show = interpolate(local, [-FADE, 0, per, per + FADE], [0, 1, 1, i === shots.length - 1 ? 1 : 0], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
        const zoom = interpolate(local, [0, per], [1.0, 1.06], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return (
          <AbsoluteFill key={name} style={{ opacity: show }}>
            <Img src={staticFile(`shots/${name}.png`)}
              style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${zoom})`, transformOrigin: "50% 40%" }} />
          </AbsoluteFill>
        );
      })}
      {scene.id === "f1" && <F1Card frame={frame} />}
      <Html5Audio src={staticFile(`voice/${scene.id}.wav`)} />
      <Caption scene={scene} frame={frame} len={len - PAD * FPS} />
    </AbsoluteFill>
  );
};

/** The current sentence, timed by its share of the line's characters. */
const Caption: React.FC<{ scene: Scene; frame: number; len: number }> = ({ scene, frame, len }) => {
  const sentences = scene.text.match(/[^.!?:]+[.!?:]?/g)?.map((x) => x.trim()).filter(Boolean) ?? [scene.text];
  const total = sentences.reduce((n, x) => n + x.length, 0);
  let acc = 0;
  let current = sentences[sentences.length - 1];
  for (const sn of sentences) {
    acc += sn.length;
    if (frame < (acc / total) * len) { current = sn; break; }
  }
  // Spoken spellings back to written form for the screen.
  const shown = current
    .replace(/\bE V\b/g, "EV").replace(/\bC S M S\b/g, "CSMS").replace(/\bX G Boost\b/g, "XGBoost").replace(/\bS Y N\b/g, "SYN")
    .replace(/ninety-nine point eight percent/g, "99.8%").replace(/ninety-nine point six percent/g, "99.6%")
    .replace(/ninety-eight percent/g, "98%").replace(/ninety-nine percent/g, "99%").replace(/ninety-six percent/g, "96%")
    .replace(/thirty-four percent/g, "34%").replace(/over eighty percent/g, "over 80%").replace(/one point eight percent/g, "1.8%")
    .replace(/zero point seven\b/g, "0.70").replace(/zero point five five/g, "0.55").replace(/zero point two/g, "0.2")
    .replace(/fifteen/g, "15").replace(/Twenty out of twenty/g, "20 out of 20");
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ background: "linear-gradient(transparent, rgba(2,6,23,0.92) 35%)", padding: "120px 160px 64px" }}>
        <div style={{ color: C.green, fontSize: 26, letterSpacing: 4, textTransform: "uppercase", fontWeight: 600, marginBottom: 14 }}>
          {scene.title}
        </div>
        <div style={{ color: C.text, fontSize: 44, lineHeight: 1.3, fontWeight: 500, maxWidth: 1600 }}>{shown}</div>
      </div>
    </AbsoluteFill>
  );
};

/** Accuracy vs macro-F1 on the published feature set: the reason the project reports F1. */
const F1Card: React.FC<{ frame: number }> = ({ frame }) => {
  const appear = interpolate(frame, [FADE, FADE * 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const bar = (v: number, color: string, label: string, value: string, delay: number) => {
    const w = interpolate(frame, [FADE * 3 + delay, FADE * 3 + delay + 40], [0, v], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
    return (
      <div style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: C.muted, fontSize: 30 }}>
          <span>{label}</span><span style={{ color, fontFamily: "ui-monospace, Menlo" }}>{value}</span>
        </div>
        <div style={{ height: 26, background: "rgba(148,163,184,0.15)", borderRadius: 13, marginTop: 10 }}>
          <div style={{ width: `${w * 100}%`, height: 26, borderRadius: 13, background: color }} />
        </div>
      </div>
    );
  };
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", paddingBottom: 220, opacity: appear }}>
      <div style={{ width: 1100, background: "rgba(2,6,23,0.94)", border: "1px solid rgba(148,163,184,0.25)", borderRadius: 24, padding: "48px 56px" }}>
        <div style={{ color: C.text, fontSize: 40, fontWeight: 600 }}>Same model, two scores</div>
        <div style={{ color: C.muted, fontSize: 28, marginTop: 8 }}>Published feature set · floods are 99% of the flows</div>
        {bar(0.996, C.amber, "Accuracy — dominated by the floods", "99.6%", 0)}
        {bar(0.70, C.green, "Macro-F1 — every class counts equally", "0.70", 18)}
      </div>
    </AbsoluteFill>
  );
};

const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, INTRO * FPS);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o }}>
      <div style={{ color: C.green, fontSize: 30, letterSpacing: 8, fontWeight: 600 }}>EVCS NETWORK INTRUSION DETECTION</div>
      <div style={{ color: C.text, fontSize: 120, fontWeight: 800, marginTop: 24 }}>EVNet Sentinel</div>
      <div style={{ color: C.muted, fontSize: 36, marginTop: 20 }}>Detect · Contain · Harden · Verify</div>
    </AbsoluteFill>
  );
};

const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const o = fadeInOut(frame, OUTRO * FPS);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: o, textAlign: "center" }}>
      <div style={{ color: C.text, fontSize: 84, fontWeight: 800 }}>EVNet Sentinel</div>
      <div style={{ color: C.muted, fontSize: 34, marginTop: 24, maxWidth: 1300, lineHeight: 1.4 }}>
        CICEVSE2024 · leakage-corrected · six models · a closed-loop response replayed on every recorded attack
      </div>
      <div style={{ color: C.muted, fontSize: 28, marginTop: 36 }}>
        Containment shown is simulated and operator-approved. Sentinel itself is a passive IDS.
      </div>
    </AbsoluteFill>
  );
};

/** YouTube thumbnail, 1280×720: rendered as a still. */
export const ThumbnailComposition = () => (
  <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={1280} height={720} />
);

const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: font }}>
    <Img src={staticFile("shots/story.png")}
      style={{ position: "absolute", width: 1280, height: 720, objectFit: "cover", opacity: 0.6, transform: "scale(1.45)", transformOrigin: "88% 78%" }} />
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(2,6,23,1) 0%, rgba(2,6,23,0.96) 48%, rgba(2,6,23,0.25) 100%)" }} />
    <AbsoluteFill style={{ padding: "70px 72px", justifyContent: "center" }}>
      <div style={{ color: C.green, fontSize: 26, letterSpacing: 5, fontWeight: 700 }}>EV CHARGING · INTRUSION DETECTION</div>
      <div style={{ color: C.text, fontSize: 96, fontWeight: 800, lineHeight: 1.0, marginTop: 18 }}>
        The 98% was<br />a <span style={{ color: C.rose }}>data leak.</span>
      </div>
      <div style={{ color: C.text, fontSize: 40, fontWeight: 600, marginTop: 28, lineHeight: 1.25 }}>
        Then we closed the loop:<br /><span style={{ color: C.green }}>detect → contain → verify</span>
      </div>
      <div style={{ color: C.muted, fontSize: 26, marginTop: 30, fontWeight: 500 }}>EVNet Sentinel</div>
    </AbsoluteFill>
  </AbsoluteFill>
);
