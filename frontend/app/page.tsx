"use client";

import { useEffect, useState } from "react";

import {
  getSubjects,
  createSubject,
  askQuestion,
  getConversations,
  getConversationMessages,
  type Subject,
  type AskQuestionResponse,
  type Conversation,
  type SavedMessage,
} from "@/lib/api";

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
  // Subject state
  const [realSubjects, setRealSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState("");

  // Add subject state
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [creatingSubject, setCreatingSubject] = useState(false);
  const [createSubjectError, setCreateSubjectError] = useState("");

  // AI assistant state
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [question, setQuestion] = useState("");
  const [aiResponse, setAiResponse] =
    useState<AskQuestionResponse | null>(null);
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [askError, setAskError] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTurns, setConversationTurns] = useState<AskQuestionResponse[]>([]);

  // Saved conversation history
  const [savedConversations, setSavedConversations] = useState<Conversation[]>([]);
  const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
  const [showConversationList, setShowConversationList] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [conversationListError, setConversationListError] = useState("");
  const [openingConversationId, setOpeningConversationId] = useState<number | null>(null);
  const [activeConversationTitle, setActiveConversationTitle] = useState("");

  // Add a new subject
  async function handleAddSubject(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = newSubjectName.trim();

    if (!name) {
      setCreateSubjectError("Please enter a subject name.");
      return;
    }

    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
      setCreateSubjectError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setCreatingSubject(true);
    setCreateSubjectError("");

    try {
      const createdSubject = await createSubject(
        name,
        accessToken
      );

      setRealSubjects((current) => [
        ...current,
        createdSubject,
      ]);

      setNewSubjectName("");
      setShowAddSubject(false);
    } catch (error) {
      setCreateSubjectError(
        error instanceof Error
          ? error.message
          : "Failed to create subject."
      );
    } finally {
      setCreatingSubject(false);
    }
  }

  // Ask a question about uploaded study material
  async function handleAskQuestion(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    const subjectId = Number(selectedSubjectId);
    const accessToken = localStorage.getItem("access_token");

    if (!trimmedQuestion) {
      setAskError("Please enter a question.");
      return;
    }

    if (
      !Number.isInteger(subjectId) ||
      subjectId <= 0
    ) {
      setAskError("Please select a subject.");
      return;
    }

    if (!accessToken) {
      setAskError(
        "Your session has expired. Please log in again."
      );
      return;
    }

    setAskingQuestion(true);
    setAskError("");

    try {
      const activeConversationId =
        Number(selectedSubjectId) === subjectId ? conversationId : null;
      const result = await askQuestion(
        subjectId,
        trimmedQuestion,
        accessToken,
        activeConversationId
      );

      setConversationId(result.conversation_id);
      setActiveConversationTitle((current) => current || trimmedQuestion.slice(0, 80));
      setAiResponse(result);
      setConversationTurns((current) => [...current, result]);
      setQuestion("");

      // Refresh the saved conversation list after each successful question.
      try {
        const updated = await getConversations(subjectId, accessToken);
        setSavedConversations(updated);
      } catch {
        // The answer was successful; the list can be refreshed next time.
      }
    } catch (error) {
      setAskError(
        error instanceof Error
          ? error.message
          : "Unable to get an answer. Please try again."
      );
    } finally {
      setAskingQuestion(false);
    }
  }

  // Load saved conversations whenever the selected subject changes.
  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      const subjectId = Number(selectedSubjectId);
      const accessToken = localStorage.getItem("access_token");

      setSavedConversations([]);
      setConversationListError("");

      if (!selectedSubjectId || !Number.isInteger(subjectId) || subjectId <= 0 || !accessToken) {
        return;
      }

      setConversationsLoading(true);
      try {
        const conversations = await getConversations(subjectId, accessToken);
        if (!cancelled) setSavedConversations(conversations);
      } catch (error) {
        if (!cancelled) {
          setConversationListError(
            error instanceof Error ? error.message : "Unable to load saved conversations."
          );
        }
      } finally {
        if (!cancelled) setConversationsLoading(false);
      }
    }

    loadConversations();
    return () => { cancelled = true; };
  }, [selectedSubjectId]);

  function startNewConversation() {
    setConversationId(null);
    setConversationTurns([]);
    setSavedMessages([]);
    setAiResponse(null);
    setActiveConversationTitle("");
    setQuestion("");
    setAskError("");
    setShowConversationList(false);
  }

  async function handleOpenSavedConversation(conversation: Conversation) {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      setConversationListError("Your session has expired. Please log in again.");
      return;
    }

    setOpeningConversationId(conversation.id);
    setConversationListError("");
    setAskError("");
    try {
      const result = await getConversationMessages(conversation.id, accessToken);
      setConversationId(conversation.id);
      setSelectedSubjectId(String(conversation.subject_id));
      setActiveConversationTitle(result.title || conversation.title);
      setSavedMessages(result.messages || []);
      setConversationTurns([]);
      setAiResponse(null);
      setQuestion("");
      setShowConversationList(false);
    } catch (error) {
      setConversationListError(
        error instanceof Error ? error.message : "Unable to open this conversation."
      );
    } finally {
      setOpeningConversationId(null);
    }
  }

  // Load subjects from the backend
  useEffect(() => {
    async function loadSubjects() {
      const accessToken =
        localStorage.getItem("access_token");

      const storedUserId =
        localStorage.getItem("user_id");

      if (!accessToken || !storedUserId) {
        setSubjectsError(
          "Your session was not found. Please log in again."
        );

        setSubjectsLoading(false);
        return;
      }

      const userId = Number(storedUserId);

      if (
        !Number.isInteger(userId) ||
        userId <= 0
      ) {
        setSubjectsError(
          "The saved user ID is invalid. Please log in again."
        );

        setSubjectsLoading(false);
        return;
      }

      try {
        const data = await getSubjects(
          userId,
          accessToken
        );

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
      <style jsx global>{`
        :root { --study-ink: #172b4d; --study-muted: #64748b; --study-paper: #f5f7fb; --study-teal: #0f766e; --study-teal-dark: #115e59; --study-border: #e2e8f0; }
        html { scroll-behavior: smooth; scroll-padding-top: 86px; }
        body { margin: 0; background: var(--study-paper); color: var(--study-ink); }
        .dashboard-shell { min-height: 100vh; background: #f5f7fb; color: var(--study-ink); }
        /* Two-stage header: the brand scrolls away; only navigation sticks. */
        .sidebar { display: contents; }
        .brand { width: 100%; min-height: 76px; box-sizing: border-box; padding: 14px 20px; display: flex; align-items: center; justify-content: center; gap: 12px; margin: 0 !important; background: #102a43; color: #eaf2f8; }
        .brand-logo, .orbit-center { background: #14b8a6 !important; color: #062b32 !important; }
        .brand h2 { margin: 0; font-size: 21px; letter-spacing: -.03em; }
        .brand p { margin: 3px 0 0; font-size: 9px; letter-spacing: .13em; }
        .brand h2, .brand p, .profile-info strong { color: #f8fafc !important; }
        .brand p, .workspace-label { display: none !important; }
        .profile-info span { color: #a8bdce !important; }
        .navigation { position: sticky; top: 0; z-index: 100; width: 100%; min-height: 64px; box-sizing: border-box; padding: 10px clamp(12px, 3vw, 36px); display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; overflow-x: auto; scrollbar-width: none; background: rgba(16,42,67,.98); color: #eaf2f8; border-bottom: 1px solid rgba(255,255,255,.1); box-shadow: 0 8px 24px rgba(15,42,67,.08); }
        .navigation::-webkit-scrollbar { display: none; }
        .navigation .nav-link { display: inline-flex; align-items: center; gap: 8px; padding: 11px 13px; white-space: nowrap; text-decoration: none; font-size: 13px; }
        .sidebar-bottom { display: none !important; }
        .navigation .nav-link { color: #c6d5e1; border-radius: 10px; transition: background .18s ease, color .18s ease; }
        .navigation .nav-link:hover, .navigation .nav-link.active { background: rgba(20,184,166,.16); color: #99f6e4; }
        .main-content { margin-left: 0; min-width: 0; }
        .topbar { position: relative !important; top: auto; z-index: 1; min-height: 56px; box-sizing: border-box; background: rgba(255,255,255,.92) !important; border-bottom: 1px solid var(--study-border); backdrop-filter: blur(14px); }
        .page-content { max-width: 1440px; margin: 0 auto; padding: clamp(18px, 3vw, 36px) !important; }
        .welcome-section { border-radius: 22px; background: linear-gradient(125deg,#e8f7f5 0%,#f5f8ff 62%,#edf2ff 100%); border: 1px solid #d8eeeb; padding: clamp(22px,3vw,38px); overflow: hidden; }
        .welcome-section h1 { color: #17324d; letter-spacing: -.04em; }
        .welcome-section h1 span { color: #0f766e !important; }
        .stat-card, .subject-card, .panel, .documents-section, .quick-actions { border: 1px solid var(--study-border); border-radius: 18px; box-shadow: 0 4px 18px rgba(15,42,67,.035); }
        .stat-card, .subject-card, .panel, .documents-section { background: #fff; }
        .stat-card:hover, .subject-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,42,67,.08); }
        .stat-card, .subject-card { transition: transform .18s ease, box-shadow .18s ease; }
        .primary-button { background: var(--study-teal) !important; color: white !important; border: 1px solid var(--study-teal) !important; border-radius: 11px !important; font-weight: 650; cursor: pointer; transition: background .18s ease, transform .18s ease; }
        .primary-button:hover:not(:disabled) { background: var(--study-teal-dark) !important; transform: translateY(-1px); }
        .primary-button:disabled { opacity: .65; cursor: wait; }
        .secondary-button, .action-button { border-radius: 11px !important; }
        input:focus, select:focus, textarea:focus { outline: 3px solid rgba(20,184,166,.18); border-color: #0f9f91 !important; }
        .assistant-panel { position: relative; overflow: hidden; }
        .assistant-panel > *:not(.assistant-glow) { position: relative; z-index: 1; }
        .assistant-symbol { background: #ccfbf1 !important; color: #0f766e !important; }
        .conversation-turn { padding: 16px; margin-top: 14px; border: 1px solid #dce8ef; border-radius: 14px; background: #fff; }
        .conversation-question { color: #334155; font-weight: 650; margin: 0 0 12px; }
        .conversation-answer { line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; color: #243b53; }
        .source-chip { display: inline-flex; margin: 8px 8px 0 0; padding: 6px 9px; border-radius: 8px; background: #f0fdfa; color: #115e59; border: 1px solid #ccfbf1; font-size: 12px; }
        .dashboard-footer { gap: 12px; flex-wrap: wrap; }
        @media (max-width: 1000px) {
          .brand { min-height: 70px; }
          .navigation { justify-content: flex-start; }
          .navigation .nav-link { padding: 10px; font-size: 12px; }
          .welcome-decoration { opacity: .55; transform: scale(.8); transform-origin: center right; }
        }
        @media (max-width: 720px) {
          .brand { min-height: 62px; padding: 10px 14px; }
          .brand-logo { width: 34px; height: 34px; }
          .brand h2 { font-size: 18px; }
          .brand p { font-size: 8px; }
          .navigation { top: 0; justify-content: flex-start; gap: 5px; padding: 7px 10px; min-height: 54px; }
          .navigation .nav-link { flex: 0 0 auto; padding: 8px 10px; white-space: nowrap; font-size: 12px; }
          .navigation .nav-link span { display: inline !important; }
          .main-content { margin-left: 0; }
          .topbar { min-height: 48px; padding: 10px 16px; }
          .today-label { display: none; }
          .page-content { padding: 16px !important; }
          .welcome-section { padding: 22px 18px; }
          .welcome-section h1 { font-size: clamp(28px, 8vw, 38px); }
          .welcome-decoration { display: none; }
          .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px; }
          .stat-card { padding: 14px !important; min-width: 0; }
          .stat-value { font-size: 26px !important; }
          .section-heading { align-items: flex-start; flex-direction: column; gap: 14px; }
          .subjects-grid, .bottom-grid { grid-template-columns: minmax(0, 1fr) !important; }
          .subject-card, .panel { min-width: 0; }
          .action-buttons { display: grid !important; grid-template-columns: minmax(0, 1fr); width: 100%; }
          .action-button { justify-content: center; }
          .topbar-avatar { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
        }
      `}</style>
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">S</div>

          <div>
            <h2>StudyOS</h2>
            <p>YOUR LEARNING SPACE</p>
          </div>
        </div>

        <div className="workspace-label">
          WORKSPACE
        </div>

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

            <p>
              Small, consistent sessions build lasting
              knowledge.
            </p>

            <a href="#planner">
              Plan your day →
            </a>
          </div>

          <div className="profile">
            <div className="avatar">JS</div>

            <div className="profile-info">
              <strong>Student</strong>
              <span>Personal workspace</span>
            </div>

            <span className="profile-menu">
              •••
            </span>
          </div>
        </div>
      </aside>

      {/* Main dashboard */}
      <section className="main-content">
        {/* Top navigation */}
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>Dashboard</strong>
          </div>

          <div className="topbar-right">
            <span className="today-label">
              Your learning overview
            </span>

            <div className="topbar-avatar">
              JS
            </div>
          </div>
        </header>

        <div className="page-content">
          {/* Welcome section */}
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
                Welcome to StudyOS. Your learning journey,
                organized in one place. Let&apos;s make
                today count.
              </p>
            </div>

            <div
              className="welcome-decoration"
              aria-hidden="true"
            >
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />

              <div className="orbit-center">S</div>

              <span className="orbit-star star-one">
                ✦
              </span>

              <span className="orbit-star star-two">
                ✧
              </span>
            </div>
          </section>

          {/* Dashboard statistics */}
          <section
            className="stats-grid"
            id="progress"
          >
            <article className="stat-card">
              <div className="stat-top">
                <span>Active subjects</span>
                <span className="stat-icon violet-bg">
                  ◈
                </span>
              </div>

              <div className="stat-value">
                {subjectsLoading
                  ? "…"
                  : realSubjects.length
                      .toString()
                      .padStart(2, "0")}
              </div>

              <p>Your learning spaces</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Documents</span>
                <span className="stat-icon blue-bg">
                  ▤
                </span>
              </div>

              <div className="stat-value">02</div>

              <p>Study materials uploaded</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Study sessions</span>
                <span className="stat-icon green-bg">
                  ◷
                </span>
              </div>

              <div className="stat-value">12</div>

              <p>Sessions completed</p>
            </article>

            <article className="stat-card">
              <div className="stat-top">
                <span>Learning consistency</span>
                <span className="stat-icon amber-bg">
                  ✦
                </span>
              </div>

              <div className="stat-value">85%</div>

              <p>Weekly goal completion</p>
            </article>
          </section>

          {/* Subjects section */}
          <section
            className="section-block"
            id="subjects"
          >
            <div className="section-heading">
              <div>
                <span className="section-kicker">
                  YOUR WORKSPACE
                </span>

                <h2>
                  Pick up where you left off
                </h2>

                <p>
                  Keep moving forward, one concept at a
                  time.
                </p>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setShowAddSubject(
                      (current) => !current
                    );

                    setCreateSubjectError("");
                  }}
                >
                  + Add Subject
                </button>

                <a
                  className="secondary-button"
                  href="#subjects"
                  style={{
                    textDecoration: "none",
                  }}
                >
                  View all subjects <span>→</span>
                </a>
              </div>
            </div>

            {/* Add subject form */}
            {showAddSubject && (
              <form
                onSubmit={handleAddSubject}
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <input
                  type="text"
                  value={newSubjectName}
                  onChange={(event) =>
                    setNewSubjectName(
                      event.target.value
                    )
                  }
                  placeholder="Enter subject name"
                  maxLength={100}
                  required
                  disabled={creatingSubject}
                  aria-label="New subject name"
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    minWidth: "240px",
                  }}
                />

                <button
                  className="primary-button"
                  type="submit"
                  disabled={creatingSubject}
                >
                  {creatingSubject
                    ? "Adding..."
                    : "Save Subject"}
                </button>

                <button
                  className="secondary-button"
                  type="button"
                  disabled={creatingSubject}
                  onClick={() => {
                    setShowAddSubject(false);
                    setNewSubjectName("");
                    setCreateSubjectError("");
                  }}
                >
                  Cancel
                </button>

                {createSubjectError && (
                  <p
                    role="alert"
                    style={{
                      width: "100%",
                      color: "#dc2626",
                    }}
                  >
                    {createSubjectError}
                  </p>
                )}
              </form>
            )}

            {/* Subject cards */}
            <div className="subjects-grid">
              {subjectsLoading && (
                <p role="status">
                  Loading your subjects...
                </p>
              )}

              {!subjectsLoading &&
                subjectsError && (
                  <p role="alert">
                    {subjectsError}
                  </p>
                )}

              {!subjectsLoading &&
                !subjectsError &&
                realSubjects.length === 0 && (
                  <p>
                    No subjects found for this account
                    yet.
                  </p>
                )}

              {!subjectsLoading &&
                !subjectsError &&
                realSubjects.map(
                  (subject, index) => {
                    const colors = [
                      "violet",
                      "blue",
                      "emerald",
                    ];

                    const icons = [
                      "◈",
                      "✳",
                      "▦",
                    ];

                    const color =
                      colors[index % colors.length];

                    const icon =
                      icons[index % icons.length];

                    return (
                      <article
                        className={`subject-card subject-${color}`}
                        key={subject.id}
                      >
                        <div className="subject-top">
                          <div className="subject-icon">
                            {icon}
                          </div>

                          <span className="subject-code">
                            ID {subject.id}
                          </span>
                        </div>

                        <h3>{subject.name}</h3>

                        <p className="subject-caption">
                          Your study space
                        </p>

                        <div className="progress-label">
                          <span>
                            Course completion
                          </span>

                          <strong>—</strong>
                        </div>

                        <div
                          className="progress-track"
                          role="progressbar"
                          aria-label={`${subject.name} progress`}
                          aria-valuetext="Progress not available yet"
                        >
                          <div
                            className="progress-fill"
                            style={{ width: "0%" }}
                          />
                        </div>

                        <a
                          className="subject-link"
                          href="#assistant"
                          onClick={() => {
                            setSelectedSubjectId(String(subject.id));
                            startNewConversation();
                          }}
                        >
                          Ask about this subject{" "}
                          <span>↗</span>
                        </a>
                      </article>
                    );
                  }
                )}
            </div>
          </section>

          {/* Recent activity and AI assistant */}
          <section className="bottom-grid">
            <article className="panel activity-panel">
              <div className="panel-heading">
                <div>
                  <span className="section-kicker">
                    YOUR JOURNEY
                  </span>

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
                  <div
                    className="activity-item"
                    key={activity.title}
                  >
                    <div className="activity-icon">
                      {activity.icon}
                    </div>

                    <div className="activity-details">
                      <strong>
                        {activity.title}
                      </strong>

                      <p>
                        {activity.description}
                      </p>

                      <span>{activity.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            {/* Functional AI assistant */}
            <article
              className="panel assistant-panel"
              id="assistant"
            >
              <div className="assistant-symbol">
                ✳
              </div>

              <span className="section-kicker">
                STUDYOS INTELLIGENCE
              </span>

              <h2>Your AI study companion</h2>

              <p>
                Ask questions about your uploaded study
                materials and receive answers grounded
                in your documents.
              </p>

              <form
                onSubmit={handleAskQuestion}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                <label htmlFor="ai-subject">
                  <strong>Select subject</strong>
                </label>

                <select
                  id="ai-subject"
                  value={selectedSubjectId}
                  onChange={(event) => {
                    setSelectedSubjectId(
                      event.target.value
                    );

                    setAiResponse(null);
                    setConversationId(null);
                    setConversationTurns([]);
                    setSavedMessages([]);
                    setActiveConversationTitle("");
                    setQuestion("");
                    setAskError("");
                  }}
                  required
                  disabled={
                    askingQuestion ||
                    subjectsLoading ||
                    realSubjects.length === 0
                  }
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    color: "#1f2937",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="">
                    Choose a subject
                  </option>

                  {realSubjects.map((subject) => (
                    <option
                      key={subject.id}
                      value={subject.id}
                    >
                      {subject.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="ai-question">
                  <strong>Your question</strong>
                </label>

                <textarea
                  id="ai-question"
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  placeholder="Example: What does CPU scheduling determine?"
                  rows={4}
                  maxLength={2000}
                  required
                  disabled={askingQuestion}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #d1d5db",
                    resize: "vertical",
                    font: "inherit",
                    boxSizing: "border-box",
                    background: "#ffffff",
                    color: "#1f2937",
                  }}
                />

                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    askingQuestion ||
                    subjectsLoading ||
                    realSubjects.length === 0
                  }
                >
                  {askingQuestion
                    ? "Finding your answer..."
                    : "Ask StudyOS AI →"}
                </button>
              </form>

              {askError && (
                <div
                  role="alert"
                  style={{
                    marginTop: "16px",
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#fef2f2",
                    color: "#b91c1c",
                    overflowWrap: "anywhere",
                  }}
                >
                  {askError}
                </div>
              )}

              {/* Saved conversations */}
              <div className="conversation-history" style={{ marginTop: 24 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <span className="section-kicker">YOUR STUDY CHAT</span>
                    <h3 style={{ margin: "6px 0 0" }}>
                      {activeConversationTitle || "Conversation"}
                    </h3>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowConversationList((current) => !current)}
                      disabled={!selectedSubjectId || conversationsLoading}
                    >
                      {conversationsLoading ? "Loading history..." : showConversationList ? "Hide history" : "Previous conversations"}
                    </button>
                    <button type="button" className="secondary-button" onClick={startNewConversation}>
                      + New conversation
                    </button>
                  </div>
                </div>

                {showConversationList && (
                  <div style={{ marginTop: 14, padding: 14, border: "1px solid #dce8ef", borderRadius: 14, background: "#f8fafc" }}>
                    {!selectedSubjectId && <p style={{ margin: 0, color: "#64748b" }}>Select a subject to view its saved conversations.</p>}
                    {conversationListError && <p role="alert" style={{ color: "#b91c1c", overflowWrap: "anywhere" }}>{conversationListError}</p>}
                    {selectedSubjectId && !conversationsLoading && !conversationListError && savedConversations.length === 0 && (
                      <p style={{ margin: 0, color: "#64748b" }}>No saved conversations for this subject yet.</p>
                    )}
                    <div style={{ display: "grid", gap: 8 }}>
                      {savedConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className="secondary-button"
                          onClick={() => handleOpenSavedConversation(conversation)}
                          disabled={openingConversationId !== null}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, width: "100%", textAlign: "left", padding: "12px 14px", background: "#fff" }}
                        >
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conversation.title || "Untitled conversation"}</strong>
                            <small style={{ display: "block", color: "#64748b", marginTop: 4 }}>{new Date(conversation.updated_at || conversation.created_at).toLocaleString()}</small>
                          </span>
                          <span style={{ flexShrink: 0 }}>{openingConversationId === conversation.id ? "Opening..." : "Open →"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages restored from the backend */}
                {savedMessages.map((message) => (
                  <div className="conversation-turn" key={`saved-${message.id}`}>
                    <p className="conversation-question" style={{ marginBottom: 8 }}>
                      {message.role === "user" ? "You" : "StudyOS AI"}
                    </p>
                    <div className="conversation-answer">{message.content}</div>
                    <small style={{ display: "block", marginTop: 8, color: "#64748b" }}>
                      {new Date(message.created_at).toLocaleString()}
                    </small>
                  </div>
                ))}

                {/* New answers include document source matches */}
                {conversationTurns.map((turn, index) => (
                  <div className="conversation-turn" key={`${turn.conversation_id}-${turn.message_id}-${index}`}>
                    <p className="conversation-question">You asked: {turn.question}</p>
                    <div className="conversation-answer">{turn.answer}</div>
                    <div style={{ marginTop: 14 }}>
                      <strong style={{ fontSize: 13 }}>Sources from your material</strong>
                      {turn.sources.length > 0 ? (
                        <div>
                          {turn.sources.map((source) => (
                            <span className="source-chip" key={`${turn.message_id}-${source.document_id}-${source.chunk_id}`}>
                              Document {source.document_id} · Page {source.page ?? "unknown"} · Match {(source.similarity * 100).toFixed(0)}%
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: "#64748b" }}>No source information was returned.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="assistant-glow"
                aria-hidden="true"
              />
            </article>
          </section>

          {/* Quick actions */}
          <section
            className="quick-actions"
            id="planner"
          >
            <div>
              <span className="section-kicker">
                MAKE YOUR NEXT MOVE
              </span>

              <h2>
                What would you like to work on?
              </h2>
            </div>

            <div className="action-buttons">
              <a
                href="#documents"
                className="action-button"
              >
                <span>＋</span> Upload material
              </a>

              <a
                href="#assistant"
                className="action-button"
              >
                <span>✳</span> Ask AI
              </a>

              <a
                href="#planner"
                className="action-button"
              >
                <span>◷</span> Plan a session
              </a>
            </div>
          </section>

          {/* Documents section */}
          <section
            className="documents-section"
            id="documents"
          >
            <div>
              <span className="section-kicker">
                YOUR LIBRARY
              </span>

              <h2>Study materials</h2>

              <p>
                Your document library is where your
                uploaded study materials belong.
              </p>
            </div>

            <div className="empty-document">
              <span>▤</span>

              <div>
                <strong>Your document library</strong>

                <p>
                  PDF upload and document listing can
                  be connected here next.
                </p>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="dashboard-footer">
            <span>StudyOS © 2026</span>

            <span>
              Understand. Practice. Improve.
            </span>
          </footer>
        </div>
      </section>
    </main>
  );
}