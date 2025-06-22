CodeWeaver AI - Build Software. Faster.
A Submission for the GitLab & Google Cloud Hackathon
CodeWeaver AI is an intelligent development environment designed from the ground up to accelerate the modern software development lifecycle. By deeply integrating Google Cloud's Gemini AI with GitLab's AI-Powered DevSecOps Platform, CodeWeaver AI eliminates developer toil, automates complex tasks, and allows teams to focus on what matters: delivering value.
Our Core Philosophy: We took the theme "Building Software. Faster." as a direct technical challenge. Every feature in CodeWeaver is built to answer one question: "How can we make this step faster, smarter, and more integrated?"
How We Meet the GitLab Challenge
Challenge Requirement	How CodeWeaver AI Delivers
🤖 AI-Enabled App	The entire application is powered by Google's Gemini 1.5 AI. Gemini is not an add-on; it's the engine for code analysis, chat-based refactoring, automated bug-fixing, and CI/CD pipeline generation. It acts as an expert pair programmer available 24/7.
☁️ Using GitLab & Google Cloud	We achieve a seamless integration that leverages the strengths of both platforms:
- GitLab: Used as the definitive source control system and deployment target. Our app pushes code, branches, and commits directly to a GitLab project via its API. 
- Google Cloud: Gemini powers all intelligent features. BigQuery is used to search the stackoverflow public dataset, providing developers with relevant, scored solutions directly in their workflow without ever leaving the app.
🚀 Building Software. Faster.	This is our core principle, demonstrated through our key features:
- One-Click Fix: Automatically analyze terminal errors and apply an AI-generated fix with a single button press.
- Direct Code Editing: Have Gemini modify code based on natural language commands and review the changes with an integrated diff highlighter before applying.
- ⚡ The Killer Feature: Our AI-Powered CI/CD Helper analyzes your project's context and code to generate a complete .gitlab-ci.yml file, accelerating project setup from hours to seconds.
📦 GitLab CI/CD Contributions	While not a direct MR to the GitLab CE codebase, we contribute a vital functional component: The CI/CD Generator acts as a "factory" for producing high-quality pipeline configurations. It empowers developers to create robust, context-aware .gitlab-ci.yml files that can be version-controlled, shared, and even proposed for inclusion in the official GitLab CI/CD Catalog.
Key Features in Action
AI Code Analysis & Chat: Understand your code's purpose and get actionable suggestions. Use the Co-Coding chat to refactor, debug, or add new features collaboratively with the AI.
Integrated Terminal with "Fix Error": Run your code, see the output, and if an error occurs, click a single button to have Gemini analyze the traceback and your source code to propose a fix.
The CI/CD Generator: The star of the show. Click "Generate .gitlab-ci.yml" and let the AI build a complete pipeline file for you, including stages for building, testing (e.g., pytest, flake8), and deploying. It's the ultimate project bootstrap tool.
Direct GitLab Integration: Push your finished code, including the newly generated CI/CD pipeline, directly to a new branch in your GitLab repository, ready for a merge request.
Future Roadmap: Fully AI-Driven Merge Requests
To further our mission of building software faster, our next major feature is Intelligent Merge Request Generation. CodeWeaver AI will use Gemini to:
Analyze the diff between the feature branch and the target branch (main).
Automatically generate a descriptive MR title and a detailed summary of changes.
Explain the "why" behind the code modifications, linking them back to the project context.
This will dramatically reduce the time spent on creating high-quality merge requests, improve the code review process, and get features deployed even faster.

Setup & Installation
To run CodeWeaver AI locally:

1. Clone the repository:
git clone https://github.com/your-username/your-repo.git
    cd your-repo

2. Set up a virtual environment
python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

3. Install dependencies

4. Configure your environment:
Make a copy .env
Fill in your secret keys and project details in the .env file. You will need:
GEMINI_API_KEY
GITLAB_URL (e.g., https://gitlab.com)
GITLAB_PRIVATE_TOKEN
GITLAB_PROJECT_ID
GOOGLE_CLOUD_PROJECT (for BigQuery)


5. Run the application


For queries: Contact rlvntsupreet@gmail.com or sidhmanush@gmail.com