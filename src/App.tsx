import { useState } from "react";
import { SchemaEditor } from "./components/schema-editor";
import { OutputViewer } from "./components/output-viewer";
import { useSchemaConversion } from "./hooks/useSchemaConversion";
import {
  DEFAULT_SCHEMA_V4,
  getDefaultSchema,
  isDefaultSchema,
} from "./utils/defaultSchema";
import { ThemeProvider, useTheme } from "./components/theme-provider";
import "./index.css";
import { CircleX, MoonIcon, SunIcon } from "lucide-react";
import { Footer } from "@/components/footer";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      aria-label="Toggle theme"
      className=""
    >
      {theme === "light" ? (
        <MoonIcon className="w-4 h-4" />
      ) : (
        <SunIcon className="w-4 h-4" />
      )}
    </button>
  );
}

function AppContent() {
  const [schemaCode, setSchemaCode] = useState(DEFAULT_SCHEMA_V4);
  const [targetLanguage, setTargetLanguage] = useState<
    "pydantic" | "typescript"
  >("pydantic");
  const [zodVersion, setZodVersion] = useState<"3" | "4">("4");

  const handleVersionChange = (newVersion: "3" | "4") => {
    // If current schema is still a default, switch to appropriate default
    if (isDefaultSchema(schemaCode)) {
      setSchemaCode(getDefaultSchema(newVersion));
    }
    setZodVersion(newVersion);
  };

  const {
    output,
    error: conversionError,
    isConverting,
  } = useSchemaConversion(schemaCode, targetLanguage, zodVersion);

  return (
    <div className="h-screen flex flex-col font-sans overscroll-none">
      {/* Header */}
      <header className="border-b flex-shrink-0">
        <div className="max-w-full mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">SchemaBridge</h1>
            <p className="text-sm mt-1">
              A developer-focused playground for schema conversion
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Error Display */}
      {/* {conversionError && (
        <div className="flex-shrink-0 flex items-center border-l-4 px-4 py-2 border-red-500 bg-red-50">
          <CircleX className="w-4 h-4 text-red-500 mr-1" />
          <p className="font-semibold text-sm text-red-800 mr-1">Error: </p>
          <p className="text-sm text-red-500 italic truncate">
            {conversionError ||
              "There are so many errors in this schema that i can't even count them"}
          </p>
        </div>
      )} */}

      {/* Two-panel layout - side by side */}
      <div className="grid grid-cols-2 gap-0 divide-x w-full flex-1 min-h-0">
        {/* Left Panel: Schema Editor */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex-shrink-0 flex justify-between items-center px-4 py-1 border-b">
            <h2 className="uppercase tracking-wider text-sm font-medium">
              Input
            </h2>
            <div className="flex items-center gap-2">
              <label
                htmlFor="zodVersion"
                className="text-sm font-medium whitespace-nowrap"
              >
                Zod Version
              </label>
              <select
                value={zodVersion}
                onChange={(e) =>
                  handleVersionChange(e.target.value as "3" | "4")
                }
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="3">v3</option>
                <option value="4">v4</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <SchemaEditor value={schemaCode} onChange={setSchemaCode} />
          </div>
        </div>
        {/* Right Panel: Output Viewer */}
        <div className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex-shrink-0 flex justify-between items-center px-4 py-1 border-b">
            <h2 className="uppercase tracking-wider text-sm font-medium">
              Generated Output
            </h2>
            <div className="flex items-center gap-2">
              <label
                htmlFor="zodVersion"
                className="text-sm font-medium whitespace-nowrap"
              >
                Target Language
              </label>
              <select
                value={targetLanguage}
                onChange={(e) =>
                  setTargetLanguage(e.target.value as "pydantic" | "typescript")
                }
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="pydantic">Pydantic (Python)</option>
                <option value="typescript">TypeScript</option>
              </select>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <OutputViewer
              value={output}
              language={targetLanguage}
              isLoading={isConverting}
            />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
