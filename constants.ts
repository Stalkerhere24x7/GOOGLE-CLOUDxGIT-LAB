
import { ProjectFile } from './types';

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';
export const GEMINI_MODEL_IMAGE_GEN = 'imagen-3.0-generate-002';

export const DEFAULT_PROJECT_FILES: ProjectFile[] = [
  { path: 'index.html', type: 'file', content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Awesome App</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Hello, CodeWeaver!</h1>
    <p>Edit this project to get started.</p>
    <p>You can create a project structure in the 'Project' tab or ask the AI to help you scaffold files in the 'Co-Coding Chat' tab!</p>
    <script src="script.js"></script>
</body>
</html>` },
  { path: 'style.css', type: 'file', content: `body {
    font-family: sans-serif;
    margin: 20px;
    background-color: #f0f0f0; /* Light mode bg */
    color: #111; /* Light mode text */
}

@media (prefers-color-scheme: dark) {
    body {
        background-color: #2b2b2b; /* Dark mode bg */
        color: #f0f0f0; /* Dark mode text */
    }
    h1 {
        color: #e0e0e0;
    }
}

h1 {
    color: #333;
}` },
  { path: 'script.js', type: 'file', content: `console.log("Hello from script.js in CodeWeaver AI!");

// Example: Add a new paragraph when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const p = document.createElement('p');
    p.textContent = 'JavaScript is working!';
    document.body.appendChild(p);
});` },
  { path: 'README.md', type: 'file', content: `# My Project

This is a sample project created with CodeWeaver AI.

## Getting Started

1.  Explore the files: \`index.html\`, \`style.css\`, \`script.js\`.
2.  Go to the **Project** tab to see the file structure or create your own.
3.  Use the **Code Editor** (automatically displays the active file) and try the **Preview** button.
4.  Leverage **Co-Coding Chat** to generate code, refactor, or even create new files (e.g., "create a file named 'data.json' with { 'message': 'hello' }").
5.  Analyze your code in the **Analysis** tab.
6.  Connect to GitLab and push your project via the **Project Control** tab.
` },
];

export const INITIAL_PROJECT_CONTEXT = "This is a versatile coding project. The user might be working on web development (HTML/JS/CSS), Python scripts, or other common programming tasks. The AI should assist with code generation, debugging, analysis, file scaffolding, and optimization. If asked to create files, it should use the specified JSON format for file operations.";

export const STACKOVERFLOW_BASE_URL = "https://stackoverflow.com";
