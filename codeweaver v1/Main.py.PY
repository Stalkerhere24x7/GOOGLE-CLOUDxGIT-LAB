#
# CodeWeaver AI - Competition Ready Version
#
# An AI-powered DevSecOps platform built to excel in the GitLab & Google Cloud Hackathon.
# This software demonstrates how to "build Software. Faster." by deeply integrating its
# core components: Google Cloud, Gemini, and GitLab.
#
# HACKATHON CRITERIA MET:
# 1.  AI-ENABLED APP: Gemini AI is used for code analysis, chat, automated refactoring,
#    bug fixing, and even DevOps acceleration (CI/CD generation).
#
# 2.  GITLAB & GOOGLE CLOUD:
#    - GitLab is used for version control (pushing code) and as a target for our unique
#      AI-powered CI/CD pipeline generator, which accelerates the DevSecOps workflow.
#    - Google Cloud powers the AI (Gemini) and data analytics (BigQuery for Stack Overflow search),
#      fulfilling the core requirements of the hackathon.
#
# 3.  BUILDING FASTER: The entire application is a testament to this principle. From
#    AI-powered bug fixes to automated CI/CD file generation, every feature is designed
#    to boost developer productivity.
#

import tkinter as tk
from tkinter import scrolledtext, messagebox, ttk, font as tkfont
import os
import threading
import json
import webbrowser
import tempfile
import subprocess
import difflib
import queue
import re
from html.parser import HTMLParser


# --- LIBRARY IMPORT CHECKS ---
try:
    from dotenv import load_dotenv
except ImportError:
    print("CRITICAL ERROR: python-dotenv library not found. Please install it: pip install python-dotenv")
    exit()

try:
    import google.generativeai as genai
except ImportError:
    print("CRITICAL ERROR: Google Generative AI SDK not found. Please install it: pip install google-generativeai")
    exit()

try:
    import gitlab
except ImportError:
    print("CRITICAL ERROR: Python-gitlab library not found. Please install it: pip install python-gitlab")
    exit()

try:
    from google.cloud import bigquery
    from google.api_core import exceptions as google_exceptions
except ImportError:
    print("CRITICAL ERROR: Google Cloud BigQuery library not found. Please install it: pip install google-cloud-bigquery")
    exit()

# --- CONFIGURATION & INITIALIZATION ---
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITLAB_URL = os.getenv("GITLAB_URL")
GITLAB_PRIVATE_TOKEN = os.getenv("GITLAB_PRIVATE_TOKEN")
GITLAB_PROJECT_ID = os.getenv("GITLAB_PROJECT_ID")
GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")

# --- Global Service Variables ---
gemini_model = None
gl = None
gitlab_project = None
bigquery_client = None
gemini_init_ok = False
gitlab_init_ok = False
bigquery_init_ok = False

def initialize_services():
    """Initializes Gemini, GitLab, and Google Cloud services in the background."""
    global gemini_model, gl, gitlab_project, bigquery_client, gemini_init_ok, gitlab_init_ok, bigquery_init_ok
    print("Initializing services...")

    # Gemini
    if GEMINI_API_KEY:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
            gemini_model = genai.GenerativeModel('gemini-1.5-flash-latest')
            gemini_init_ok = True
            print("Gemini Initialized OK.")
        except Exception as e:
            print(f"Gemini Initialization Error: {e}")
    else:
        print("ERROR: GEMINI_API_KEY not found in .env")

    # GitLab
    if GITLAB_URL and GITLAB_PRIVATE_TOKEN and GITLAB_PROJECT_ID:
        try:
            gl = gitlab.Gitlab(GITLAB_URL, private_token=GITLAB_PRIVATE_TOKEN, timeout=20)
            gl.auth()
            gitlab_project = gl.projects.get(GITLAB_PROJECT_ID)
            gitlab_init_ok = True
            print("GitLab Initialized OK.")
        except Exception as e:
            print(f"GitLab Initialization Error: {e}")
    else:
        print("ERROR: GitLab configuration missing in .env")

    # BigQuery
    if GOOGLE_CLOUD_PROJECT:
        try:
            bigquery_client = bigquery.Client(project=GOOGLE_CLOUD_PROJECT)
            bigquery_client.query("SELECT 1").result() # Test query
            bigquery_init_ok = True
            print("Google Cloud BigQuery Initialized OK.")
        except google_exceptions.DefaultCredentialsError:
            print("\n--- BIGQUERY AUTH ERROR: Please run 'gcloud auth application-default login' ---\n")
        except Exception as e:
            print(f"BigQuery Initialization Error: {e}")
    else:
        print("INFO: GOOGLE_CLOUD_PROJECT not found in .env. Cloud Search will be disabled.")

class ThemeManager:
    """Manages themes and widget styling for a polished UI."""
    THEMES = {
        "dark": {
            "bg": "#2b2b2b", "fg": "#f0f0f0", "input_bg": "#3c3f41", "text_bg": "#2b2b2b",
            "accent": "#4285F4", "accent_active": "#5e97f6", "accent_fg": "#ffffff",
            "disabled_bg": "#3c3f41", "disabled_fg": "#888888", "select_bg": "#4a4d4f",
            "terminal_bg": "#1e1e1e", "terminal_fg": "#e0e0e0", "change_bg": "#573535", "link_fg": "#82aaff"
        },
        "light": {
            "bg": "#f5f5f5", "fg": "#000000", "input_bg": "#ffffff", "text_bg": "#ffffff",
            "accent": "#1a73e8", "accent_active": "#185abc", "accent_fg": "#ffffff",
            "disabled_bg": "#e8e8e8", "disabled_fg": "#999999", "select_bg": "#d2e3fc",
            "terminal_bg": "#ffffff", "terminal_fg": "#000000", "change_bg": "#fdd", "link_fg": "#1967d2"
        }
    }
    def __init__(self, root, initial_theme="dark"):
        self.root = root
        self.current_theme = initial_theme
        self.style = ttk.Style(root)
        if 'clam' in self.style.theme_names():
            self.style.theme_use('clam')
    def get_colors(self):
        return self.THEMES[self.current_theme]
    def apply_theme(self):
        colors = self.get_colors()
        self.root.config(bg=colors["bg"])
        self.style.configure('.', background=colors["bg"], foreground=colors["fg"], fieldbackground=colors["input_bg"], font=('Segoe UI', 10))
        self.style.configure('TFrame', background=colors["bg"])
        self.style.configure('TLabel', background=colors["bg"], foreground=colors["fg"], font=('Segoe UI', 10))
        self.style.configure('TButton', background=colors["accent"], foreground=colors["accent_fg"], font=('Segoe UI', 10, 'bold'), borderwidth=0, padding=5, relief=tk.FLAT)
        self.style.map('TButton', foreground=[('disabled', colors["disabled_fg"])], background=[('active', colors["accent_active"]), ('disabled', colors["disabled_bg"])], relief=[('active', 'sunken'), ('!active', 'flat')])
        self.style.configure('TEntry', fieldbackground=colors["input_bg"], foreground=colors["fg"], insertcolor=colors["fg"])
        self.style.configure('TPanedwindow', background=colors["bg"])
        self.style.configure('TNotebook', background=colors["bg"])
        self.style.configure('TNotebook.Tab', background=colors["bg"], foreground=colors["fg"], padding=[10, 5])
        self.style.map('TNotebook.Tab', background=[('selected', colors["accent"]), ('active', colors["select_bg"])], foreground=[('selected', colors["accent_fg"])])
        self.style.configure('TLabelframe', background=colors["bg"], foreground=colors["fg"], bordercolor=colors["fg"])
        self.style.configure('TLabelframe.Label', background=colors["bg"], foreground=colors["fg"], font=('Segoe UI', 12, 'bold'))

class SimpleHtmlView(ttk.Frame):
    """A custom widget to render simple HTML content within a Tkinter application."""
    def __init__(self, parent, theme_manager, *args, **kwargs):
        super().__init__(parent, *args, **kwargs)
        self.theme_manager = theme_manager

        self.text_widget = scrolledtext.ScrolledText(self, wrap=tk.WORD, state=tk.DISABLED, relief=tk.FLAT, padx=10, pady=10)
        self.text_widget.pack(fill=tk.BOTH, expand=True)
        self.setup_tags()

    def setup_tags(self):
        """Configure Tkinter tags to represent HTML styles."""
        colors = self.theme_manager.get_colors()
        self.text_widget.config(background=colors['input_bg'], fg=colors['fg'])
        
        base_font = tkfont.Font(family="Segoe UI", size=11)
        h1_font = tkfont.Font(family="Segoe UI", size=18, weight="bold")
        h2_font = tkfont.Font(family="Segoe UI", size=14, weight="bold")
        bold_font = tkfont.Font(family="Segoe UI", size=11, weight="bold")

        self.text_widget.tag_configure("h1", font=h1_font, spacing3=10)
        self.text_widget.tag_configure("h2", font=h2_font, spacing1=15, spacing3=5)
        self.text_widget.tag_configure("p", font=base_font, spacing3=12)
        self.text_widget.tag_configure("li", font=base_font, lmargin1=20, lmargin2=20, spacing3=4)
        self.text_widget.tag_configure("b", font=bold_font)
        self.text_widget.tag_configure("code", font=("Consolas", 10), background=colors['select_bg'])

    def render(self, html):
        """Parses a simple HTML string and renders it in the text widget."""
        self.setup_tags() # Re-apply theme colors
        self.text_widget.config(state=tk.NORMAL)
        self.text_widget.delete("1.0", tk.END)

        # A very simple, line-based parser. Does not support complex nesting.
        lines = [line.strip() for line in html.strip().split('\n') if line.strip()]

        for line in lines:
            tag_match = re.match(r'<(\w+)>', line.lower())
            if not tag_match:
                self.text_widget.insert(tk.END, line + '\n')
                continue

            tag = tag_match.group(1)
            content = re.sub(r'</?\w+>', '', line).strip()

            if tag in ['h1', 'h2']:
                self.text_widget.insert(tk.END, content + '\n', (tag,))
            elif tag == 'li':
                self.text_widget.insert(tk.END, '• ' + content + '\n', (tag,))
            elif tag == 'p':
                # Handle nested <b> tags within a paragraph
                parts = re.split(r'(<b>.*?</b>)', line[3:-4])
                for part in parts:
                    if not part: continue
                    if part.lower().startswith('<b>'):
                        self.text_widget.insert(tk.END, part[3:-4], ('p', 'b'))
                    else:
                        self.text_widget.insert(tk.END, part, ('p',))
                self.text_widget.insert(tk.END, '\n')

        self.text_widget.config(state=tk.DISABLED)

class CodeWeaverApp:
    """The main application class for CodeWeaver AI."""
    def __init__(self, root):
        self.root = root
        self.theme_manager = ThemeManager(root)
        self.root.title("CodeWeaver AI - Powered by Google Cloud, Gemini & GitLab")
        self.root.geometry("1800x1100")

        self.setup_fonts()
        self.last_pushed_gitlab_url = None
        self.original_code_before_edit = None
        self.identified_language = "unknown"
        self.last_terminal_error = ""
        self.interactive_terminal_process = None
        self.terminal_output_queue = queue.Queue()

        self.setup_ui()
        self.theme_manager.apply_theme()
        self.apply_theme_to_widgets()
        
        self.start_interactive_terminal()
        self.root.after(100, self.post_init_tasks)
        self._update_button_states()

    def post_init_tasks(self):
        """Tasks to run after the main UI is built and services are initializing."""
        self.check_services_and_alert()
        self.update_dashboard()

    def setup_fonts(self):
        """Initializes fonts used throughout the application."""
        self.ui_font = tkfont.Font(family="Segoe UI", size=11)
        self.ui_bold_font = tkfont.Font(family="Segoe UI", size=11, weight="bold")
        self.code_font = tkfont.Font(family="Consolas", size=12)
        self.terminal_font = tkfont.Font(family="Consolas", size=11)

    def setup_ui(self):
        """Constructs the main user interface."""
        top_bar = ttk.Frame(self.root, padding=(10, 5, 10, 0))
        top_bar.pack(fill=tk.X)
        ttk.Label(top_bar, text="CodeWeaver AI", font=('Segoe UI', 16, 'bold')).pack(side=tk.LEFT)
        ttk.Label(top_bar, text="Powered by Google Cloud, Gemini & GitLab", font=('Segoe UI', 10, 'italic')).pack(side=tk.LEFT, padx=10, pady=4)

        main_container_frame = ttk.Frame(self.root, padding=10)
        main_container_frame.pack(fill=tk.BOTH, expand=True)

        main_paned_window = ttk.PanedWindow(main_container_frame, orient=tk.HORIZONTAL)
        main_paned_window.pack(fill=tk.BOTH, expand=True)

        left_pane_container = ttk.Frame(main_paned_window)
        main_paned_window.add(left_pane_container, weight=3)
        left_vertical_pane = ttk.PanedWindow(left_pane_container, orient=tk.VERTICAL)
        left_vertical_pane.pack(fill=tk.BOTH, expand=True)

        # --- Code Editor ---
        editor_frame = ttk.LabelFrame(left_vertical_pane, text="Code Editor", padding=5)
        left_vertical_pane.add(editor_frame, weight=1)
        editor_toolbar = ttk.Frame(editor_frame)
        editor_toolbar.pack(fill=tk.X, pady=(0, 10))
        self.run_code_button = ttk.Button(editor_toolbar, text="Run Code", command=self.run_dynamic_preview)
        self.run_code_button.pack(side=tk.LEFT, padx=(0,5))
        self.analyze_button = ttk.Button(editor_toolbar, text="Analyze", command=self.analyze_code_with_gemini)
        self.analyze_button.pack(side=tk.LEFT, padx=(0, 5))
        self.apply_changes_button = ttk.Button(editor_toolbar, text="Apply Changes", command=self.apply_gemini_changes, state=tk.DISABLED)
        self.apply_changes_button.pack(side=tk.LEFT, padx=5)
        self.discard_changes_button = ttk.Button(editor_toolbar, text="Discard", command=self.discard_gemini_changes, state=tk.DISABLED)
        self.discard_changes_button.pack(side=tk.LEFT, padx=5)
        self.code_text = scrolledtext.ScrolledText(editor_frame, wrap=tk.WORD, font=self.code_font, undo=True, relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.code_text.pack(fill=tk.BOTH, expand=True)
        self.code_text.insert(tk.END, "# Welcome! Edit code here or use Co-Coding Chat to modify it.\n"
                                     "def fibonacci(n):\n    if n <= 1:\n        return n\n    else:\n        return fibonacci(n-1) + fibonacci(n-2)\n\n"
                                     "for i in range(10):\n    print(fibonacci(i))\n")

        # --- Terminal ---
        terminal_frame = ttk.LabelFrame(left_vertical_pane, text="Interactive Terminal", padding=5)
        left_vertical_pane.add(terminal_frame, weight=1)
        terminal_toolbar = ttk.Frame(terminal_frame)
        terminal_toolbar.pack(fill=tk.X, pady=(5,5))
        self.fix_error_button = ttk.Button(terminal_toolbar, text="Gemini: Fix Error", command=self.fix_terminal_error, state=tk.DISABLED)
        self.fix_error_button.pack(side=tk.LEFT)
        self.terminal = scrolledtext.ScrolledText(terminal_frame, wrap=tk.WORD, font=self.terminal_font, relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.terminal.pack(fill=tk.BOTH, expand=True)
        self.terminal_prompt_end = "1.0"
        self.terminal_input_lock = threading.Lock()
        self.terminal.bind("<Return>", self.on_terminal_enter)
        self.terminal.bind("<Key>", self.on_terminal_keypress)
        self.root.after(100, self.poll_terminal_queue)

        # --- Right Control Panel Notebook ---
        right_notebook = ttk.Notebook(main_paned_window)
        main_paned_window.add(right_notebook, weight=1)

        # --- NEW: Dashboard Tab ---
        self.dashboard_tab = ttk.Frame(right_notebook)
        right_notebook.add(self.dashboard_tab, text="Dashboard")
        self.setup_dashboard_ui()

        # --- Other Tabs ---
        self.analysis_tab = ttk.Frame(right_notebook, padding=10)
        right_notebook.add(self.analysis_tab, text="Analysis")
        self.setup_analysis_display()

        self.chat_tab = ttk.Frame(right_notebook, padding=10)
        right_notebook.add(self.chat_tab, text="Co-Coding Chat")
        self.setup_chat_ui()

        self.gitlab_tab = ttk.Frame(right_notebook, padding=10)
        right_notebook.add(self.gitlab_tab, text="Project Control")
        self.setup_gitlab_tab_ui()
        
        self.cloud_tab = ttk.Frame(right_notebook, padding=10)
        right_notebook.add(self.cloud_tab, text="Cloud Search")
        self.setup_cloud_search_ui()

        # Menu and Status Bar
        menu_bar = tk.Menu(self.root)
        self.root.config(menu=menu_bar)
        theme_menu = tk.Menu(menu_bar, tearoff=0)
        menu_bar.add_cascade(label="View", menu=theme_menu)
        theme_menu.add_command(label="Toggle Light/Dark Theme", command=self.toggle_theme)

        self.status_bar_frame = ttk.Frame(self.root, padding=(10,2,10,2))
        self.status_bar_frame.pack(side=tk.BOTTOM, fill=tk.X)
        self.status_bar_label = ttk.Label(self.status_bar_frame, text="Ready", anchor=tk.W)
        self.status_bar_label.pack(side=tk.LEFT, fill=tk.X)

    def setup_dashboard_ui(self):
        """Sets up the HTML-based dashboard tab."""
        self.dashboard_view = SimpleHtmlView(self.dashboard_tab, self.theme_manager)
        self.dashboard_view.pack(fill=tk.BOTH, expand=True)

    def update_dashboard(self):
        """Generates HTML content and renders it on the dashboard."""
        status_colors = {True: "#4CAF50", False: "#F44336"} # Green for OK, Red for Error
        gemini_stat = f"<b style='color:{status_colors[gemini_init_ok]};'>{'OK' if gemini_init_ok else 'Error'}</b>"
        gitlab_stat = f"<b style='color:{status_colors[gitlab_init_ok]};'>{'OK' if gitlab_init_ok else 'Error'}</b>"
        bquery_stat = f"<b style='color:{status_colors[bigquery_init_ok]};'>{'OK' if bigquery_init_ok else 'Error'}</b>"

        html_content = f"""
<h1>Welcome to CodeWeaver AI</h1>
<p>Your integrated DevSecOps environment, powered by <b>Google Cloud</b>, <b>Gemini</b>, and <b>GitLab</b>.</p>
<h2>Service Status</h2>
<p>Gemini AI: {gemini_stat}</p>
<p>GitLab Project: {gitlab_stat}</p>
<p>Google Cloud BigQuery: {bquery_stat}</p>
<h2>Getting Started</h2>
<li>In the <b>Code Editor</b>, click <b>Analyze</b> to get AI insights on your code.</li>
<li>Use the <b>Co-Coding Chat</b> tab to refactor, debug, or write new code with Gemini.</li>
<li>Enable <b>Direct Code Edit Mode</b> in chat to have the AI modify your code directly.</li>
<li>In <b>Project Control</b>, push code to GitLab or generate a CI/CD pipeline.</li>
"""
        # Note: A limitation of the simple parser is that inline styles in the string are ignored.
        # Colors would require enhancing the parser or using Tkinter tag configurations directly.
        # For now, text status is sufficient.
        if self.dashboard_view:
             self.dashboard_view.render(html_content)

    def setup_analysis_display(self):
        """Sets up the Analysis tab UI."""
        ttk.Label(self.analysis_tab, text="Code Analysis & Suggestions", font=self.ui_bold_font).pack(pady=(0, 10), anchor='w')
        self.analysis_text = scrolledtext.ScrolledText(self.analysis_tab, wrap=tk.WORD, state=tk.DISABLED, font=self.ui_font, relief=tk.SOLID, borderwidth=1, padx=5, pady=5, cursor="arrow")
        self.analysis_text.pack(fill=tk.BOTH, expand=True)
        self.suggestion_data = {}
        self.analysis_text.bind("<Button-1>", self.on_suggestion_click)

    def setup_chat_ui(self):
        """Sets up the Co-Coding Chat tab UI."""
        self.chat_output = scrolledtext.ScrolledText(self.chat_tab, wrap=tk.WORD, state=tk.DISABLED, font=self.ui_font, relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.chat_output.pack(fill=tk.BOTH, expand=True, pady=5)
        chat_input_frame = ttk.Frame(self.chat_tab)
        chat_input_frame.pack(fill=tk.X, pady=(5,0))
        self.direct_edit_mode = tk.BooleanVar(value=False)
        self.edit_mode_toggle = ttk.Checkbutton(chat_input_frame, text="Direct Code Edit Mode", variable=self.direct_edit_mode)
        self.edit_mode_toggle.pack(side=tk.TOP, pady=(0,10), anchor=tk.W)
        self.chat_input_entry = ttk.Entry(chat_input_frame, font=self.ui_font)
        self.chat_input_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,5))
        self.chat_send_button = ttk.Button(chat_input_frame, text="Send", command=self.send_chat_message)
        self.chat_send_button.pack(side=tk.LEFT)
        self.chat_input_entry.bind("<Return>", lambda event: self.send_chat_message())

    def setup_gitlab_tab_ui(self):
        """Sets up the entire Project Control tab, including sub-sections."""
        container = ttk.Frame(self.gitlab_tab)
        container.pack(fill=tk.BOTH, expand=True)
        self.setup_project_context_ui(container)
        self.setup_gitlab_ui(container)
        self.setup_cicd_helper_ui(container)

    def setup_project_context_ui(self, parent):
        """Sets up the Project Context panel for AI."""
        frame = ttk.LabelFrame(parent, text="AI Project Context")
        frame.pack(fill=tk.X, pady=(0, 15), expand=True)
        ttk.Label(frame, text="Gemini uses this summary to understand the overall project goal.", wraplength=400, font=self.ui_font).pack(padx=5, pady=(5,0), anchor='w')
        self.project_context_text = scrolledtext.ScrolledText(frame, height=6, wrap=tk.WORD, font=self.ui_font, relief=tk.SOLID, borderwidth=1, padx=5, pady=5)
        self.project_context_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.project_context_text.insert(tk.END, "Project summary not yet generated.")
        self.generate_summary_button = ttk.Button(frame, text="Generate from Current Code", command=self.generate_project_summary)
        self.generate_summary_button.pack(side=tk.LEFT, padx=5, pady=(0,5))

    def setup_gitlab_ui(self, parent):
        """Sets up the GitLab Version Control panel."""
        frame = ttk.LabelFrame(parent, text="GitLab Version Control")
        frame.pack(fill=tk.X, pady=(0, 15), expand=True)
        frame.grid_columnconfigure(1, weight=1)
        ttk.Label(frame, text="File Path:").grid(row=0, column=0, padx=5, pady=5, sticky=tk.W)
        self.gitlab_file_path_var = tk.StringVar(value="src/app/main.py")
        ttk.Entry(frame, textvariable=self.gitlab_file_path_var).grid(row=0, column=1, padx=5, pady=5, sticky=tk.EW)
        ttk.Label(frame, text="Branch:").grid(row=1, column=0, padx=5, pady=5, sticky=tk.W)
        self.gitlab_branch_var = tk.StringVar(value="feature/ai-assistant")
        ttk.Entry(frame, textvariable=self.gitlab_branch_var).grid(row=1, column=1, padx=5, pady=5, sticky=tk.EW)
        ttk.Label(frame, text="Commit Message:").grid(row=2, column=0, padx=5, pady=5, sticky=tk.W)
        self.gitlab_commit_msg_var = tk.StringVar(value="[AI] Update code via CodeWeaver")
        ttk.Entry(frame, textvariable=self.gitlab_commit_msg_var).grid(row=2, column=1, padx=5, pady=5, sticky=tk.EW)
        btn_frame = ttk.Frame(frame)
        btn_frame.grid(row=3, columnspan=2, pady=10)
        self.push_gitlab_button = ttk.Button(btn_frame, text="Push to GitLab", command=self.push_to_gitlab)
        self.push_gitlab_button.pack(side=tk.LEFT, padx=5)
        self.view_on_gitlab_button = ttk.Button(btn_frame, text="View Last Push", command=self.view_on_gitlab, state=tk.DISABLED)
        self.view_on_gitlab_button.pack(side=tk.LEFT, padx=5)

    def setup_cicd_helper_ui(self, parent):
        """Sets up the GitLab CI/CD Helper panel - a key hackathon feature."""
        frame = ttk.LabelFrame(parent, text="AI-Powered CI/CD Helper")
        frame.pack(fill=tk.X, expand=True)
        ttk.Label(frame, text="Let Gemini generate a CI/CD pipeline file based on your project context and code to build faster.", wraplength=400, font=self.ui_font).pack(padx=5, pady=(5,0), anchor='w')
        self.generate_cicd_button = ttk.Button(frame, text="Generate .gitlab-ci.yml", command=self.generate_cicd_file)
        self.generate_cicd_button.pack(padx=5, pady=10)

    def setup_cloud_search_ui(self):
        """Sets up the Cloud Search tab UI for searching Stack Overflow."""
        frame = ttk.LabelFrame(self.cloud_tab, text="Search Stack Overflow (via Google Cloud BigQuery)")
        frame.pack(fill=tk.BOTH, expand=True)
        btn_frame = ttk.Frame(frame)
        btn_frame.pack(fill=tk.X, padx=5, pady=(10,5))
        self.gemini_so_button = ttk.Button(btn_frame, text="Gemini: Find SO Solutions", command=self.gemini_search_stackoverflow)
        self.gemini_so_button.pack(side=tk.LEFT)
        search_bar_frame = ttk.Frame(frame)
        search_bar_frame.pack(fill=tk.X, padx=5, pady=5)
        self.so_search_entry = ttk.Entry(search_bar_frame, font=self.ui_font)
        self.so_search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0,5))
        self.so_search_button = ttk.Button(search_bar_frame, text="Search", command=self.manual_search_stackoverflow)
        self.so_search_button.pack(side=tk.LEFT)
        self.so_search_entry.bind("<Return>", lambda e: self.manual_search_stackoverflow())
        self.so_results_text = scrolledtext.ScrolledText(frame, wrap=tk.WORD, state=tk.DISABLED, font=self.ui_font, relief=tk.SOLID, borderwidth=1, padx=5, pady=5, cursor="arrow")
        self.so_results_text.pack(fill=tk.BOTH, expand=True, padx=5, pady=(0,5))
        self.so_results_data = {}
        self.so_results_text.bind("<Button-1>", self.on_so_result_click)

    def toggle_theme(self):
        """Switches between light and dark themes."""
        self.theme_manager.current_theme = "light" if self.theme_manager.current_theme == "dark" else "dark"
        self.theme_manager.apply_theme()
        self.apply_theme_to_widgets()

    def apply_theme_to_widgets(self):
        """Applies the current theme colors to all relevant widgets."""
        colors = self.theme_manager.get_colors()
        self.root.config(bg=colors["bg"])
        self.code_text.config(background=colors["text_bg"], fg=colors["fg"], insertbackground=colors["fg"], selectbackground=colors["select_bg"])
        self.code_text.tag_configure("gemini_change", background=colors["change_bg"])
        self.chat_output.config(background=colors["input_bg"], fg=colors["fg"])
        self.terminal.config(background=colors["terminal_bg"], fg=colors["terminal_fg"], insertbackground=colors["fg"], selectbackground=colors["select_bg"])
        self.project_context_text.config(background=colors["input_bg"], fg=colors["fg"], insertbackground=colors["fg"], selectbackground=colors["select_bg"])
        self.analysis_text.config(background=colors["input_bg"], fg=colors["fg"])
        self.analysis_text.tag_configure("suggestion_link", foreground=colors["link_fg"], underline=True)
        self.so_results_text.config(background=colors["input_bg"], fg=colors["fg"])
        self.so_results_text.tag_configure("link", foreground=colors["link_fg"], underline=True)
        self.so_results_text.tag_configure("meta", foreground="gray")
        if hasattr(self, 'dashboard_view'):
            self.dashboard_view.render(self.dashboard_view.text_widget.get(1.0, tk.END)) # Re-render to apply theme

    def check_services_and_alert(self):
        """Checks if services initialized correctly and alerts the user if not."""
        init_done = init_thread.is_alive() is False
        if init_done:
            self.update_dashboard()
            if not all([gemini_init_ok, gitlab_init_ok, bigquery_init_ok]):
                 messagebox.showwarning("Service Initialization Error", "One or more services failed to initialize. Check .env and console. Some features may be disabled.")
        else:
            self.root.after(200, self.check_services_and_alert) # Check again later

    def _set_status(self, message, clear_after_ms=None):
        """Updates the status bar message."""
        def update():
            if self.root.winfo_exists():
                self.status_bar_label.config(text=f" {message}")
                if clear_after_ms:
                    self.root.after(clear_after_ms, lambda: self.status_bar_label.config(text=" Ready"))
        if self.root.winfo_exists():
            self.root.after(0, update)

    def _update_button_states(self, *args):
        """Enables or disables buttons based on application state."""
        in_edit = self.original_code_before_edit is not None
        states = {
            self.analyze_button: gemini_init_ok and not in_edit,
            self.chat_send_button: gemini_init_ok,
            self.push_gitlab_button: gitlab_init_ok and not in_edit,
            self.so_search_button: bigquery_init_ok,
            self.gemini_so_button: bigquery_init_ok and gemini_init_ok,
            self.generate_summary_button: gemini_init_ok and not in_edit,
            self.run_code_button: not in_edit,
            self.apply_changes_button: in_edit,
            self.discard_changes_button: in_edit,
            self.generate_cicd_button: gitlab_init_ok and gemini_init_ok,
        }
        for btn, should_be_normal in states.items():
            if btn and btn.winfo_exists():
                btn.config(state=tk.NORMAL if should_be_normal else tk.DISABLED)

    def _update_scrolled_text(self, widget, content, append=False, scroll_to_end=True, tags=None):
        """Thread-safe method to update ScrolledText widgets."""
        def update_gui():
            if not widget.winfo_exists(): return
            is_disabled = widget.cget('state') == tk.DISABLED
            if is_disabled: widget.config(state=tk.NORMAL)
            
            # Defensive check for None content
            text_to_insert = content if content is not None else ""
            
            if not append: widget.delete(1.0, tk.END)
            widget.insert(tk.END, text_to_insert, tags)

            if scroll_to_end: widget.see(tk.END)
            if is_disabled: widget.config(state=tk.DISABLED)
        if self.root.winfo_exists():
            self.root.after(0, update_gui)

    def _get_project_context(self):
        """Retrieves the project context text if it's been generated."""
        if hasattr(self, 'project_context_text') and self.project_context_text.winfo_exists():
            context = self.project_context_text.get(1.0, tk.END).strip()
            if context and "not yet generated" not in context:
                return f"PROJECT CONTEXT:\n---\n{context}\n---\n\n"
        return ""

    def _cleanup_ai_response(self, text):
        """Strips common markdown fences from AI code responses."""
        if not text:
            return text
        lines = text.strip().split('\n')
        if lines and lines[0].strip().startswith('```'):
            lines.pop(0)
        if lines and lines[-1].strip() == '```':
            lines.pop(-1)
        return '\n'.join(lines)

    def start_interactive_terminal(self):
        """Starts the background shell process for the interactive terminal."""
        shell = 'cmd.exe' if os.name == 'nt' else '/bin/bash'
        try:
            self.interactive_terminal_process = subprocess.Popen(
                [shell],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                text=True, encoding='utf-8', errors='replace', bufsize=1,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
            threading.Thread(target=self.read_from_process, daemon=True).start()
        except FileNotFoundError:
            self._write_to_terminal(f"Error: Shell '{shell}' not found. Terminal is non-functional.")

    def read_from_process(self):
        """Reads output from the shell process and puts it in a queue."""
        for line in iter(self.interactive_terminal_process.stdout.readline, ''):
            self.terminal_output_queue.put(line)

    def poll_terminal_queue(self):
        """Checks the output queue and writes new lines to the terminal widget."""
        while not self.terminal_output_queue.empty():
            line = self.terminal_output_queue.get_nowait()
            self._write_to_terminal(line)
            if any(err in line.lower() for err in ["error", "exception", "traceback", "failed", "not recognized"]):
                self.last_terminal_error += line
                if self.root.winfo_exists():
                    self.fix_error_button.config(state=tk.NORMAL)
        if self.root.winfo_exists():
            self.root.after(100, self.poll_terminal_queue)

    def _write_to_terminal(self, text):
        """Thread-safe method to write text to the terminal widget."""
        with self.terminal_input_lock:
            self.terminal.config(state=tk.NORMAL)
            self.terminal.insert(tk.END, text)
            self.terminal.see(tk.END)
            self.terminal_prompt_end = self.terminal.index(tk.END)
            self.terminal.config(state=tk.DISABLED)

    def on_terminal_enter_command(self, command_to_run):
        """Programmatically sends a command to the terminal."""
        if not command_to_run: return
        self._write_to_terminal(command_to_run + "\n")
        if self.interactive_terminal_process and self.interactive_terminal_process.poll() is None:
            self.last_terminal_error = ""
            if self.root.winfo_exists(): self.fix_error_button.config(state=tk.DISABLED)
            self.interactive_terminal_process.stdin.write(command_to_run + '\n')
            self.interactive_terminal_process.stdin.flush()

    def on_terminal_enter(self, event):
        """Handles the Enter key in the terminal to send a command."""
        with self.terminal_input_lock:
            command = self.terminal.get(self.terminal_prompt_end, "end-1c").strip()
            self.terminal.config(state=tk.NORMAL)
            self.terminal.insert(tk.END, "\n")
            self.terminal_prompt_end = self.terminal.index(tk.END)
            self.terminal.config(state=tk.DISABLED)
        if self.interactive_terminal_process and self.interactive_terminal_process.poll() is None and command:
            self.on_terminal_enter_command(command)
        return "break"

    def on_terminal_keypress(self, event):
        """Allows typing only at the end of the terminal widget."""
        with self.terminal_input_lock:
            self.terminal.config(state=tk.NORMAL)
        if self.terminal.index(tk.INSERT) < self.terminal_prompt_end:
            self.terminal.mark_set(tk.INSERT, tk.END)
        if event.keysym == 'BackSpace' and self.terminal.compare(tk.INSERT, '==', self.terminal_prompt_end):
            return "break"

    def analyze_code_with_gemini(self):
        """Starts a thread to analyze code with Gemini."""
        threading.Thread(target=self._gemini_analysis_thread, args=(self.code_text.get(1.0, tk.END),), daemon=True).start()

    def _gemini_analysis_thread(self, code_content):
        """Performs the analysis in a background thread."""
        self._set_status("Analyzing code with Gemini...")
        self.root.after(0, self._update_button_states)
        prompt = f"""{self._get_project_context()}Analyze this code. Respond with a minified JSON: {{"language": "string", "breakdown": "string", "suggestions": [{{"description": "string", "fix_prompt": "string"}}]}}. Code: ```{code_content}```"""
        try:
            response = gemini_model.generate_content(prompt)
            json_text = response.text[response.text.find('{'):response.text.rfind('}')+1]
            analysis_data = json.loads(json_text)
            self.root.after(0, self.render_analysis_results, analysis_data)
            self._set_status("Analysis complete.", 5000)
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            self.root.after(0, messagebox.showerror, "Analysis Error", f"AI returned invalid or empty data: {e}")
            self._set_status("Analysis failed.")
        except Exception as e:
            self.root.after(0, messagebox.showerror, "Analysis Error", f"An unexpected error occurred: {e}")
            self._set_status("Analysis failed.")
        finally:
            if self.root.winfo_exists(): self.root.after(0, self._update_button_states)

    def render_analysis_results(self, data):
        """Displays the analysis results in the UI."""
        self.analysis_text.config(state=tk.NORMAL)
        self.analysis_text.delete('1.0', tk.END)
        self.suggestion_data.clear()
        self.identified_language = data.get("language", "unknown").lower()
        self.update_run_button_text()
        self.analysis_text.tag_configure("header", font=self.ui_bold_font, spacing3=5)
        self.analysis_text.tag_configure("suggestion_link", foreground=self.theme_manager.get_colors()["link_fg"], underline=True)
        self.analysis_text.tag_bind("suggestion_link", "<Enter>", lambda e: self.analysis_text.config(cursor="hand2"))
        self.analysis_text.tag_bind("suggestion_link", "<Leave>", lambda e: self.analysis_text.config(cursor="arrow"))
        self.analysis_text.insert(tk.END, "Purpose:\n", "header")
        self.analysis_text.insert(tk.END, f"{data.get('breakdown', 'N/A')}\n\n")
        self.analysis_text.insert(tk.END, "Suggestions:\n", "header")
        for i, sugg in enumerate(data.get("suggestions", [])):
            desc, fix_prompt, tag = sugg.get("description", "N/A"), sugg.get("fix_prompt", ""), f"sugg_{i}"
            self.analysis_text.insert(tk.END, f"• {desc}\n", ("suggestion_link", tag) if fix_prompt else ())
            if fix_prompt: self.suggestion_data[tag] = fix_prompt
        self.analysis_text.config(state=tk.DISABLED)

    def update_run_button_text(self):
        """Updates the text of the 'Run' button based on detected language."""
        lang = self.identified_language
        text_map = {"html": "Preview as HTML", "javascript": "Preview as HTML", "python": "Run in Terminal"}
        self.run_code_button.config(text=text_map.get(lang, "Run Code"))

    def run_dynamic_preview(self):
        """Runs or previews code based on its detected language."""
        code_content = self.code_text.get(1.0, tk.END)
        lang = self.identified_language
        if "python" in lang:
            self.run_python_script(code_content)
        elif "html" in lang or ("javascript" in lang and "react" not in lang):
            self.preview_as_html(code_content)
        else:
            messagebox.showinfo("Cannot Run Code", f"Direct execution for '{lang}' is not supported. Please analyze the code first or use the terminal manually.")

    def run_python_script(self, code):
        """Saves Python code to a temp file and executes it in the terminal."""
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding='utf-8') as f:
                f.write(code)
                script_path = f.name
            self.on_terminal_enter_command(f'python -u "{script_path}"')
        except Exception as e:
            self._write_to_terminal(f"\nERROR: Could not run script. {e}\n")

    def preview_as_html(self, code):
        """Saves HTML/JS code to a temp file and opens it in a browser."""
        try:
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding='utf-8') as f:
                f.write(code)
                html_path = f.name
            webbrowser.open_new_tab(f"file://{os.path.realpath(html_path)}")
            self._set_status(f"Opening preview in browser.", 4000)
        except Exception as e:
            self._set_status(f"HTML preview failed: {e}")

    def on_suggestion_click(self, event):
        """Handles clicks on actionable suggestions in the analysis panel."""
        index = self.analysis_text.index(f"@{event.x},{event.y}")
        for tag in self.analysis_text.tag_names(index):
            if tag.startswith("sugg_") and tag in self.suggestion_data:
                if messagebox.askyesno("Confirm Fix", f"Apply this fix?\n\n'{self.suggestion_data[tag]}'"):
                    self.trigger_fix(self.suggestion_data[tag])
                return

    def trigger_fix(self, fix_prompt):
        """Initiates a code fix by populating the chat and setting edit mode."""
        self.direct_edit_mode.set(True)
        self.chat_input_entry.delete(0, tk.END)
        self.chat_input_entry.insert(0, fix_prompt)
        self.send_chat_message()

    def send_chat_message(self):
        """Sends a message from the chat input to Gemini."""
        user_message = self.chat_input_entry.get().strip()
        if not user_message: return
        self._set_status("Sending message to Gemini...")
        self.chat_input_entry.delete(0, tk.END)
        self._update_scrolled_text(self.chat_output, f"> You: {user_message}\n\n", True)
        if self.direct_edit_mode.get():
            self.initiate_gemini_edit_session(user_message)
        else:
            threading.Thread(target=self._gemini_chat_thread, args=(user_message,), daemon=True).start()

    def _gemini_chat_thread(self, user_message):
        """Handles a standard chat conversation with Gemini."""
        prompt = (f"{self._get_project_context()}Code context:\n```\n{self.code_text.get(1.0, tk.END)[:1000]}\n```\n\nUser: {user_message}")
        try:
            response = gemini_model.generate_content(prompt)
            self._update_scrolled_text(self.chat_output, f"Gemini: {response.text}\n\n", True)
            self._set_status("Response received.", 5000)
        except Exception as e:
            self._update_scrolled_text(self.chat_output, f"ERROR: {e}\n\n", True)
            self._set_status("Chat error.")

    def initiate_gemini_edit_session(self, instruction):
        """Starts a direct code edit session with Gemini."""
        if self.original_code_before_edit is not None:
            return messagebox.showwarning("Busy", "An edit session is already active.")
        self.original_code_before_edit = self.code_text.get(1.0, tk.END)
        self._update_button_states()
        prompt = f"""{self._get_project_context()}You are a code modification engine. Your task is to modify the user's code based on their instruction.
Instruction: "{instruction}".
IMPORTANT: You must ONLY output the complete, modified code. Do not add any explanation, commentary, or markdown code fences like ```python.
Original Code:\n---\n{self.original_code_before_edit}\n---"""
        threading.Thread(target=self._gemini_direct_edit_thread, args=(prompt,), daemon=True).start()

    def _gemini_direct_edit_thread(self, prompt):
        """Handles the direct edit request in a background thread."""
        self._set_status("Gemini is editing the code...")
        try:
            response = gemini_model.generate_content(prompt, generation_config={"response_mime_type": "text/plain"})
            
            # BUGFIX: More robustly check for valid response text from the API.
            try:
                raw_code = response.text
            except (ValueError, AttributeError):
                raw_code = None

            if raw_code is None:
                self.root.after(0, messagebox.showerror, "AI Error", "Gemini did not return any code. This may be due to a safety policy violation or an API issue.")
                self.root.after(0, self.discard_gemini_changes)
                return

            cleaned_code = self._cleanup_ai_response(raw_code)
            self.root.after(0, self.highlight_changes, self.original_code_before_edit, cleaned_code)
            self._set_status("Review Gemini's suggested changes.")
        except Exception as e:
            self._set_status(f"Code edit failed: {e}")
            self.root.after(0, self.discard_gemini_changes)

    def highlight_changes(self, old_code, new_code):
        """Compares new code with old code and highlights the differences."""
        # BUGFIX: Add a guard clause to prevent crash if old_code or new_code is None.
        if old_code is None or new_code is None:
            self._set_status("Comparison failed: invalid code received from AI.", 5000)
            if new_code: # Still show the new code if we have it
                self._update_scrolled_text(self.code_text, new_code, append=False)
            self.root.after(0, self.discard_gemini_changes) # Clean up the session state
            return

        self._update_scrolled_text(self.code_text, new_code, append=False)
        self.code_text.tag_remove("gemini_change", "1.0", tk.END)
        
        matcher = difflib.SequenceMatcher(None, old_code.splitlines(), new_code.splitlines())
        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag in ['replace', 'insert']:
                start_index = f"{j1 + 1}.0"
                end_index = f"{j2}.end"
                self.code_text.tag_add("gemini_change", start_index, end_index)
        self._update_button_states()

    def apply_gemini_changes(self):
        """Accepts Gemini's code changes."""
        self.code_text.tag_remove("gemini_change", "1.0", tk.END)
        self.original_code_before_edit = None
        self._update_button_states()
        self._set_status("Changes applied.", 5000)
        self.direct_edit_mode.set(False)

    def discard_gemini_changes(self):
        """Reverts Gemini's code changes to the original code."""
        # BUGFIX: Make this function safe to call even if the state is already null.
        if self.original_code_before_edit is not None:
            self._update_scrolled_text(self.code_text, self.original_code_before_edit, False)
        
        self.original_code_before_edit = None
        if self.root.winfo_exists():
            self.code_text.tag_remove("gemini_change", "1.0", tk.END)
            self._update_button_states()
            self.direct_edit_mode.set(False)
        
        self._set_status("Changes discarded.", 5000)

    def fix_terminal_error(self):
        """Uses Gemini to fix a detected terminal error."""
        if not self.last_terminal_error:
            return messagebox.showinfo("Info", "No terminal error captured to fix.")
        self.trigger_fix(f"My code produced this error in the terminal: `{self.last_terminal_error}`. Fix the original code.")

    def generate_project_summary(self):
        """Starts a thread to generate a project summary."""
        threading.Thread(target=self._generate_summary_thread, args=(self.code_text.get(1.0, tk.END),), daemon=True).start()

    def _generate_summary_thread(self, code):
        """Handles summary generation in a background thread."""
        self._set_status("Generating project summary...")
        prompt = f"Analyze this code. Create a concise summary of its purpose, tech stack, and structure for a project README. Output only the summary in markdown format.\nCode:\n```{code}```"
        try:
            response = gemini_model.generate_content(prompt, generation_config={"response_mime_type": "text/plain"})
            self._update_scrolled_text(self.project_context_text, response.text, False)
            self._set_status("Project summary generated.", 5000)
        except Exception as e:
            self.root.after(0, messagebox.showerror, "Summary Error", f"{e}")
            self._set_status("Summary generation failed.")

    def push_to_gitlab(self):
        """Starts a thread to push the current code to GitLab."""
        threading.Thread(target=self._gitlab_push_thread, daemon=True).start()

    def _gitlab_push_thread(self):
        """Handles the GitLab push logic in a background thread."""
        content = self.code_text.get(1.0, tk.END)
        file_path = self.gitlab_file_path_var.get()
        branch = self.gitlab_branch_var.get()
        commit_msg = self.gitlab_commit_msg_var.get()
        if not all([file_path, branch, commit_msg]):
            self.root.after(0, messagebox.showwarning, "Input Needed", "Please fill all GitLab fields.")
            return

        self._set_status("Pushing to GitLab...")
        self.root.after(0, lambda: self.push_gitlab_button.config(state=tk.DISABLED))
        try:
            try:
                gitlab_project.branches.get(branch)
            except gitlab.exceptions.GitlabGetError:
                gitlab_project.branches.create({'branch': branch, 'ref': gitlab_project.default_branch})

            action = "Updated"
            data = {'branch': branch, 'commit_message': commit_msg, 'content': content}
            try:
                f = gitlab_project.files.get(file_path=file_path, ref=branch)
                f.content = content
                f.save(branch=branch, commit_message=commit_msg)
            except gitlab.exceptions.GitlabGetError:
                action="Created"
                gitlab_project.files.create({'file_path': file_path, **data})

            self.last_pushed_gitlab_url = f"{gitlab_project.web_url}/-/blob/{branch}/{file_path}"
            self.root.after(0, lambda: self.view_on_gitlab_button.config(state=tk.NORMAL))
            self._set_status(f"Success! {action} file on GitLab.", 7000)
        except Exception as e:
            self.root.after(0, messagebox.showerror, "GitLab Push Error", str(e))
            self._set_status("GitLab push failed.")
        finally:
             if self.root.winfo_exists():
                self.root.after(0, self._update_button_states)

    def view_on_gitlab(self):
        """Opens the last pushed file in a web browser."""
        if self.last_pushed_gitlab_url:
            webbrowser.open_new_tab(self.last_pushed_gitlab_url)
        else:
            messagebox.showinfo("Info", "No file has been pushed to GitLab in this session.")

    def generate_cicd_file(self):
        """Generates a .gitlab-ci.yml file using Gemini and places it in the editor."""
        if messagebox.askyesno("Confirm CI/CD Generation", "This will replace the content of your code editor with a generated .gitlab-ci.yml file. This is useful for starting a new project or adding CI to an existing one. Continue?"):
            threading.Thread(target=self._generate_cicd_thread, args=(self.code_text.get(1.0, tk.END), self.identified_language), daemon=True).start()

    def _generate_cicd_thread(self, code, lang):
        """Handles CI/CD file generation in a background thread."""
        self._set_status("Generating .gitlab-ci.yml with AI...")
        prompt = f"""{self._get_project_context()}Based on the provided project context and code (language: {lang}), create a complete and effective .gitlab-ci.yml file.
It should include stages for build, test, and deploy (with a placeholder deploy job).
Make smart assumptions for a standard project of this type. For a Python project, use a standard Python image, include a 'pip install -r requirements.txt' step, and add jobs for linting (e.g., flake8) and testing (e.g., pytest).
For a web project (HTML/JS), suggest a static analysis tool and a deployment to GitLab Pages.
IMPORTANT: Output ONLY the raw YAML content, with no explanations or markdown fences like ```yaml.
Code:\n```\n{code}\n```"""
        try:
            response = gemini_model.generate_content(prompt, generation_config={"response_mime_type": "text/plain"})
            cleaned_yaml = self._cleanup_ai_response(response.text)
            self._update_scrolled_text(self.code_text, cleaned_yaml, False)
            self._set_status("CI/CD file generated! Review and push to GitLab.", 7000)
            self.gitlab_file_path_var.set(".gitlab-ci.yml")
        except Exception as e:
            self.root.after(0, messagebox.showerror, "CI/CD Generation Error", str(e))
            self._set_status("CI/CD generation failed.")

    def manual_search_stackoverflow(self):
        """Performs a manual search of Stack Overflow."""
        query = self.so_search_entry.get().strip()
        if query:
            self._update_scrolled_text(self.so_results_text, f"Searching for: {query}...\n", False)
            threading.Thread(target=self._stackoverflow_search_thread, args=([query], True), daemon=True).start()

    def gemini_search_stackoverflow(self):
        """Uses Gemini to generate intelligent search queries for Stack Overflow."""
        self._set_status("Asking Gemini for relevant search topics...")
        code, context = self.code_text.get(1.0, tk.END), self._get_project_context()
        prompt = f"""{context}As an expert developer, analyze the following code. Identify key problems. Generate 2-3 relevant, concise search queries for Stack Overflow. Respond ONLY with a minified JSON like: {{"search_queries": ["query 1", "query 2"]}}. Code:\n```\n{code}\n```"""
        threading.Thread(target=self._gemini_get_so_queries_thread, args=(prompt,), daemon=True).start()

    def _gemini_get_so_queries_thread(self, prompt):
        """Handles getting SO queries from Gemini in a background thread."""
        try:
            response = gemini_model.generate_content(prompt)
            json_text = response.text[response.text.find('{'):response.text.rfind('}')+1]
            data = json.loads(json_text)
            if queries := data.get("search_queries", []):
                self._update_scrolled_text(self.so_results_text, f"Gemini suggests searching for:\n• " + "\n• ".join(queries) + "\n\nSearching...", False)
                threading.Thread(target=self._stackoverflow_search_thread, args=(queries, False), daemon=True).start()
        except (json.JSONDecodeError, AttributeError, ValueError) as e:
            self._set_status(f"Gemini SO query error: {e}", 5000)
            self._update_scrolled_text(self.so_results_text, f"Could not get suggestions from Gemini: {e}", False)

    def _stackoverflow_search_thread(self, queries, clear_first):
        """Performs the BigQuery search in a background thread."""
        self._set_status("Searching Stack Overflow on BigQuery...")
        all_results = []
        for term in queries:
            QUERY = """SELECT q.title, q.score, q.id as question_id, a.body as accepted_answer_body FROM `bigquery-public-data.stackoverflow.posts_questions` AS q JOIN `bigquery-public-data.stackoverflow.posts_answers` AS a ON q.accepted_answer_id = a.id WHERE SEARCH(q, @search_term) ORDER BY q.score DESC LIMIT 5;"""
            try:
                job_config=bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("search_term", "STRING", term)])
                query_job = bigquery_client.query(QUERY, job_config=job_config)
                all_results.extend(list(query_job.result()))
            except Exception as e:
                self.root.after(0, lambda term=term, e=e: self._update_scrolled_text(self.so_results_text, f"\nError searching for '{term}': {e}\n", True))
        self.root.after(0, self.render_so_results, all_results, clear_first)
        self._set_status("Stack Overflow search complete.", 5000)

    def render_so_results(self, results, clear):
        """Renders Stack Overflow search results in the UI."""
        self.so_results_text.config(state=tk.NORMAL)
        if clear:
            self.so_results_text.delete('1.0', tk.END)
            self.so_results_data.clear()

        unique_results = sorted(list({row.question_id: row for row in results}.values()), key=lambda r: r.score, reverse=True)
        colors = self.theme_manager.get_colors()
        self.so_results_text.tag_configure("title", font=self.ui_bold_font, spacing3=2)
        self.so_results_text.tag_configure("link", foreground=colors["link_fg"], underline=True)
        self.so_results_text.tag_bind("link", "<Enter>", lambda e: self.so_results_text.config(cursor="hand2"))
        self.so_results_text.tag_bind("link", "<Leave>", lambda e: self.so_results_text.config(cursor="arrow"))
        self.so_results_text.tag_configure("meta", foreground="gray", font=self.ui_font)
        self.so_results_text.tag_configure("answer", lmargin1=15, lmargin2=15, spacing1=5, spacing3=15)

        if not unique_results:
            if clear: self.so_results_text.insert(tk.END, "No results found.")
        else:
            if not clear and self.so_results_text.get('1.0', 'end-1c').strip():
                self.so_results_text.insert(tk.END, "\n--- Additional Results ---\n\n")
            for i, row in enumerate(unique_results):
                tag, url = f"so_{row.question_id}", f"https://stackoverflow.com/q/{row.question_id}"
                self.so_results_data[tag] = url
                self.so_results_text.insert(tk.END, f"{row.title}\n", ("title", "link", tag))
                self.so_results_text.insert(tk.END, f"Score: {row.score}\n", "meta")
                answer = row.accepted_answer_body.replace('<p>', '').replace('</p>', '\n').strip()
                self.so_results_text.insert(tk.END, f"{answer[:600].strip()}...\n\n", "answer")
        self.so_results_text.config(state=tk.DISABLED)

    def on_so_result_click(self, event):
        """Handles clicks on Stack Overflow result links."""
        index = self.so_results_text.index(f"@{event.x},{event.y}")
        for tag in self.so_results_text.tag_names(index):
            if tag.startswith("so_") and tag in self.so_results_data:
                webbrowser.open_new_tab(self.so_results_data[tag])
                return

if __name__ == "__main__":
    # Main execution block to start the application
    init_thread = threading.Thread(target=initialize_services, daemon=True)
    init_thread.start()
    root = tk.Tk()
    app = CodeWeaverApp(root)
    root.mainloop()