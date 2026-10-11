"use client";
import { useEffect, useState } from "react";
import { getSubjects, type Subject } from "@/lib/api";
const subjects = [
  {
    name: "Operating Systems",
    code: "CS301",
    progress: 68,
    color: "violet",
    icon: "◈",
  },
  {
    name: "Artificial Intelligence",
    code: "CS302",
    progress: 42,
    color: "blue",
    icon: "✳",
  },
  {
    name: "Computer Architecture",
    code: "CS303",
    progress: 85,
    color: "emerald",
    icon: "▦",
  },
];

const activities = [
  {
    title: "Operating Systems",
    description: "Reviewed process management",
    time: "Today · 10:30 AM",
    icon: "📘",
  },
  {
    title: "AI Study Assistant",
    description: "Practiced 5 conceptual questions",
    time: "Today · 9:15 AM",
    icon: "✦",
  },
  {
    title: "Study Planner",
    description: "Completed a scheduled study session",
    time: "Yesterday · 6:00 PM",
    icon: "✓",
  },
];

export default function Home() {
  const [realSubjects, setRealSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");

  useEffect(() => {
    async function loadSubjects() {
      const accessToken = localStorage.getItem("access_token");
      const storedUserId = localStorage.getItem("user_id");

      if (!accessToken || !storedUserId) {
        setSubjectsError("Your session was not found. Please log in again.");
        setSubjectsLoading(false);
        return;
      }

      const userId = Number(storedUserId);
      if (!Number.isInteger(userId) || userId <= 0) {
        setSubjectsError("The saved user ID is invalid. Please log in again.");
        setSubjectsLoading(false);
        return;
      }

      try {
        const data = await getSubjects(userId, accessToken);
        setRealSubjects(data);
      } catch (error) {
        setSubjectsError(
          error instanceof Error
            ? error.message
            : "Unable to load your subjects."
        );
      } finally {
        setSubjectsLoading(false);
      }
    }

    loadSubjects();
  }, []);

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">S</div>
          <div>
            <h2>StudyOS</h2>
            <p>YOUR LEARNING SPACE</p>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          <a className="nav-link active" href="#">
            <span>▦</span> Dashboard
          </a>
          <a className="nav-link" href="#subjects">
            <span>◈</span> My Subjects
          </a>
          <a className="nav-link" href="#documents">
            <span>▤</span> Documents
          </a>
          <a className="nav-link" href="#assistant">
            <span>✳</span> AI Study Assistant
          </a>
          <a className="nav-link" href="#planner">
            <span>◷</span> Study Planner
          </a>
          <a className="nav-link" href="#progress">
            <span>↗</span> Progress
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon">✦</div>
            <h3>Your next breakthrough</h3>
            <p>Small, consistent sessions build lasting knowledge.</p>
            <a href="#planner">Plan your day →</a>
          </div>

          <div className="profile">
            <div className="avatar">JS</div>
            <div className="profile-info">
              <strong>Student</strong>
              <span>Personal workspace</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>Dashboard</strong>
          </div>

          <div className="topbar-right">
            <span className="today-label">Your learning overview</span>
            <div className="topbar-avatar">JS</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-section">
            <div>
              <div className="eyebrow">
                <span className="status-dot" />
                YOUR PERSONAL LEARNING SPACE
              </div>

              <h1>
                Learn with purpose.
                <br />
                <span>Grow with confidence.</span>
              </h1>

              <p className="welcome-description">
                Welcome to StudyOS. Your learning journey, organized in one
                place. Let&apos;s make today count.
              </p>
            </div>

            <div className="welcome-decoration" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <div className="orbit-center">S</div>
              <span className="orbit-star star-one">✦</span>
              <span className="orbit-star star-two">✧</span>
            </div>
          </section>

          <section className="stats-grid" id="progress">
            <article className="stat-card">
              <div className="stat-top">
                <span>Active subjects</span>
                <span className="stat-icon violet-bg">◈</span>
              </div>
              <div className="stat-value">{subjectsLoading ? "…" : realSubjects.length.toString().padStart(2, "0")}</div>
              <p>Your learning spaces</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Documents</span>
                <span className="stat-icon blue-bg">▤</span>
              </div>
              <div className="stat-value">02</div>
              <p>Study materials uploaded</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Study sessions</span>
                <span className="stat-icon green-bg">◷</span>
              </div>
              <div className="stat-value">12</div>
              <p>Sessions completed</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Learning consistency</span>
                <span className="stat-icon amber-bg">✦</span>
              </div>
              <div className="stat-value">85%</div>
              <p>Weekly goal completion</p>
            </article>
          </section>

          <section className="section-block" id="subjects">
            <div className="section-heading">
              <div>
                <span className="section-kicker">YOUR WORKSPACE</span>
                <h2>Pick up where you left off</h2>
                <p>Keep moving forward, one concept at a time.</p>
              </div>

              <button className="secondary-button" type="button">
                View all subjects <span>→</span>
              </button>
            </div>

            <div className="subjects-grid">
              {subjectsLoading && (
                <p role="status">Loading your subjects...</p>
              )}

              {!subjectsLoading && subjectsError && (
                <p role="alert">{subjectsError}</p>
              )}

              {!subjectsLoading && !subjectsError && realSubjects.length === 0 && (
                <p>No subjects found for this account yet.</p>
              )}

              {!subjectsLoading &&
                !subjectsError &&
                realSubjects.map((subject, index) => {
                  const colors = ["violet", "blue", "emerald"];
                  const icons = ["◈", "✳", "▦"];
                  const color = colors[index % colors.length];
                  const icon = icons[index % icons.length];

                  return (
                    <article
                      className={`subject-card subject-${color}`}
                      key={subject.id}
                    >
                      <div className="subject-top">
                        <div className="subject-icon">{icon}</div>
                        <span className="subject-code">ID {subject.id}</span>
                      </div>

                      <h3>{subject.name}</h3>
                      <p className="subject-caption">Your study space</p>

                      <div className="progress-label">
                        <span>Course completion</span>
                        <strong>—</strong>
                      </div>

                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${subject.name} progress`}
                        aria-valuetext="Progress not available yet"
                      >
                        <div className="progress-fill" style={{ width: "0%" }} />
                      </div>

                      <a className="subject-link" href="#documents">
                        Continue learning <span>↗</span>
                      </a>
                    </article>
                  );
                })}
            </div>
          </section>

          <section className="bottom-grid">
            <article className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">YOUR JOURNEY</span>
                  <h2>Recent activity</h2>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="More activity options"
                >
                  •••
                </button>
              </div>

              <div className="activity-list">
                {activities.map((activity) => (
                  <div className="activity-item" key={activity.title}>
                    <div className="activity-icon">{activity.icon}</div>
                    <div className="activity-details">
                      <strong>{activity.title}</strong>
                      <p>{activity.description}</p>
                      <span>{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel assistant-panel" id="assistant">
              <div className="assistant-symbol">✳</div>
              <span className="section-kicker">STUDYOS INTELLIGENCE</span>
              <h2>Your AI study companion</h2>
              <p>
                Turn your study materials into clearer explanations,
                meaningful practice, and better revision sessions.
              </p>

              <div className="assistant-features">
                <span>✦ Concept explanations</span>
                <span>↗ Practice questions</span>
                <span>◈ Personalized revision</span>
              </div>

              <button className="primary-button" type="button">
                Explore AI learning <span>→</span>
              </button>

              <div className="assistant-glow" aria-hidden="true" />
            </article>
          </section>

          <section className="quick-actions" id="planner">
            <div>
              <span className="section-kicker">MAKE YOUR NEXT MOVE</span>
              <h2>What would you like to work on?</h2>
            </div>

            <div className="action-buttons">
              <a href="#documents" className="action-button">
                <span>＋</span> Upload material
              </a>
              <a href="#assistant" className="action-button">
                <span>✳</span> Ask AI
              </a>
              <a href="#planner" className="action-button">
                <span>◷</span> Plan a session
              </a>
            </div>
          </section>

          <section className="documents-section" id="documents">
            <div>
              <span className="section-kicker">YOUR LIBRARY</span>
              <h2>Study materials</h2>
              <p>
                Your uploaded documents will appear here when we connect this
                dashboard to the backend.
              </p>
            </div>

            <div className="empty-document">
              <span>▤</span>
              <div>
                <strong>Your document library</strong>
                <p>
                  Next, we&apos;ll connect your real uploaded PDFs to this
                  section.
                </p>
              </div>
            </div>
          </section>

          <footer className="dashboard-footer">
            <span>StudyOS © 2026</span>
            <span>Understand. Practice. Improve.</span>
          </footer>
        </div>
      </section>
    </main>
  );
}