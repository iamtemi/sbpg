import React, { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { useTheme } from "@/components/theme-provider";

interface SchemaEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const SchemaEditor: React.FC<SchemaEditorProps> = ({
  value,
  onChange,
}) => {
  const { theme } = useTheme();
  const extensions = useMemo(() => [javascript({ typescript: true })], [theme]);

  return (
    <div className="h-full w-full overflow-auto overscroll-none">
      <CodeMirror
        value={value}
        height="100%"
        extensions={extensions}
        theme={theme === "dark" ? "dark" : "light"}
        onChange={onChange}
        className="h-full"
      />
    </div>
  );
};
