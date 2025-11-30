import React, { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "./theme-provider";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "pydantic" | "typescript";
  isLoading?: boolean;
}

const LoadingSpinner: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center z-10">
    <div className="flex items-center gap-3 text-sm">
      <svg
        className="animate-spin h-5 w-5"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <span>Converting...</span>
    </div>
  </div>
);

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = "typescript",
  isLoading = false,
}) => {
  const { theme } = useTheme();

  // Resolve system theme to actual theme
  const resolvedTheme = useMemo(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme;
  }, [theme]);

  const extensions = useMemo(
    () => [
      language === "pydantic" ? python() : javascript({ typescript: true }),
      ...(resolvedTheme === "dark" ? [oneDark] : []),
    ],
    [language, resolvedTheme]
  );

  const isEditable = onChange !== undefined;

  return (
    <div className={`h-full w-full overflow-auto overscroll-none ${isLoading ? "relative" : ""}`}>
      {isLoading && <LoadingSpinner />}
      <CodeMirror
        value={value}
        height="100%"
        extensions={extensions}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={onChange}
        editable={isEditable}
        className="h-full"
      />
    </div>
  );
};

