"use client";

import { FormEvent, useEffect, useState } from "react";
import { createTask, getTasks, updateTaskStatus } from "@/api/tasks";
import type { Task, TaskStatus } from "@/types";

const columns: { status: TaskStatus; title: string }[] = [
  { status: "TODO", title: "To Do" },
  { status: "IN_PROGRESS", title: "In Progress" },
  { status: "DONE", title: "Done" },
];

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movingTaskIds, setMovingTaskIds] = useState<Set<string>>(new Set());
  const [moveError, setMoveError] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      try {
        const data = await getTasks();

        if (!cancelled) {
          setTasks(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load tasks. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <main className="board-page">
        <p className="loading-message">Loading tasks...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="board-page">
        <p className="error-message" role="alert">
          {error}
        </p>
      </main>
    );
  }

  async function handleCreateTask(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();

    const title = newTaskTitle.trim();

    if (!title) {
      setCreateError("Title is required");
      return;
    }

    if (title.length > 80) {
      setCreateError("Title must be 80 characters or fewer");
      return;
    }

    setCreateError("");
    setIsCreating(true);

    try {
      const newTask = await createTask({
        title,
        status: "TODO",
      });

      setTasks((current) => [...current, newTask]);

      setNewTaskTitle("");
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Failed to create task. Please try again.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function handleMoveTask(taskId: string, newStatus: TaskStatus) {
    const previousTask = tasks.find((task) => task.id === taskId);

    if (!previousTask) return;

    setMoveError("");

    setMovingTaskIds((current) => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task,
      ),
    );

    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus);

      setTasks((current) =>
        current.map((task) => (task.id === taskId ? updatedTask : task)),
      );
    } catch (error) {
      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, status: previousTask.status } : task,
        ),
      );

      setMoveError(
        error instanceof Error
          ? error.message
          : "Failed to move task. Please try again.",
      );
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }

  return (
    <main className="board-page">
      <header className="board-header">
        <div>
          <h1>Task Board</h1>
        </div>
      </header>

      <section className="board-search">
        <label htmlFor="search-input">Search tasks</label>

        <input
          type="text"
          id="search-input"
          placeholder="Filter by title..."
          onChange={(e) => {
            console.log("Search query:", e.target.value);
          }}
        />
      </section>

      <section className="board-columns" aria-label="Kanban board">
        {columns.map((column) => {
          const columnTasks = tasks.filter(
            (task) => task.status === column.status,
          );

          return (
            <section
              key={column.status}
              className="board-column"
              aria-labelledby={`column-${column.status}`}
            >
              <header className="column-header">
                <h2 id={`column-${column.status}`}>{column.title}</h2>

                <span className="task-count">{columnTasks.length}</span>
              </header>

              {column.status === "TODO" && (
                <form className="add-task-form" onSubmit={handleCreateTask}>
                  <label htmlFor="new-task-title">New task</label>

                  <div className="add-task-controls">
                    <input
                      type="text"
                      id="new-task-title"
                      placeholder="Enter task title..."
                      value={newTaskTitle}
                      maxLength={80}
                      disabled={isCreating}
                      onChange={(e) => {
                        setNewTaskTitle(e.target.value);
                        setCreateError("");
                      }}
                      aria-invalid={!!createError}
                      aria-describedby={
                        createError ? "create-task-error" : undefined
                      }
                    />

                    <button type="submit" disabled={isCreating}>
                      {isCreating ? "Adding..." : "Add task"}
                    </button>
                  </div>

                  {createError && (
                    <p
                      id="create-task-error"
                      className="form-error"
                      role="alert"
                    >
                      {createError}
                    </p>
                  )}
                </form>
              )}

              <div className="task-list">
                {columnTasks.length === 0 ? (
                  <p className="empty-column">No tasks yet</p>
                ) : (
                  columnTasks.map((task) => (
                    <article key={task.id} className="task-card">
                      <h3>{task.title}</h3>

                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}

                      {task.dueDate && (
                        <p className="task-due-date">Due: {task.dueDate}</p>
                      )}

                      <div className="task-actions">
                        {columns
                          .filter(
                            (targetColumn) =>
                              targetColumn.status !== task.status,
                          )
                          .map((targetColumn) => (
                            <button
                              key={targetColumn.status}
                              type="button"
                              disabled={movingTaskIds.has(task.id)}
                              onClick={() =>
                                handleMoveTask(task.id, targetColumn.status)
                              }
                            >
                              Move to {targetColumn.title}
                            </button>
                          ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </section>
    </main>
  );
}
