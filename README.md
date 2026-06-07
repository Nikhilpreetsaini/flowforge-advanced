# FlowForge Advanced

FlowForge Advanced is a powerful, offline‑ready task and project manager built with plain HTML, CSS and JavaScript.  It expands on the original FlowForge Pro with multi‑user support, recurring tasks, dependencies, subtasks, a calendar view, time tracking and more.  All data lives in your browser via `localStorage`, so once loaded you can work without an internet connection.

## Key Features

* **Multi‑User Accounts** – Register and log in with a username and password.  Each user’s tasks and categories are kept separate in `localStorage`.
* **Tasks and Categories** – Create tasks with titles, descriptions, due dates, priority and categories.  Organise tasks into custom categories.
* **Subtasks and Notes** – Break larger tasks down into subtasks and add rich notes.  Progress bars update automatically as subtasks are completed.
* **Recurring Tasks** – Set a task to repeat daily, weekly or monthly.  When you complete it, the next occurrence is automatically scheduled.
* **Dependencies** – Specify that a task can’t be completed until other tasks are finished.  The UI disables the “Done” button until dependencies are met.
* **Manual Progress Tracking** – For tasks without subtasks, use a slider to track percentage completion.
* **Time Tracking** – Start and stop timers for tasks.  The total time spent is displayed in the task list.
* **Filtering and Sorting** – Filter tasks by category or search term and sort by due date, priority or creation date.
* **Calendar View** – Toggle between list and calendar views to see upcoming tasks by day.  Click a date to see its tasks.
* **Light/Dark Theme** – Switch between light and dark themes.  Your choice persists across sessions.
* **Offline Support** – A service worker caches the app shell so you can work offline once the page has loaded.
* **Installable PWA** – A web app manifest and icons let you install FlowForge Advanced to your home screen.

## Running Locally

To run FlowForge Advanced on your computer, simply open `index.html` in a modern browser.  You can also serve the directory with a simple HTTP server if your browser restricts access to local files.

### Deploying to GitHub Pages

To host FlowForge Advanced on GitHub Pages:

1. Create a new repository and upload all files from the `flowforge-pro-advanced` folder.
2. Commit the files to the `main` branch.  If your repository already contains an earlier version, replace the existing files with the new ones.
3. In your repository settings, navigate to **Pages**.
4. Select `main` as the branch and choose the **root** folder (`/`).  Save.
5. After a short build, your app will be available at `https://<yourusername>.github.io/<repository>/`.

## License

This project is released under the MIT license.  You are free to use, modify and distribute it.