import { useCallback, useEffect, useRef, useState } from "react";
import {
  MILESTONES,
  MONTHS_LIST,
  MONTH_NAMES,
  QUOTES,
  SCHEDULE_RAW,
  getDailyQuoteIdx,
  getTodayStr,
} from "./data/schedule";
import type { DaySchedule } from "./data/schedule";
import { useActor } from "./hooks/useActor";
import { useClock } from "./hooks/useClock";
import { useGateState } from "./hooks/useGateState";
import { useInternetIdentity } from "./hooks/useInternetIdentity";

// ==================== HELPERS ====================
const TAG_COLOR: Record<string, string> = {
  math: "var(--math)",
  cdsa: "var(--cdsa)",
  core: "var(--core)",
  weak: "var(--weak)",
  apt: "var(--apt)",
};
const TAG_BG: Record<string, string> = {
  math: "var(--math-d)",
  cdsa: "var(--cdsa-d)",
  core: "var(--core-d)",
  weak: "var(--weak-d)",
  apt: "var(--apt-d)",
};
const TAG_LABEL: Record<string, string> = {
  math: "MATH",
  cdsa: "C/DSA",
  core: "CS CORE",
  weak: "WEAK",
  apt: "APT",
};
const PHASE_LABEL = [
  "",
  "PHASE 1 · COLLEGE",
  "PHASE 2 · EXAMS",
  "PHASE 3 · HOLIDAY 🔥",
  "PHASE 4 · REVISION",
];
const PHASE_CLASS = ["", "p1", "p2", "p3", "p4"];

function getTagClass(tag: string, slot: string) {
  if (slot === "light") return "tag-light";
  if (slot === "math") return "tag-math";
  if (slot === "cdsa") return "tag-cdsa";
  if (tag === "weak") return "tag-weak";
  if (tag === "apt") return "tag-apt";
  return "tag-cs";
}
function getSlotLabel(slot: string, tag: string) {
  if (slot === "math") return "MATH";
  if (slot === "cdsa") return "C/DSA";
  if (slot === "light") return "LIGHT";
  return TAG_LABEL[tag] || "CS CORE";
}

function calcStreak(done: Record<string, Record<number, boolean>>) {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const day = SCHEDULE_RAW.find((x) => x.date === ds);
    if (!day || !day.lectures.length) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    const dayDone = done[ds];
    if (dayDone && day.lectures.every((_, idx) => dayDone[idx])) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

function getTotalLectures() {
  return SCHEDULE_RAW.reduce((s, d) => s + d.lectures.length, 0);
}
function getCompletedLectures(done: Record<string, Record<number, boolean>>) {
  return Object.values(done).reduce((s, v) => s + Object.keys(v).length, 0);
}
function getWeekLectures(done: Record<string, Record<number, boolean>>) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  let count = 0;
  for (const date in done) {
    const d = new Date(date);
    if (d >= startOfWeek && d <= today) count += Object.keys(done[date]).length;
  }
  return count;
}
function countTestsDone(tests: Record<string, Record<number, boolean>>) {
  return Object.values(tests).reduce((s, v) => s + Object.keys(v).length, 0);
}

// ==================== SUB-COMPONENTS ====================

function ProgressBar({
  pct,
  color,
  height = 3,
}: { pct: number; color: string; height?: number }) {
  return (
    <div className="progress-track" style={{ height }}>
      <div
        className="progress-fill"
        style={{ width: `${Math.min(100, pct)}%`, background: color }}
      />
    </div>
  );
}

function LecItem({
  subj,
  lec,
  total,
  tag,
  slot,
  done,
  onToggle,
}: {
  subj: string;
  lec: number;
  total: number;
  tag: string;
  slot: string;
  done: boolean;
  onToggle: () => void;
}) {
  const tagClass = getTagClass(tag, slot);
  const slotLabel = getSlotLabel(slot, tag);
  const _color = TAG_COLOR[tag] || "var(--text2)";
  return (
    <button
      type="button"
      className={`lec-item ${done ? "completed" : ""}`}
      onClick={onToggle}
      style={{
        borderLeft: `3px solid ${done ? "var(--done)" : TAG_COLOR[tag] || "var(--border2)"}`,
        width: "100%",
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      <span
        className={`lec-badge ${tagClass}`}
        style={{
          fontSize: "9px",
          padding: "3px 8px",
          borderRadius: "4px",
          fontWeight: 700,
          letterSpacing: "0.5px",
          flexShrink: 0,
        }}
      >
        {slotLabel}
      </span>
      <div style={{ flex: 1 }}>
        <div
          className="lec-subj"
          style={{
            fontSize: "13px",
            color: done ? "var(--text3)" : "var(--text)",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {subj}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: 1 }}>
          LECTURE {lec} / {total}
        </div>
      </div>
      <div className={`check-circle ${done ? "done" : ""}`}>
        {done ? "✓" : ""}
      </div>
    </button>
  );
}

function TestAlert({
  subj,
  test_num,
  chapter,
  done,
  onToggle,
}: {
  subj: string;
  test_num: string;
  chapter: string;
  done: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="test-alert">
      <div style={{ fontSize: 16 }}>📝</div>
      <div style={{ flex: 1 }}>
        <div
          style={{ fontSize: "13px", color: "var(--gold)", fontWeight: 600 }}
        >
          TEST DUE: {subj} — {test_num}
        </div>
        <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: 2 }}>
          Chapter: {chapter} · Attempt today (1 hour)
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        style={{
          marginLeft: "auto",
          background: done ? "rgba(251,191,36,0.2)" : "none",
          border: "1px solid rgba(251,191,36,0.4)",
          color: done ? "#fff" : "var(--gold)",
          padding: "4px 10px",
          borderRadius: "4px",
          fontSize: "10px",
          cursor: "pointer",
          fontFamily: "JetBrains Mono, monospace",
          transition: "all 0.2s",
        }}
      >
        {done ? "✓ DONE" : "MARK DONE"}
      </button>
    </div>
  );
}

// ==================== HOME PANEL ====================
function HomePanel({
  state,
  markLecture,
  markTest,
  quoteIdx,
  onPrevQuote,
  onNextQuote,
}: {
  state: ReturnType<typeof useGateState>["state"];
  markLecture: (d: string, i: number, v: boolean) => void;
  markTest: (d: string, i: number, v: boolean) => void;
  quoteIdx: number;
  onPrevQuote: () => void;
  onNextQuote: () => void;
}) {
  const today = getTodayStr();
  const day = SCHEDULE_RAW.find((d) => d.date === today) || SCHEDULE_RAW[0];
  const total = getTotalLectures();
  const completed = getCompletedLectures(state.done);
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const streak = calcStreak(state.done);
  const weekLecs = getWeekLectures(state.done);
  const testsDone = countTestsDone(state.tests);
  const daysToAug = Math.max(
    0,
    Math.ceil((new Date("2026-08-10").getTime() - Date.now()) / 86400000),
  );

  const stats = [
    {
      label: "TOTAL LECTURES",
      val: total,
      sub: "across 19 subjects",
      color: "var(--math)",
      pct: 100,
      icon: "📚",
    },
    {
      label: "COMPLETED",
      val: completed,
      sub: `${pct}% of total`,
      color: "var(--cdsa)",
      pct,
      icon: "✅",
    },
    {
      label: "REMAINING",
      val: total - completed,
      sub: `${100 - pct}% to go`,
      color: "var(--weak)",
      pct: 100 - pct,
      icon: "⏳",
    },
    {
      label: "DAYS TO AUG 10",
      val: daysToAug,
      sub: "lecture deadline",
      color: "var(--gold)",
      pct: 100,
      icon: "📅",
    },
    {
      label: "TESTS PASSED",
      val: testsDone,
      sub: "chapter tests",
      color: "var(--apt)",
      pct: 100,
      icon: "📝",
    },
    {
      label: "STREAK",
      val: streak,
      sub: "consecutive days",
      color: "var(--test)",
      pct: 100,
      icon: "🔥",
    },
  ];

  const q = QUOTES[quoteIdx];

  // Upcoming tests
  const upcoming: Array<{
    date: string;
    test: { subj: string; test_num: string; chapter: string };
    idx: number;
  }> = [];
  for (const d of SCHEDULE_RAW) {
    if (d.date < today) continue;
    for (let i = 0; i < d.tests.length; i++) {
      if (!state.tests[d.date]?.[i])
        upcoming.push({ date: d.date, test: d.tests[i], idx: i });
    }
    if (upcoming.length >= 5) break;
  }

  // Heatmap
  const heatDays = SCHEDULE_RAW.filter((d) => d.lectures.length > 0);

  return (
    <div className="panel-enter">
      {/* Quote hero */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--card), var(--card2))",
          border: "1px solid var(--border2)",
          borderRadius: "16px",
          padding: "28px",
          textAlign: "center",
          marginBottom: "20px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            fontFamily: "Crimson Pro, serif",
            fontSize: "120px",
            color: "rgba(99,102,241,0.08)",
            position: "absolute",
            top: "-20px",
            left: "20px",
            lineHeight: 1,
            pointerEvents: "none",
          }}
        >
          “
        </div>
        <div
          style={{
            fontFamily: "Crimson Pro, serif",
            fontStyle: "italic",
            fontSize: "clamp(15px,2vw,20px)",
            lineHeight: 1.7,
            color: "var(--text)",
            maxWidth: "700px",
            margin: "0 auto 10px",
            position: "relative",
            zIndex: 1,
          }}
        >
          “{q.text}”
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--accent2)",
            letterSpacing: "2px",
          }}
        >
          — {q.author}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            marginTop: "12px",
          }}
        >
          {[
            { fn: onPrevQuote, label: "prev" },
            { fn: onNextQuote, label: "next" },
          ].map(({ fn, label }) => (
            <button
              type="button"
              key={label}
              onClick={fn}
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                borderRadius: "50%",
                width: "28px",
                height: "28px",
                color: "var(--text2)",
                cursor: "pointer",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {label === "prev" ? "←" : "→"}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: "14px",
          marginBottom: "24px",
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="glass-card" style={{ padding: "18px" }}>
            <div style={{ fontSize: "20px", marginBottom: "8px" }}>
              {s.icon}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              {s.label}
            </div>
            <div
              className="font-bebas"
              style={{
                fontSize: "38px",
                lineHeight: 1,
                color: s.color,
                marginBottom: "4px",
              }}
            >
              {s.val}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)" }}>
              {s.sub}
            </div>
            <ProgressBar pct={s.pct} color={s.color} />
          </div>
        ))}
      </div>

      {/* Main row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: "16px",
          marginBottom: "20px",
        }}
        className="today-main-responsive"
      >
        {/* Today's plan */}
        <div className="glass-card" style={{ padding: "20px" }}>
          <div
            className="font-bebas"
            style={{
              fontSize: "18px",
              letterSpacing: "2px",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--accent)",
                display: "inline-block",
              }}
            />
            TODAY’S PLAN —{" "}
            <span style={{ color: "var(--accent2)", fontSize: "15px" }}>
              {new Date(day.date)
                .toLocaleDateString("en-IN", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
                .toUpperCase()}
            </span>
          </div>

          {/* Tests */}
          {day.tests.map((t, i) => (
            <TestAlert
              key={`${t.subj}-${t.test_num}`}
              {...t}
              done={!!state.tests[day.date]?.[i]}
              onToggle={() =>
                markTest(day.date, i, !state.tests[day.date]?.[i])
              }
            />
          ))}

          {/* Lectures */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {day.isRevision && day.lectures.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--text3)",
                  fontSize: "13px",
                }}
              >
                🏆 ALL LECTURES COMPLETE! Today is REVISION & PYQ day.
                <br />
                <span style={{ color: "var(--cdsa)" }}>
                  Focus on previous year questions and mock tests.
                </span>
              </div>
            ) : day.lectures.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "var(--text3)",
                  fontSize: "13px",
                }}
              >
                No lectures scheduled today.
              </div>
            ) : (
              day.lectures.map((l, i) => (
                <LecItem
                  key={`${l.subj}-${l.lec}`}
                  {...l}
                  done={!!state.done[day.date]?.[i]}
                  onToggle={() =>
                    markLecture(day.date, i, !state.done[day.date]?.[i])
                  }
                />
              ))
            )}
          </div>

          <div
            style={{
              marginTop: "12px",
              paddingTop: "12px",
              borderTop: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "10px", color: "var(--text3)" }}>
              CLICK LECTURES TO MARK COMPLETE
            </span>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Streak card */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <div
              className="font-bebas"
              style={{
                fontSize: "15px",
                letterSpacing: "2px",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--cdsa)",
                  display: "inline-block",
                }}
              />
              STREAK & STATS
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px",
                background: "var(--bg3)",
                borderRadius: "10px",
                marginBottom: "12px",
              }}
            >
              <div
                className="font-bebas"
                style={{
                  fontSize: "52px",
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                {streak}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text3)",
                  lineHeight: 1.6,
                }}
              >
                day streak
                <br />
                <span style={{ color: "var(--gold)" }}>🔥</span> Keep it alive!
                <br />
                <span>Best: {state.bestStreak}</span>
              </div>
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                marginBottom: "4px",
              }}
            >
              LECTURES THIS WEEK
            </div>
            <div
              className="font-bebas"
              style={{ fontSize: "28px", color: "var(--text)" }}
            >
              {weekLecs}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                marginTop: "8px",
                marginBottom: "4px",
              }}
            >
              TOTAL COMPLETED
            </div>
            <div
              className="font-bebas"
              style={{ fontSize: "28px", color: "var(--cdsa)" }}
            >
              {completed}
            </div>
          </div>

          {/* Upcoming tests */}
          <div className="glass-card" style={{ padding: "18px" }}>
            <div
              className="font-bebas"
              style={{
                fontSize: "15px",
                letterSpacing: "2px",
                marginBottom: "12px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--gold)",
                  display: "inline-block",
                }}
              />
              UPCOMING TESTS
            </div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: "12px", color: "var(--text3)" }}>
                All upcoming tests done! 🎉
              </div>
            ) : (
              upcoming.map((u) => {
                const diff = Math.ceil(
                  (new Date(u.date).getTime() - Date.now()) / 86400000,
                );
                return (
                  <div
                    key={`${u.date}-${u.test.subj}-${u.test.test_num}`}
                    style={{
                      padding: "7px 0",
                      borderBottom: "1px solid var(--border)",
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--test-d)",
                        color: "var(--gold)",
                        fontSize: "9px",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {diff <= 0
                        ? "TODAY"
                        : diff === 1
                          ? "TOMORROW"
                          : `${diff}D`}
                    </div>
                    <div>
                      <div style={{ fontSize: "12px", color: "var(--text)" }}>
                        {u.test.subj} · {u.test.test_num}
                      </div>
                      <div style={{ fontSize: "9px", color: "var(--text3)" }}>
                        {u.date} · {u.test.chapter}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="glass-card" style={{ padding: "20px" }}>
        <div
          className="font-bebas"
          style={{
            fontSize: "18px",
            letterSpacing: "2px",
            marginBottom: "8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "var(--rev)",
              display: "inline-block",
            }}
          />
          ACTIVITY HEATMAP
        </div>
        <div
          style={{
            fontSize: "9px",
            color: "var(--text3)",
            marginBottom: "10px",
          }}
        >
          MARCH 2026 → AUGUST 2026 · EACH CELL = 1 DAY
        </div>
        <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
          {heatDays.map((d) => {
            const total = d.lectures.length;
            const done2 = state.done[d.date]
              ? Object.keys(state.done[d.date]).length
              : 0;
            const level =
              total === 0
                ? 0
                : done2 === 0
                  ? 0
                  : done2 < total * 0.25
                    ? 1
                    : done2 < total * 0.5
                      ? 2
                      : done2 < total
                        ? 3
                        : done2 === total
                          ? 5
                          : 4;
            return (
              <div
                key={d.date}
                className={`heat-cell heat-${level}`}
                title={`${d.date}: ${done2}/${total} done`}
              />
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            marginTop: "10px",
            fontSize: "9px",
            color: "var(--text3)",
          }}
        >
          <span>LESS</span>
          {[0, 1, 2, 3, 5].map((l) => (
            <div key={l} className={`heat-cell heat-${l}`} />
          ))}
          <span>MORE</span>
        </div>
      </div>
    </div>
  );
}

// ==================== CALENDAR PANEL ====================
function CalendarPanel({
  state,
  markLecture,
  markTest,
}: {
  state: ReturnType<typeof useGateState>["state"];
  markLecture: (d: string, i: number, v: boolean) => void;
  markTest: (d: string, i: number, v: boolean) => void;
}) {
  const todayStr = getTodayStr();
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const months = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const selectedDay = selectedDate
    ? SCHEDULE_RAW.find((d) => d.date === selectedDate)
    : null;

  return (
    <div
      className="panel-enter"
      style={{ width: "100%", overflowX: "hidden", boxSizing: "border-box" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => {
            let m = calMonth - 1;
            let y = calYear;
            if (m < 0) {
              m = 11;
              y--;
            }
            setCalMonth(m);
            setCalYear(y);
            setSelectedDate(null);
          }}
        >
          ← PREV
        </button>
        <div
          className="font-bebas"
          style={{ fontSize: "24px", letterSpacing: "2px" }}
        >
          {months[calMonth]} {calYear}
        </div>
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => {
            let m = calMonth + 1;
            let y = calYear;
            if (m > 11) {
              m = 0;
              y++;
            }
            setCalMonth(m);
            setCalYear(y);
            setSelectedDate(null);
          }}
        >
          NEXT →
        </button>
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => {
            setCalYear(now.getFullYear());
            setCalMonth(now.getMonth());
            setSelectedDate(null);
          }}
          style={{ marginLeft: "auto" }}
        >
          GO TO TODAY
        </button>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          flexWrap: "wrap",
          marginBottom: "16px",
        }}
      >
        {[
          ["var(--math)", "MATH"],
          ["var(--cdsa)", "C/DSA"],
          ["var(--core)", "CS CORE"],
          ["var(--weak)", "WEAK"],
          ["var(--gold)", "TEST ●"],
          ["var(--done)", "DONE"],
        ].map(([c, l]) => (
          <div
            key={l}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "10px",
              color: "var(--text3)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: c,
              }}
            />
            {l}
          </div>
        ))}
      </div>

      {/* Days of week */}
      <div
        className="cal-grid-mobile"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "3px",
          marginBottom: "3px",
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        {["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: "9px",
              color: "var(--text3)",
              padding: "4px 0",
              letterSpacing: "1px",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div
        className="cal-grid-mobile"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "3px",
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        {Array.from({ length: firstDay }, (_, idx) => `empty-cal-${idx}`).map(
          (k) => (
            <div key={k} className="cal-cell empty" />
          ),
        )}
        {Array.from({ length: daysInMonth }, (_v, idx) => idx + 1).map(
          (day) => {
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const sched = SCHEDULE_RAW.find((d) => d.date === dateStr);
            const isToday = dateStr === todayStr;
            const doneCount = state.done[dateStr]
              ? Object.keys(state.done[dateStr]).length
              : 0;
            const lecCount = sched?.lectures.length || 0;
            const allDone = lecCount > 0 && doneCount >= lecCount;
            const hasTest = sched?.tests.length;

            let cls = "cal-cell";
            if (isToday) cls += " today";
            if (sched?.isExam) cls += " exam-day";
            else if (sched?.isHoliday) cls += " holiday-day";
            else if (sched?.isRevision) cls += " rev-day";

            return (
              <button
                type="button"
                key={dateStr}
                className={cls}
                onClick={() =>
                  setSelectedDate(dateStr === selectedDate ? null : dateStr)
                }
                style={{
                  textAlign: "left",
                  width: "100%",
                  overflow: "hidden",
                  boxSizing: "border-box",
                }}
              >
                {hasTest ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--gold)",
                      boxShadow: "0 0 4px var(--gold)",
                    }}
                  />
                ) : null}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "3px",
                  }}
                >
                  <span
                    className="font-bebas"
                    style={{
                      fontSize: "15px",
                      color: allDone ? "var(--done)" : "var(--text2)",
                    }}
                  >
                    {day}
                  </span>
                  {isToday && (
                    <div
                      style={{
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        background: "var(--accent)",
                      }}
                    />
                  )}
                </div>
                {sched?.lectures.slice(0, 2).map((l) => {
                  const tc =
                    l.slot === "math"
                      ? "tag-math"
                      : l.slot === "cdsa"
                        ? "tag-cdsa"
                        : l.tag === "weak"
                          ? "tag-weak"
                          : l.tag === "apt"
                            ? "tag-apt"
                            : "tag-cs";
                  return (
                    <div
                      key={`${l.subj}-${l.lec}`}
                      className={`cal-lec ${tc}`}
                      style={{
                        fontSize: "8px",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        marginBottom: "1px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.subj.split(" ").slice(0, 2).join(" ")} L{l.lec}
                    </div>
                  );
                })}
                {lecCount > 2 && (
                  <div style={{ fontSize: "8px", color: "var(--text3)" }}>
                    +{lecCount - 2} more
                  </div>
                )}
                {allDone && (
                  <div
                    style={{
                      fontSize: "8px",
                      color: "var(--done)",
                      marginTop: "2px",
                    }}
                  >
                    ✓ DONE
                  </div>
                )}
                {sched?.isRevision &&
                  (sched?.lectures?.length ?? 0) === 0 &&
                  !allDone && (
                    <div style={{ fontSize: "8px", color: "var(--rev)" }}>
                      REVISION
                    </div>
                  )}
              </button>
            );
          },
        )}
      </div>

      {/* Day detail */}
      {selectedDate && (
        <div
          style={{
            background: "var(--card)",
            border: "1px solid var(--border2)",
            borderRadius: "14px",
            padding: "20px",
            marginTop: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                {new Date(selectedDate).toLocaleDateString("en-IN", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text3)",
                  marginTop: "2px",
                }}
              >
                {selectedDay
                  ? `${PHASE_LABEL[selectedDay.phase]} · ${selectedDay.hours}h · ${selectedDay.lectures.length} lectures`
                  : "No schedule"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                color: "var(--text3)",
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                cursor: "pointer",
                fontFamily: "JetBrains Mono, monospace",
              }}
            >
              CLOSE
            </button>
          </div>
          {selectedDay?.tests.map((t, i) => (
            <TestAlert
              key={`${t.subj}-${t.test_num}`}
              {...t}
              done={!!state.tests[selectedDate]?.[i]}
              onToggle={() =>
                markTest(selectedDate, i, !state.tests[selectedDate]?.[i])
              }
            />
          ))}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {!selectedDay ||
            (selectedDay.isRevision && selectedDay.lectures.length === 0) ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "12px",
                  color: "var(--text3)",
                  fontSize: "13px",
                }}
              >
                {selectedDay?.isRevision
                  ? "🏆 REVISION DAY — PYQ practice."
                  : "No lectures scheduled."}
              </div>
            ) : (
              selectedDay.lectures.map((l, i) => (
                <LecItem
                  key={`${l.subj}-${l.lec}`}
                  {...l}
                  done={!!state.done[selectedDate]?.[i]}
                  onToggle={() =>
                    markLecture(selectedDate, i, !state.done[selectedDate]?.[i])
                  }
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== WEEKLY PANEL ====================
function WeeklyPanel({
  state,
  markLecture,
  markTest,
}: {
  state: ReturnType<typeof useGateState>["state"];
  markLecture: (d: string, i: number, v: boolean) => void;
  markTest: (d: string, i: number, v: boolean) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const todayStr = getTodayStr();

  const getWeekDays = (off: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + off * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
  };

  const days = getWeekDays(offset);
  let totalLecs = 0;
  let doneLecs = 0;
  let totalTests = 0;
  let doneTests = 0;
  for (const ds of days) {
    const sched = SCHEDULE_RAW.find((d) => d.date === ds);
    if (!sched) continue;
    totalLecs += sched.lectures.length;
    doneLecs += state.done[ds] ? Object.keys(state.done[ds]).length : 0;
    totalTests += sched.tests.length;
    sched.tests.forEach((_, i) => {
      if (state.tests[ds]?.[i]) doneTests++;
    });
  }

  return (
    <div className="panel-enter">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => setOffset((o) => o - 1)}
        >
          ← PREV WEEK
        </button>
        <div
          className="font-bebas"
          style={{ fontSize: "20px", letterSpacing: "2px" }}
        >
          WEEK OF {days[0]} → {days[6]}
        </div>
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => setOffset((o) => o + 1)}
        >
          NEXT WEEK →
        </button>
        <button
          type="button"
          className="cal-nav-btn"
          onClick={() => setOffset(0)}
          style={{ marginLeft: "auto" }}
        >
          THIS WEEK
        </button>
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          display: "flex",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        {[
          ["LECTURES", `${doneLecs} / ${totalLecs}`, "var(--cdsa)"],
          ["TESTS", `${doneTests} / ${totalTests}`, "var(--gold)"],
          [
            "COMPLETION",
            `${totalLecs > 0 ? Math.round((doneLecs / totalLecs) * 100) : 0}%`,
            "var(--math)",
          ],
        ].map(([l, v, c]) => (
          <div key={l}>
            <div style={{ fontSize: "9px", color: "var(--text3)" }}>
              {l} THIS WEEK
            </div>
            <div className="font-bebas" style={{ fontSize: "24px", color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7,1fr)",
          gap: "8px",
        }}
        className="week-grid-responsive"
      >
        {days.map((dateStr) => {
          const sched = SCHEDULE_RAW.find((d) => d.date === dateStr);
          const d = new Date(dateStr);
          const dayName = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][
            d.getDay()
          ];
          const isToday = dateStr === todayStr;
          const doneCount = state.done[dateStr]
            ? Object.keys(state.done[dateStr]).length
            : 0;
          const lecs = sched?.lectures || [];

          let cardStyle: React.CSSProperties = {
            background: "var(--card)",
            border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "10px",
            padding: "12px",
            cursor: "pointer",
            transition: "all 0.2s",
          };
          if (sched?.isExam) cardStyle.background = "rgba(251,191,36,0.04)";
          else if (sched?.isHoliday)
            cardStyle.background = "rgba(52,211,153,0.04)";

          return (
            <button
              type="button"
              key={dateStr}
              style={{
                ...cardStyle,
                textAlign: "left",
                width: "100%",
                cursor: "pointer",
              }}
              onClick={() =>
                setSelectedDate(dateStr === selectedDate ? null : dateStr)
              }
            >
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text3)",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}
              >
                {dayName}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text2)",
                  marginBottom: "6px",
                }}
              >
                {d.getDate()}/{d.getMonth() + 1}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--text3)",
                  marginBottom: "6px",
                }}
              >
                {sched?.hours || 0}h · {lecs.length} lec · {doneCount}/
                {lecs.length} done
              </div>
              {sched?.tests.length ? (
                <div
                  style={{
                    background: "var(--test-d)",
                    color: "var(--gold)",
                    fontSize: "9px",
                    padding: "1px 5px",
                    borderRadius: "3px",
                    marginBottom: "4px",
                    display: "inline-block",
                  }}
                >
                  📝 {sched.tests.length} TEST
                  {sched.tests.length > 1 ? "S" : ""}
                </div>
              ) : null}
              {lecs.slice(0, 3).map((l, i) => {
                const tc =
                  l.slot === "math"
                    ? "tag-math"
                    : l.slot === "cdsa"
                      ? "tag-cdsa"
                      : l.tag === "weak"
                        ? "tag-weak"
                        : "tag-cs";
                const done = state.done[dateStr]?.[i];
                return (
                  <div
                    key={`${l.subj}-${l.lec}`}
                    className={`wday-lec ${tc}`}
                    style={{
                      fontSize: "9px",
                      padding: "2px 5px",
                      borderRadius: "3px",
                      marginBottom: "2px",
                      opacity: done ? 0.5 : 1,
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {done ? "✓ " : ""}
                    {l.subj.split(" ").slice(0, 2).join(" ")} L{l.lec}
                  </div>
                );
              })}
              {sched?.isRevision && (sched?.lectures?.length ?? 0) === 0 && (
                <div style={{ fontSize: "9px", color: "var(--cdsa)" }}>
                  🏆 REVISION
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate &&
        (() => {
          const selDay = SCHEDULE_RAW.find((d) => d.date === selectedDate);
          return (
            <div
              style={{
                background: "var(--card)",
                border: "1px solid var(--border2)",
                borderRadius: "14px",
                padding: "20px",
                marginTop: "16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                }}
              >
                <div style={{ fontSize: "15px", color: "var(--text)" }}>
                  {new Date(selectedDate).toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  style={{
                    background: "none",
                    border: "1px solid var(--border)",
                    color: "var(--text3)",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    fontFamily: "JetBrains Mono",
                  }}
                >
                  CLOSE
                </button>
              </div>
              {selDay?.tests.map((t, i) => (
                <TestAlert
                  key={`${t.subj}-${t.test_num}`}
                  {...t}
                  done={!!state.tests[selectedDate]?.[i]}
                  onToggle={() =>
                    markTest(selectedDate, i, !state.tests[selectedDate]?.[i])
                  }
                />
              ))}
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {!selDay ||
                (selDay.isRevision && selDay.lectures.length === 0) ? (
                  <div style={{ color: "var(--text3)", fontSize: "13px" }}>
                    Revision day
                  </div>
                ) : (
                  selDay.lectures.map((l, i) => (
                    <LecItem
                      key={`${l.subj}-${l.lec}`}
                      {...l}
                      done={!!state.done[selectedDate]?.[i]}
                      onToggle={() =>
                        markLecture(
                          selectedDate,
                          i,
                          !state.done[selectedDate]?.[i],
                        )
                      }
                    />
                  ))
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}

// ==================== MONTHLY PANEL ====================
function MonthlyPanel({
  state,
}: { state: ReturnType<typeof useGateState>["state"] }) {
  const [activeMonth, setActiveMonth] = useState("2026-03");

  const days = SCHEDULE_RAW.filter((d) => d.date.startsWith(activeMonth));
  const subjCounts: Record<
    string,
    { total: number; done: number; tag: string }
  > = {};
  let totalLecs = 0;
  let doneLecs = 0;
  for (const d of days) {
    d.lectures.forEach((l, i) => {
      if (!subjCounts[l.subj])
        subjCounts[l.subj] = { total: 0, done: 0, tag: l.tag };
      subjCounts[l.subj].total++;
      totalLecs++;
      if (state.done[d.date]?.[i]) {
        subjCounts[l.subj].done++;
        doneLecs++;
      }
    });
  }
  const pct = totalLecs > 0 ? Math.round((doneLecs / totalLecs) * 100) : 0;

  return (
    <div className="panel-enter">
      <div
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        {MONTHS_LIST.map((m) => (
          <button
            type="button"
            key={m}
            onClick={() => setActiveMonth(m)}
            style={{
              padding: "6px 14px",
              borderRadius: "7px",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "JetBrains Mono",
              letterSpacing: "0.5px",
              transition: "all 0.15s",
              background: m === activeMonth ? "var(--accent)" : "var(--bg3)",
              border: `1px solid ${m === activeMonth ? "var(--accent)" : "var(--border)"}`,
              color: m === activeMonth ? "#fff" : "var(--text2)",
            }}
          >
            {MONTH_NAMES[m].split(" ")[0].toUpperCase()}
          </button>
        ))}
      </div>

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <div
              className="font-bebas"
              style={{ fontSize: "22px", letterSpacing: "2px" }}
            >
              {MONTH_NAMES[activeMonth].toUpperCase()}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                marginTop: "2px",
              }}
            >
              {days.length} DAYS · {totalLecs} LECTURES SCHEDULED
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              className="font-bebas"
              style={{ fontSize: "28px", color: "var(--cdsa)" }}
            >
              {doneLecs}/{totalLecs}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text3)" }}>
              {pct}% DONE
            </div>
            <div style={{ marginTop: "6px", width: "120px" }}>
              <ProgressBar pct={pct} color="var(--cdsa)" height={4} />
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "18px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "20px",
          }}
          className="month-body-responsive"
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                marginBottom: "10px",
                letterSpacing: "1px",
              }}
            >
              SUBJECTS THIS MONTH
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {Object.entries(subjCounts).map(([name, info]) => {
                const color = TAG_COLOR[info.tag] || "var(--text2)";
                const p =
                  info.total > 0
                    ? Math.round((info.done / info.total) * 100)
                    : 0;
                return (
                  <div
                    key={name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          style={{ fontSize: "12px", color: "var(--text2)" }}
                        >
                          {name}
                        </span>
                        <span
                          style={{ fontSize: "12px", color: "var(--text3)" }}
                        >
                          {info.done}/{info.total}
                        </span>
                      </div>
                      <ProgressBar pct={p} color={color} height={2} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                marginBottom: "10px",
                letterSpacing: "1px",
              }}
            >
              KEY MILESTONES
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {(MILESTONES[activeMonth] || []).map((m) => {
                const isWarn = m.startsWith("⚠️");
                const isInfo = m.startsWith("📝") || m.startsWith("📅");
                return (
                  <div
                    key={m.slice(0, 40)}
                    style={{
                      fontSize: "12px",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      borderLeft: `2px solid ${isWarn ? "var(--gold)" : isInfo ? "var(--accent2)" : "var(--cdsa)"}`,
                      background: isWarn
                        ? "var(--test-d)"
                        : isInfo
                          ? "var(--math-d)"
                          : "var(--cdsa-d)",
                      color: isWarn
                        ? "var(--gold)"
                        : isInfo
                          ? "var(--accent2)"
                          : "var(--cdsa)",
                    }}
                  >
                    {m}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== SUBJECTS PANEL ====================
function SubjectsPanel({
  state,
}: { state: ReturnType<typeof useGateState>["state"] }) {
  const subjData: Record<string, { total: number; done: number; tag: string }> =
    {};
  const allTests: Array<{
    date: string;
    test: { subj: string; test_num: string; chapter: string };
    done: boolean;
  }> = [];

  for (const day of SCHEDULE_RAW) {
    day.lectures.forEach((l, i) => {
      if (!subjData[l.subj])
        subjData[l.subj] = { total: 0, done: 0, tag: l.tag };
      subjData[l.subj].total++;
      if (state.done[day.date]?.[i]) subjData[l.subj].done++;
    });
    day.tests.forEach((t, i) => {
      allTests.push({
        date: day.date,
        test: t,
        done: !!state.tests[day.date]?.[i],
      });
    });
  }

  return (
    <div className="panel-enter">
      <div
        className="font-bebas"
        style={{
          fontSize: "18px",
          letterSpacing: "2px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
          }}
        />
        SUBJECT-WISE PROGRESS
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "10px",
          marginBottom: "24px",
        }}
      >
        {Object.entries(subjData).map(([name, info]) => {
          const pct =
            info.total > 0 ? Math.round((info.done / info.total) * 100) : 0;
          const color = TAG_COLOR[info.tag] || "var(--text2)";
          const tagLabel = TAG_LABEL[info.tag] || "CS CORE";
          return (
            <div
              key={name}
              style={{
                background: "var(--card2)",
                border: "1px solid var(--border)",
                borderTop: `3px solid ${color}`,
                borderRadius: "10px",
                padding: "12px",
                transition: "all 0.2s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "6px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--text)",
                    lineHeight: 1.3,
                  }}
                >
                  {name}
                </div>
                <span
                  style={{
                    fontSize: "8px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    background: TAG_BG[info.tag] || "var(--bg3)",
                    color,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    marginLeft: "6px",
                  }}
                >
                  {tagLabel}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "var(--text3)",
                  marginBottom: "6px",
                }}
              >
                <span>
                  {info.done} / {info.total} lectures
                </span>
                <span
                  className="font-bebas"
                  style={{ fontSize: "16px", color }}
                >
                  {pct}%
                </span>
              </div>
              <ProgressBar pct={pct} color={color} />
            </div>
          );
        })}
      </div>

      <div
        className="font-bebas"
        style={{
          fontSize: "18px",
          letterSpacing: "2px",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "var(--gold)",
            display: "inline-block",
          }}
        />
        TEST SCHEDULE (ALL TESTS)
      </div>
      <div>
        {allTests.map(({ date, test, done }) => {
          const diff = Math.ceil(
            (new Date(date).getTime() - Date.now()) / 86400000,
          );
          const timeLabel =
            diff < 0
              ? "PAST"
              : diff === 0
                ? "TODAY"
                : diff === 1
                  ? "TOMORROW"
                  : `IN ${diff}D`;
          return (
            <div
              key={`${date}-${test.subj}-${test.test_num}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  background: done ? "rgba(16,185,129,0.1)" : "var(--test-d)",
                  color: done ? "var(--done)" : "var(--gold)",
                  fontSize: "9px",
                  padding: "2px 7px",
                  borderRadius: "3px",
                  whiteSpace: "nowrap",
                }}
              >
                {done ? "✓ DONE" : timeLabel}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: "12px",
                    color: done ? "var(--text3)" : "var(--text)",
                  }}
                >
                  {test.subj} — {test.test_num}
                </div>
                <div style={{ fontSize: "9px", color: "var(--text3)" }}>
                  {date} · {test.chapter}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== TRACKER PANEL ====================
function TrackerPanel({
  state,
  saveNote,
  saveSettings,
  exportData,
  resetAll,
}: {
  state: ReturnType<typeof useGateState>["state"];
  saveNote: (text: string) => void;
  saveSettings: (gateDate: string, dailyTarget: number) => void;
  exportData: () => void;
  resetAll: () => void;
}) {
  const [noteText, setNoteText] = useState("");
  const [gateDate, setGateDate] = useState(state.gateDate || "2027-02-01");
  const [dailyTarget, setDailyTarget] = useState(state.dailyTarget || 6);

  const total = getTotalLectures();
  const done = getCompletedLectures(state.done);
  const streak = calcStreak(state.done);
  const weekLecs = getWeekLectures(state.done);
  const testsDone = countTestsDone(state.tests);

  const subjProgress: Record<
    string,
    { total: number; done: number; tag: string }
  > = {};
  for (const day of SCHEDULE_RAW) {
    day.lectures.forEach((l, i) => {
      if (!subjProgress[l.subj])
        subjProgress[l.subj] = { total: 0, done: 0, tag: l.tag };
      subjProgress[l.subj].total++;
      if (state.done[day.date]?.[i]) subjProgress[l.subj].done++;
    });
  }

  return (
    <div className="panel-enter">
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}
        className="settings-grid-responsive"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Overall progress */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              className="font-bebas"
              style={{
                fontSize: "16px",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              📊 OVERALL PROGRESS
            </div>
            {Object.entries(subjProgress).map(([name, info]) => {
              const pct =
                info.total > 0 ? Math.round((info.done / info.total) * 100) : 0;
              const color = TAG_COLOR[info.tag] || "var(--text2)";
              return (
                <div key={name} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      marginBottom: "3px",
                    }}
                  >
                    <span style={{ color: "var(--text2)" }}>{name}</span>
                    <span style={{ color }}>
                      {info.done}/{info.total}
                    </span>
                  </div>
                  <ProgressBar pct={pct} color={color} height={4} />
                </div>
              );
            })}
          </div>

          {/* Notes */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              className="font-bebas"
              style={{
                fontSize: "16px",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              📝 DAILY NOTES
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                letterSpacing: "1px",
                marginBottom: "4px",
              }}
            >
              TODAY’S NOTES / DOUBTS
            </div>
            <textarea
              className="gate-input"
              rows={5}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Write your doubts, key formulas, or progress notes here..."
              style={{ resize: "vertical" }}
            />
            <button
              type="button"
              onClick={() => {
                if (noteText.trim()) {
                  saveNote(noteText.trim());
                  setNoteText("");
                }
              }}
              style={{
                background: "var(--accent)",
                border: "none",
                color: "#fff",
                padding: "8px 18px",
                borderRadius: "7px",
                fontFamily: "JetBrains Mono",
                fontSize: "12px",
                cursor: "pointer",
                marginTop: "8px",
              }}
            >
              SAVE NOTE
            </button>
            <div style={{ marginTop: "12px" }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text3)",
                  letterSpacing: "1px",
                  marginBottom: "6px",
                }}
              >
                SAVED NOTES
              </div>
              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                {!state.notes?.length ? (
                  <div style={{ fontSize: "12px", color: "var(--text3)" }}>
                    No notes yet.
                  </div>
                ) : (
                  state.notes.slice(0, 10).map((n) => (
                    <div
                      key={`${n.time}-${n.text.slice(0, 20)}`}
                      style={{
                        background: "var(--bg3)",
                        borderRadius: "6px",
                        padding: "8px 10px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "9px",
                          color: "var(--text3)",
                          marginBottom: "3px",
                        }}
                      >
                        {n.date} · {n.time}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--text2)" }}>
                        {n.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {/* Streak */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              className="font-bebas"
              style={{
                fontSize: "16px",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              🔥 STREAK & PERFORMANCE
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px",
                background: "var(--bg3)",
                borderRadius: "10px",
                marginBottom: "12px",
              }}
            >
              <div
                className="font-bebas"
                style={{
                  fontSize: "52px",
                  color: "var(--gold)",
                  lineHeight: 1,
                }}
              >
                {streak}
              </div>
              <div>
                <div style={{ fontSize: "13px", color: "var(--text2)" }}>
                  DAY STREAK
                </div>
                <div style={{ fontSize: "12px", color: "var(--text3)" }}>
                  Best: {state.bestStreak || 0} days
                </div>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              {[
                ["TOTAL DONE", done, "var(--cdsa)"],
                [
                  "COMPLETION",
                  `${total > 0 ? Math.round((done / total) * 100) : 0}%`,
                  "var(--math)",
                ],
                ["TESTS DONE", testsDone, "var(--gold)"],
                ["WEEK LECS", weekLecs, "var(--apt)"],
              ].map(([l, v, c]) => (
                <div
                  key={l as string}
                  style={{
                    background: "var(--bg3)",
                    borderRadius: "8px",
                    padding: "10px",
                  }}
                >
                  <div style={{ fontSize: "9px", color: "var(--text3)" }}>
                    {l}
                  </div>
                  <div
                    className="font-bebas"
                    style={{ fontSize: "22px", color: c as string }}
                  >
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
            }}
          >
            <div
              className="font-bebas"
              style={{
                fontSize: "16px",
                letterSpacing: "2px",
                marginBottom: "12px",
              }}
            >
              ⚙️ SETTINGS
            </div>
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text3)",
                  letterSpacing: "1px",
                  marginBottom: "4px",
                }}
              >
                GATE DATE (ESTIMATED)
              </div>
              <input
                type="date"
                className="gate-input"
                value={gateDate}
                onChange={(e) => setGateDate(e.target.value)}
              />
            </div>
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--text3)",
                  letterSpacing: "1px",
                  marginBottom: "4px",
                }}
              >
                DAILY TARGET (HRS)
              </div>
              <input
                type="number"
                className="gate-input"
                value={dailyTarget}
                min={1}
                max={16}
                onChange={(e) => setDailyTarget(Number(e.target.value))}
              />
            </div>
            <button
              type="button"
              onClick={() => saveSettings(gateDate, dailyTarget)}
              style={{
                background: "var(--accent)",
                border: "none",
                color: "#fff",
                padding: "8px 18px",
                borderRadius: "7px",
                fontFamily: "JetBrains Mono",
                fontSize: "12px",
                cursor: "pointer",
                marginBottom: "12px",
              }}
            >
              SAVE SETTINGS
            </button>
            <div
              style={{
                paddingTop: "12px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: "8px",
              }}
            >
              <button
                type="button"
                onClick={exportData}
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  color: "var(--text2)",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "JetBrains Mono",
                }}
              >
                EXPORT DATA
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("Reset ALL progress? This cannot be undone."))
                    resetAll();
                }}
                style={{
                  background: "var(--miss)",
                  border: "none",
                  color: "#fff",
                  padding: "7px 14px",
                  borderRadius: "6px",
                  fontSize: "12px",
                  cursor: "pointer",
                  fontFamily: "JetBrains Mono",
                }}
              >
                RESET ALL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
const PANELS = [
  "home",
  "calendar",
  "weekly",
  "monthly",
  "subjects",
  "tracker",
] as const;
type PanelType = (typeof PANELS)[number];
const PANEL_LABELS: Record<PanelType, string> = {
  home: "HOME",
  calendar: "CALENDAR",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  subjects: "SUBJECTS",
  tracker: "MY TRACKER",
};

export default function App() {
  const now = useClock();
  const { identity, login, isInitializing, isLoggingIn } =
    useInternetIdentity();
  const { actor, isFetching: isActorFetching } = useActor();
  const {
    state,
    isLoading,
    markLecture,
    markTest,
    saveNote,
    saveSettings,
    exportData,
    resetAll,
  } = useGateState(actor);
  const [activePanel, setActivePanel] = useState<PanelType>("home");
  const [quoteIdx, setQuoteIdx] = useState(getDailyQuoteIdx());
  const [_mobileNavOpen, setMobileNavOpen] = useState(false);

  const [theme, setTheme] = useState<"dark" | "light">(
    () =>
      (localStorage.getItem("gate2027_theme") as "dark" | "light") || "dark",
  );
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("gate2027_theme", theme);
  }, [theme]);

  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const DAY_NAMES = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ];
  const MONTH_SHORT = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const clockDate = `${DAY_NAMES[now.getDay()]}, ${now.getDate()} ${MONTH_SHORT[now.getMonth()]} ${now.getFullYear()}`;

  const gateDate = new Date(state.gateDate || "2027-02-01");
  const daysToGate = Math.max(
    0,
    Math.ceil((gateDate.getTime() - now.getTime()) / 86400000),
  );

  const today = getTodayStr();
  const todayDay =
    SCHEDULE_RAW.find((d) => d.date === today) || SCHEDULE_RAW[0];
  let todayStatus = "";
  if (todayDay.isRevision) todayStatus = "🏆 REVISION & PYQ MODE";
  else if (todayDay.isExam) todayStatus = "⚠️ EXAM PERIOD - LIGHT STUDY DAY";
  else if (todayDay.isHoliday)
    todayStatus = "🌴 HOLIDAY - MAX PRODUCTIVITY DAY";
  else if (todayDay.isWeekend) todayStatus = "📅 WEEKEND - 8 HOURS TARGET";
  else todayStatus = `📚 COLLEGE DAY - ${todayDay.hours} HOURS TARGET`;

  const q = QUOTES[quoteIdx];

  // Auth gate
  if (isInitializing || isLoading || (identity && isActorFetching)) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            border: "4px solid var(--accent)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <p
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 14,
            letterSpacing: "0.1em",
          }}
        >
          {isInitializing ? "AUTHENTICATING..." : "LOADING PROGRESS..."}
        </p>
      </div>
    );
  }

  if (!identity) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
          flexDirection: "column",
          gap: "2rem",
          padding: "2rem",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(1.8rem, 5vw, 3rem)",
              letterSpacing: "0.06em",
              color: "var(--text)",
              marginBottom: "0.5rem",
              lineHeight: 1.2,
            }}
          >
            KARAN PRABHAT
          </h1>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(0.9rem, 2.5vw, 1.3rem)",
              letterSpacing: "0.12em",
              color: "var(--accent)",
              marginBottom: "2rem",
            }}
          >
            THE GATE ASPIRANT'S TRACKER
          </h2>
          <p
            style={{
              color: "var(--text-muted)",
              fontFamily: "var(--font-body)",
              fontSize: 15,
              marginBottom: "2.5rem",
              lineHeight: 1.7,
            }}
          >
            Sign in to sync your progress across all devices and browsers.
          </p>
          <button
            type="button"
            data-ocid="login.primary_button"
            onClick={login}
            disabled={isLoggingIn}
            style={{
              padding: "0.85rem 2.5rem",
              background: isLoggingIn ? "var(--card)" : "var(--accent)",
              color: isLoggingIn ? "var(--text-muted)" : "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: "0.1em",
              cursor: isLoggingIn ? "not-allowed" : "pointer",
              transition: "opacity 0.2s, transform 0.15s",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              margin: "0 auto",
            }}
          >
            {isLoggingIn ? (
              <>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: "2px solid var(--text-muted)",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                    display: "inline-block",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                SIGNING IN...
              </>
            ) : (
              "LOGIN WITH INTERNET IDENTITY"
            )}
          </button>
        </div>
        <p
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.08em",
            opacity: 0.6,
            textAlign: "center",
          }}
        >
          GATE 2027 · IITB/IISc TARGET
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        boxSizing: "border-box" as const,
      }}
    >
      {/* HEADER */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 200,
          background: "var(--header-bg)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            padding: "8px 0",
          }}
        >
          {/* Row 1: title + theme toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div
                className="font-bebas"
                style={{
                  fontSize: "clamp(16px,2.5vw,22px)",
                  letterSpacing: "2px",
                  lineHeight: 1.1,
                }}
              >
                KARAN <span style={{ color: "var(--accent2)" }}>PRABHAT</span> —
                THE GATE ASPIRANT’S TRACKER
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--gold)",
                  letterSpacing: "3px",
                  marginTop: "2px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span style={{ fontSize: "8px" }}>◆</span> TARGET : IITB / IISc
              </div>
            </div>
            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Toggle light/dark mode"
              data-ocid="theme.toggle"
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
          </div>

          {/* Row 2: scrollable nav */}
          <div
            className="nav-scroll-container"
            style={{
              overflowX: "auto",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <nav
              style={{
                display: "flex",
                gap: "2px",
                background: "var(--bg3)",
                padding: "4px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                width: "max-content",
              }}
            >
              {PANELS.map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`nav-btn ${activePanel === p ? "active" : ""}`}
                  onClick={() => {
                    setActivePanel(p);
                    setMobileNavOpen(false);
                  }}
                >
                  {PANEL_LABELS[p]}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* CLOCK BAR */}
      <div
        className="hero-glass"
        style={{
          padding: "10px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <div
              className="font-bebas clock-glow"
              style={{
                fontSize: "clamp(24px,4vw,38px)",
                color: "var(--accent2)",
                letterSpacing: "4px",
              }}
            >
              {h}:{m}:{s}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--text3)",
                letterSpacing: "2px",
              }}
            >
              {clockDate}
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <span className={`phase-badge ${PHASE_CLASS[todayDay.phase]}`}>
              {PHASE_LABEL[todayDay.phase]}
            </span>
            <div
              style={{
                fontSize: "9px",
                color: "var(--text3)",
                marginTop: "4px",
              }}
            >
              {todayStatus}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "10px",
                color: "var(--text3)",
                letterSpacing: "1px",
                marginBottom: "2px",
              }}
            >
              DAYS TO GATE 2027
            </div>
            <div
              className="font-bebas"
              style={{
                fontSize: "22px",
                color: "var(--gold)",
                letterSpacing: "2px",
              }}
            >
              {daysToGate}
            </div>
            <div style={{ fontSize: "9px", color: "var(--text3)" }}>
              Feb 1, 2027 (estimated)
            </div>
          </div>
        </div>
      </div>

      {/* QUOTE BAR */}
      <div
        style={{
          background:
            "linear-gradient(90deg,rgba(99,102,241,0.08),rgba(52,211,153,0.06))",
          borderBottom: "1px solid var(--border)",
          padding: "12px 24px",
          textAlign: "center",
        }}
      >
        <div
          className="font-crimson"
          style={{
            fontStyle: "italic",
            fontSize: "clamp(12px,1.8vw,15px)",
            color: "var(--text2)",
            maxWidth: "800px",
            margin: "0 auto",
            lineHeight: 1.6,
          }}
        >
          “{q.text}” —{" "}
          <span
            style={{
              color: "var(--accent2)",
              fontStyle: "normal",
              fontWeight: 600,
            }}
          >
            {q.author}
          </span>
        </div>
      </div>

      {/* MAIN PANELS */}
      <main
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "20px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {activePanel === "home" && (
          <HomePanel
            key="home"
            state={state}
            markLecture={markLecture}
            markTest={markTest}
            quoteIdx={quoteIdx}
            onPrevQuote={() =>
              setQuoteIdx((i) => (i - 1 + QUOTES.length) % QUOTES.length)
            }
            onNextQuote={() => setQuoteIdx((i) => (i + 1) % QUOTES.length)}
          />
        )}
        {activePanel === "calendar" && (
          <CalendarPanel
            key="calendar"
            state={state}
            markLecture={markLecture}
            markTest={markTest}
          />
        )}
        {activePanel === "weekly" && (
          <WeeklyPanel
            key="weekly"
            state={state}
            markLecture={markLecture}
            markTest={markTest}
          />
        )}
        {activePanel === "monthly" && (
          <MonthlyPanel key="monthly" state={state} />
        )}
        {activePanel === "subjects" && (
          <SubjectsPanel key="subjects" state={state} />
        )}
        {activePanel === "tracker" && (
          <TrackerPanel
            key="tracker"
            state={state}
            saveNote={saveNote}
            saveSettings={saveSettings}
            exportData={exportData}
            resetAll={resetAll}
          />
        )}
      </main>
    </div>
  );
}
