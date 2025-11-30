import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "./useDebounce";

interface ConvertResponse {
  output: string;
  error?: string;
}

const convertSchema = async (
  schemaCode: string,
  targetLanguage: "pydantic" | "typescript",
  zodVersion: "3" | "4",
  signal?: AbortSignal
): Promise<ConvertResponse> => {
  const response = await fetch("/api/convert", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      schemaCode,
      targetLanguage,
      zodVersion,
    }),
    signal,
  });

  let data;
  try {
    data = await response.json();
  } catch (parseError) {
    // If JSON parsing fails, it might be an incomplete response
    // TanStack Query will handle cancellation, so this is likely a real error
    throw new Error("Invalid response from server");
  }

  if (!response.ok) {
    throw new Error(data.error || "Conversion failed");
  }

  return { output: data.output };
};

export const useSchemaConversion = (
  schemaCode: string,
  targetLanguage: "pydantic" | "typescript",
  zodVersion: "3" | "4"
) => {
  // Debounce schema code changes (reduced from 500ms to 250ms for better responsiveness)
  const debouncedSchemaCode = useDebounce(schemaCode, 250);
  // Debounce target language changes (reduced from 300ms to 100ms for dropdowns)
  const debouncedTargetLanguage = useDebounce(targetLanguage, 100);
  // Debounce zod version changes (reduced from 300ms to 100ms for dropdowns)
  const debouncedZodVersion = useDebounce(zodVersion, 100);

  const { data, error, isFetching } = useQuery<ConvertResponse, Error>({
    queryKey: [
      "convert",
      debouncedSchemaCode,
      debouncedTargetLanguage,
      debouncedZodVersion,
    ],
    queryFn: ({ signal }) =>
      convertSchema(
        debouncedSchemaCode,
        debouncedTargetLanguage,
        debouncedZodVersion,
        signal
      ),
    enabled: debouncedSchemaCode.length > 0,
    // Keep previous data while fetching new data (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
    // Only show errors for the current query, not stale ones
    retry: false,
  });

  // Only show error if it's from the current query (not a cancelled/stale one)
  // TanStack Query automatically handles this, but we ensure error is current
  const displayError = error instanceof Error ? error.message : null;

  return {
    output: data?.output || "",
    error: displayError,
    isConverting: isFetching,
  };
};
