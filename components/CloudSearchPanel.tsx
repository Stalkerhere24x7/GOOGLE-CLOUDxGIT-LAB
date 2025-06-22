
import React, { useState } from 'react';
import { Button } from './common/Button';
import { TextInput } from './common/TextInput';
import { GoogleGenAI, GenerateContentResponse, GroundingChunk } from '@google/genai';
import { SearchResult } from '../types'; 
import { GEMINI_MODEL_TEXT, STACKOVERFLOW_BASE_URL } from '../constants';
import { extractJsonFromText } from '../utils/textUtils';

interface CloudSearchPanelProps {
  ai: GoogleGenAI | null;
  currentCode: string;
  projectContext: string;
  results: SearchResult[];
  setResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  updateStatusBar: (message: string, duration?: number) => void;
  setLoadingState: (key: string, value: boolean) => void;
  isLoading: boolean; // This will be true if 'cloud_search_so' or 'cloud_search_docs' is true
}

export const CloudSearchPanel: React.FC<CloudSearchPanelProps> = ({
  ai,
  currentCode,
  projectContext,
  results,
  setResults,
  updateStatusBar,
  setLoadingState,
  isLoading, // Generic isLoading passed from App.tsx (true if any cloud_search_* is loading)
}) => {
  const [manualQuery, setManualQuery] = useState('');
  // Specific loading states for buttons if needed, though App.tsx manages them with keys
  const [isSoLoading, setIsSoLoading] = useState(false);
  const [isDocsLoading, setIsDocsLoading] = useState(false);


  const handleManualStackOverflowSearch = () => {
    if (!manualQuery.trim()) return;
    updateStatusBar(`Searching Stack Overflow for: ${manualQuery}...`, 3000);
    const searchUrl = `${STACKOVERFLOW_BASE_URL}/search?q=${encodeURIComponent(manualQuery)}`;
    
    const newResult: SearchResult = {
      id: `manual-so-${Date.now()}`,
      title: `Stack Overflow Search: "${manualQuery}"`,
      link: searchUrl,
      summary: "Click to search on Stack Overflow. Results will open in a new tab.",
      type: 'stackoverflow',
      source: 'Stack Overflow (Manual Search)',
    };
    setResults(prevResults => [newResult, ...prevResults].slice(0, 50)); // Keep results list manageable
    window.open(searchUrl, '_blank');
  };

  const handleGeminiStackOverflowSearch = async () => {
    if (!ai) return;
    setLoadingState('cloud_search_so', true);
    setIsSoLoading(true);
    updateStatusBar('AI: Finding Stack Overflow solutions...', 0);
    
    const query = manualQuery.trim() || "issues in the current code"; // Use manual query if present
    const prompt = `Based on the following query, project context, and code, find relevant Stack Overflow questions and provide their direct URLs.
Prioritize questions with accepted answers.
If the query is "issues in the current code", analyze the provided code for potential problems.
Format your response as a minified JSON array: [{"title": "Question Title", "url": "https://stackoverflow.com/questions/ID/slug", "brief_summary_of_accepted_answer": "A short summary of the solution if available"}].
Query: ${query}
Project Context: ${projectContext}
Code (first 500 chars):\n\`\`\`\n${currentCode.substring(0,500)}\n\`\`\``;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}], 
        }
      });
      
      let foundResults: SearchResult[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const parsedJson = extractJsonFromText(response.text);

      if (parsedJson && Array.isArray(parsedJson)) {
        foundResults = parsedJson.map((item: any, index: number): SearchResult => ({
          id: item.url || `gemini-so-${Date.now()}-${index}`,
          title: item.title || "Gemini Suggested Stack Overflow Result",
          link: item.url || STACKOVERFLOW_BASE_URL, // Fallback link
          summary: item.brief_summary_of_accepted_answer || "View on Stack Overflow for details.",
          type: 'stackoverflow',
          source: 'Stack Overflow (via AI + Google Search)',
          groundingChunks: [],
        }));
      }
      
      if (groundingChunks && groundingChunks.length > 0) {
        const groundingResults: SearchResult[] = groundingChunks
          .map((chunk: GroundingChunk, index: number): SearchResult | null => {
            const webInfo = chunk.web || chunk.retrievedContext;
            if (webInfo && webInfo.uri && webInfo.uri.includes('stackoverflow.com/questions/')) {
              return {
                id: `grounding-so-${webInfo.uri.split('/')[4] || Date.now()}-${index}`,
                title: webInfo.title || "Stack Overflow (from Google Search)",
                link: webInfo.uri,
                summary: "Relevant link found via Google Search grounding.",
                type: 'stackoverflow',
                source: 'Stack Overflow (via Google Search)',
                groundingChunks: [chunk]
              };
            }
            return null;
          })
          .filter((item): item is SearchResult => item !== null);
          
        const combined = [...foundResults, ...groundingResults];
        const uniqueResultsMap = new Map<string, SearchResult>();
        combined.forEach(res => {
          if (res.link && !uniqueResultsMap.has(res.link)) { // Prioritize results with links
            uniqueResultsMap.set(res.link, res);
          } else if (!res.link && !uniqueResultsMap.has(res.id)) { // Fallback to ID for uniqueness if no link
             uniqueResultsMap.set(res.id, res);
          }
        });
        foundResults = Array.from(uniqueResultsMap.values());
      }

      if (foundResults.length > 0) {
        setResults(prevResults => [...foundResults, ...prevResults].slice(0,50));
        updateStatusBar(`AI found ${foundResults.length} potential Stack Overflow solutions.`, 3000);
      } else {
        const fallbackResult: SearchResult = {
            id: `no-so-found-${Date.now()}`, 
            title: "No Specific SO links found by AI for this query", 
            summary: "Try rephrasing or a manual search.", 
            type: 'stackoverflow', 
            source:'AI Search'
        };
        setResults(prevResults => [fallbackResult, ...prevResults].slice(0,50));
        updateStatusBar('AI could not find specific Stack Overflow links for this query. Try a broader query or manual search.', 3000);
      }

    } catch (error: any) {
      console.error("Error with Gemini SO search:", error);
      updateStatusBar(`Error during AI Stack Overflow search: ${error.message}`, 5000);
    } finally {
      setLoadingState('cloud_search_so', false);
      setIsSoLoading(false);
    }
  };

  const handleGeminiDocumentationSearch = async () => {
    if (!ai) return;
    setLoadingState('cloud_search_docs', true);
    setIsDocsLoading(true);
    updateStatusBar('AI: Searching technical documentation (simulated)...', 0);

    const query = manualQuery.trim() || "help with current code functionality or issues";
    const prompt = `You are an expert technical assistant. Imagine you have access to a vast datastore of technical documentation (like Vertex AI Search over API docs, guides, and tutorials for many languages/frameworks).
Based on the user's query, current code, and project context, provide a concise and helpful answer as if retrieved from this documentation datastore.
Focus on providing explanations, code examples, or troubleshooting steps.
If the query is generic (e.g., "help with current code"), analyze the code and identify an area to explain or provide documentation for.
Format your response as a minified JSON object: {"title": "Relevant Documentation Snippet Title", "summary": "Detailed explanation, code example, or steps. Use markdown for code blocks if relevant."}.
Do NOT use external search tools for this; generate the content based on your knowledge.

User Query: ${query}
Project Context: ${projectContext}
Current Code (first 500 chars):\n\`\`\`\n${currentCode.substring(0,500)}\n\`\`\``;

    try {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL_TEXT,
        contents: prompt,
      });

      const parsedJson = extractJsonFromText(response.text) as {title: string; summary: string} | null;

      if (parsedJson && parsedJson.title && parsedJson.summary) {
        const newResult: SearchResult = {
          id: `gemini-doc-${Date.now()}`,
          title: parsedJson.title,
          summary: parsedJson.summary,
          type: 'documentation',
          source: 'Simulated Technical Documentation (via AI)',
        };
        setResults(prevResults => [newResult, ...prevResults].slice(0,50));
        updateStatusBar('AI provided a documentation snippet.', 3000);
      } else {
        const fallbackResult: SearchResult = {
            id: `no-doc-found-${Date.now()}`, 
            title: "No specific documentation snippet generated by AI", 
            summary: "The AI could not generate a specific documentation snippet for this query. Try rephrasing.", 
            type: 'documentation', 
            source:'AI Search'
        };
        setResults(prevResults => [fallbackResult, ...prevResults].slice(0,50));
        updateStatusBar('AI could not generate a documentation snippet for this query.', 3000);
      }

    } catch (error: any) {
      console.error("Error with Gemini documentation search:", error);
      updateStatusBar(`Error during AI documentation search: ${error.message}`, 5000);
    } finally {
      setLoadingState('cloud_search_docs', false);
      setIsDocsLoading(false);
    }
  };


  return (
    <div className="p-1 space-y-4">
      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">Cloud Search</h3>
        <div className="space-y-2 mb-3">
          <TextInput
            type="text"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="Enter query for AI search or manual SO search..."
            className="flex-1 text-sm !bg-light-input_bg dark:!bg-dark-input_bg !text-light-fg dark:!text-dark-fg"
            aria-label="Cloud search query input"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Button 
                onClick={handleGeminiStackOverflowSearch} 
                isLoading={isSoLoading} 
                size="sm" 
                variant="secondary" 
                className="w-full"
                icon={<i className="ph-stack-overflow-logo ph-fill"></i>}
                disabled={!ai}
            >
              AI: Find SO Solutions
            </Button>
            <Button 
                onClick={handleGeminiDocumentationSearch} 
                isLoading={isDocsLoading} 
                size="sm" 
                variant="secondary" 
                className="w-full"
                icon={<i className="ph-book-open-text ph-fill"></i>}
                disabled={!ai}
            >
              AI: Search Tech Docs
            </Button>
          </div>
           <Button onClick={handleManualStackOverflowSearch} size="sm" variant="secondary" className="w-full mt-2" icon={<i className="ph-magnifying-glass ph-fill"></i>}>
              Manual Stack Overflow Search
            </Button>
        </div>
      </section>

      <section>
        <h3 className="text-md font-semibold mb-2 text-light-fg dark:text-dark-fg">Results</h3>
        {(results.length === 0 && !isLoading) && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No results to display. Try a search.</p>
        )}
        {isLoading && <p className="text-sm text-gray-500 dark:text-gray-400" aria-live="polite">Loading results...</p>}
        
        <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto pr-1"> {/* Adjusted max height & padding */}
          {results.map((result) => (
            <div key={result.id} className="p-3 border border-light-border dark:border-dark-border rounded-md bg-light-bg dark:bg-dark-bg hover:shadow-lg transition-shadow">
              <h4 className="text-sm font-semibold text-light-accent dark:text-dark-accent mb-1">
                {result.title}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                Source: {result.source} {result.type === 'stackoverflow' && result.link && result.score ? `(Score: ${result.score})` : ''}
              </p>
              <div className="text-xs text-light-fg dark:text-dark-fg whitespace-pre-wrap prose prose-sm dark:prose-invert max-w-none">
                {result.summary.split(/(```[\s\S]*?```|`[^`]+`)/g).map((part, index) => {
                  if (part.startsWith('```') && part.endsWith('```')) {
                    const lang = part.match(/^```(\w*)\n?/)?.[1] || '';
                    const codeContent = part.replace(/^```\w*\n?/, '').replace(/\n?```$/, '');
                    return (
                      <pre key={index} className="bg-light-input_bg dark:bg-dark-input_bg p-2 rounded overflow-x-auto my-1 text-xs">
                        <code className={lang ? `language-${lang}` : ''}>{codeContent}</code>
                      </pre>
                    );
                  }
                  if (part.startsWith('`') && part.endsWith('`')) {
                     return <code key={index} className="bg-light-select_bg dark:bg-dark-select_bg px-1 py-0.5 rounded text-xs">{part.slice(1,-1)}</code>;
                  }
                  return <span key={index}>{part}</span>;
                })}
              </div>
              {result.link && (
                <a
                  href={result.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 text-xs text-light-link_fg dark:text-dark-link_fg hover:underline block"
                >
                  View Original {result.type === 'stackoverflow' ? 'on Stack Overflow' : 'Source'} <i className="ph-arrow-square-out ml-1"></i>
                </a>
              )}
              {result.groundingChunks && result.groundingChunks.length > 0 && (
                <div className="mt-1">
                  <p className="text-xs font-semibold">Grounded Sources:</p>
                  <ul className="list-disc list-inside">
                  {result.groundingChunks.map((chunk, idx) => (
                    (chunk.web || chunk.retrievedContext) && (chunk.web?.uri || chunk.retrievedContext?.uri) && (
                      <li key={idx} className="text-xs">
                        <a 
                          href={(chunk.web || chunk.retrievedContext)?.uri} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-light-link_fg dark:text-dark-link_fg hover:underline"
                        >
                          {(chunk.web || chunk.retrievedContext)?.title || (chunk.web || chunk.retrievedContext)?.uri}
                        </a>
                      </li>
                    )
                  ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};