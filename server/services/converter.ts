import { writeFile, mkdir, symlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { loadZodSchema, convertZodToPydantic, convertZodToTypescript } from 'schemabridge';
import ts from 'typescript';

// Detect all Zod schemas (both exported and non-exported)
function detectAllZodSchemas(schemaCode: string): { exported: string[]; nonExported: string[] } {
  const exportedRegex = /export\s+const\s+(\w+)\s*=\s*z\./g;
  const allRegex = /const\s+(\w+)\s*=\s*z\./g;
  
  const exportedMatches = Array.from(schemaCode.matchAll(exportedRegex));
  const allMatches = Array.from(schemaCode.matchAll(allRegex));
  
  const exported = exportedMatches.map(match => match[1]);
  const all = allMatches.map(match => match[1]);
  const nonExported = all.filter(name => !exported.includes(name));
  
  return { exported, nonExported };
}

// Get comment prefix based on target language
function getCommentPrefix(language: 'pydantic' | 'typescript'): string {
  return language === 'pydantic' ? '#' : '//';
}

// Extract import statements from Python output
function extractPythonImports(output: string): { imports: string[]; body: string } {
  const lines = output.split('\n');
  const imports: string[] = [];
  const bodyLines: string[] = [];
  let inImports = true;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match Python import patterns: "from X import Y" or "import X"
    if (inImports && (trimmed.startsWith('from ') || trimmed.startsWith('import '))) {
      imports.push(line);
    } else {
      inImports = false;
      bodyLines.push(line);
    }
  }
  
  return {
    imports,
    body: bodyLines.join('\n').trim()
  };
}

// Extract import statements from TypeScript output
function extractTypeScriptImports(output: string): { imports: string[]; body: string } {
  const lines = output.split('\n');
  const imports: string[] = [];
  const bodyLines: string[] = [];
  let inImports = true;
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Match TypeScript import patterns: "import ... from ..." or "import ..."
    if (inImports && trimmed.startsWith('import ')) {
      imports.push(line);
    } else {
      inImports = false;
      bodyLines.push(line);
    }
  }
  
  return {
    imports,
    body: bodyLines.join('\n').trim()
  };
}

// Merge and deduplicate imports from the same module
function mergeImports(importArrays: string[][], language: 'pydantic' | 'typescript'): string[] {
  if (language === 'pydantic') {
    return mergePythonImports(importArrays);
  } else {
    return mergeTypeScriptImports(importArrays);
  }
}

function mergePythonImports(importArrays: string[][]): string[] {
  // Map to store imports by module: { module: Set<importedItems> }
  const importsByModule = new Map<string, Set<string>>();
  const standaloneImports = new Set<string>(); // For "import X" statements
  
  for (const imports of importArrays) {
    for (const importLine of imports) {
      const trimmed = importLine.trim();
      
      // Match "from X import Y" pattern
      const fromMatch = trimmed.match(/^from\s+(\S+)\s+import\s+(.+)$/);
      if (fromMatch) {
        const [, module, items] = fromMatch;
        if (!importsByModule.has(module)) {
          importsByModule.set(module, new Set());
        }
        // Split items by comma and add each to the set
        const itemList = items.split(',').map(item => item.trim());
        itemList.forEach(item => importsByModule.get(module)!.add(item));
        continue;
      }
      
      // Match "import X" pattern - keep these as standalone imports
      const importMatch = trimmed.match(/^import\s+(.+)$/);
      if (importMatch) {
        standaloneImports.add(trimmed);
        continue;
      }
    }
  }
  
  // Convert merged imports back to strings
  const mergedImports: string[] = [];
  
  // Sort modules for consistent output
  const sortedModules = Array.from(importsByModule.keys()).sort();
  
  for (const module of sortedModules) {
    const items = Array.from(importsByModule.get(module)!).sort();
    if (items.length > 0) {
      mergedImports.push(`from ${module} import ${items.join(', ')}`);
    }
  }
  
  // Add standalone import statements (sorted for consistency)
  const sortedStandalone = Array.from(standaloneImports).sort();
  mergedImports.push(...sortedStandalone);
  
  return mergedImports;
}

function mergeTypeScriptImports(importArrays: string[][]): string[] {
  // For TypeScript, we'll keep imports as-is but deduplicate exact matches
  const seen = new Set<string>();
  const merged: string[] = [];
  
  for (const imports of importArrays) {
    for (const importLine of imports) {
      const trimmed = importLine.trim();
      if (!seen.has(trimmed)) {
        seen.add(trimmed);
        merged.push(importLine);
      }
    }
  }
  
  return merged;
}

// Extract enum class definitions from Python output
function extractPythonEnums(body: string): { enums: Map<string, string>; bodyWithoutEnums: string } {
  const enumMap = new Map<string, string>(); // key: enum values signature, value: enum definition
  const lines = body.split('\n');
  const bodyLines: string[] = [];
  let currentEnum: string[] | null = null;
  let enumIndent = 0;
  let enumSignature = '';
  let inEnum = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const currentIndent = line.length - line.trimStart().length;
    
    // Match enum class definition: "class XEnum(str, Enum):"
    const enumMatch = trimmed.match(/^class\s+(\w+Enum)\(str,\s*Enum\):/);
    if (enumMatch) {
      // Save previous enum if exists
      if (currentEnum !== null && enumSignature) {
        const enumDef = currentEnum.join('\n');
        if (!enumMap.has(enumSignature)) {
          enumMap.set(enumSignature, enumDef);
        }
      }
      
      // Start new enum
      currentEnum = [line];
      enumIndent = currentIndent;
      enumSignature = '';
      inEnum = true;
      continue;
    }
    
    // If we're inside an enum block
    if (inEnum && currentEnum !== null) {
      // Check if we've left the enum block (non-empty line with less or equal indent that's not part of enum)
      if (trimmed !== '' && currentIndent <= enumIndent && !trimmed.match(/^\w+\s*=\s*"/)) {
        // We've left the enum block
        if (enumSignature) {
          const enumDef = currentEnum.join('\n');
          if (!enumMap.has(enumSignature)) {
            enumMap.set(enumSignature, enumDef);
          }
        }
        currentEnum = null;
        inEnum = false;
        bodyLines.push(line);
      } else {
        // Still in enum block
        currentEnum.push(line);
        
        // Extract enum values for signature
        const valueMatch = trimmed.match(/^(\w+)\s*=\s*"([^"]+)"/);
        if (valueMatch) {
          if (enumSignature) enumSignature += ',';
          enumSignature += valueMatch[2];
        }
      }
    } else {
      bodyLines.push(line);
    }
  }
  
  // Don't forget the last enum if exists
  if (currentEnum !== null && enumSignature) {
    const enumDef = currentEnum.join('\n');
    if (!enumMap.has(enumSignature)) {
      enumMap.set(enumSignature, enumDef);
    }
  }
  
  return {
    enums: enumMap,
    bodyWithoutEnums: bodyLines.join('\n').trim()
  };
}

// Extract enum definitions from TypeScript output (if any)
function extractTypeScriptEnums(body: string): { enums: Map<string, string>; bodyWithoutEnums: string } {
  // TypeScript enums are less common in this context, but we'll handle them
  const enumMap = new Map<string, string>();
  const lines = body.split('\n');
  const bodyLines: string[] = [];
  let currentEnum: string[] | null = null;
  let enumSignature = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Match TypeScript enum: "enum X { ... }"
    const enumMatch = trimmed.match(/^enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      if (currentEnum !== null && enumSignature) {
        const enumDef = currentEnum.join('\n');
        if (!enumMap.has(enumSignature)) {
          enumMap.set(enumSignature, enumDef);
        }
      }
      currentEnum = [line];
      enumSignature = '';
      continue;
    }
    
    if (currentEnum !== null) {
      currentEnum.push(line);
      
      // Check if enum block ended
      if (trimmed === '}') {
        if (enumSignature) {
          const enumDef = currentEnum.join('\n');
          if (!enumMap.has(enumSignature)) {
            enumMap.set(enumSignature, enumDef);
          }
        }
        currentEnum = null;
      } else {
        // Extract enum values for signature
        const valueMatch = trimmed.match(/^\s*(\w+)\s*=\s*"([^"]+)"/);
        if (valueMatch) {
          if (enumSignature) enumSignature += ',';
          enumSignature += valueMatch[2];
        }
      }
    } else {
      bodyLines.push(line);
    }
  }
  
  if (currentEnum !== null && enumSignature) {
    const enumDef = currentEnum.join('\n');
    if (!enumMap.has(enumSignature)) {
      enumMap.set(enumSignature, enumDef);
    }
  }
  
  return {
    enums: enumMap,
    bodyWithoutEnums: bodyLines.join('\n').trim()
  };
}

// Format conversion errors to be user-friendly
function formatConversionError(exportName: string, error: unknown, language: 'pydantic' | 'typescript'): string {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const commentPrefix = getCommentPrefix(language);

  // Pattern 1: "z.something is not a function"
  const notFunctionMatch = errorMessage.match(/z\.(\w+) is not a function/);
  if (notFunctionMatch) {
    const method = notFunctionMatch[1];
    return `${commentPrefix} Invalid Zod method 'z.${method}()' in schema '${exportName}'. This method may not exist in the selected Zod version. Check the Zod documentation for valid methods.`;
  }

  // Pattern 2: "Failed to import schema module" - strip temp path
  const importFailMatch = errorMessage.match(/Failed to import schema module "([^"]+)": (.+)/);
  if (importFailMatch) {
    const actualError = importFailMatch[2];
    return `${commentPrefix} Failed to load schema '${exportName}': ${actualError}`;
  }

  // Pattern 3: Generic parsing errors - make more readable
  const cleanError = errorMessage
    .replace(/\/var\/folders\/[^\s]+\/schema\.(ts|mjs)/g, 'schema file')
    .replace(/import_zod\./g, '');

  return `${commentPrefix} Error in schema '${exportName}': ${cleanError}`;
}

// Find the nearest node_modules to support running from dist/ or repo root
function findNodeModulesRoot(): string {
  const override = process.env.SCHEMABRIDGE_MODULE_ROOT;
  if (override && existsSync(join(override, 'node_modules'))) {
    return override;
  }

  const startDirs = [
    process.cwd(),
    dirname(fileURLToPath(new URL('.', import.meta.url))),
  ];

  for (const startDir of startDirs) {
    let dir = startDir;
    while (true) {
      if (existsSync(join(dir, 'node_modules'))) {
        return dir;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  throw new Error('Could not locate node_modules. Set SCHEMABRIDGE_MODULE_ROOT to override.');
}

export async function convertZodSchema(
  schemaCode: string,
  targetLanguage: 'pydantic' | 'typescript',
  zodVersion: '3' | '4'
): Promise<{ output?: string; error?: string }> {
  const moduleRoot = findNodeModulesRoot();

  // Create a dedicated temp directory for this conversion
  const tempDir = join(tmpdir(), `sb-playground-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const tempFile = join(tempDir, 'schema.mjs');
  const zodLink = join(tempDir, 'node_modules', 'zod');
  const zodVersionPath = join(moduleRoot, 'node_modules', `zod-v${zodVersion}`);

  try {
    // Auto-detect exported Zod schemas and all schemas (for unhandled detection)
    const { exported: exportNames, nonExported } = detectAllZodSchemas(schemaCode);

    if (exportNames.length === 0) {
      return {
        error: 'No Zod schema exports found. Make sure to export your schemas with: export const schemaName = z.object(...)'
      };
    }

    // Limit to max 10 exports
    if (exportNames.length > 10) {
      return {
        error: `Too many schema exports. Maximum 10 schemas allowed, found ${exportNames.length}.`
      };
    }

    // Create temp directory
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Create node_modules directory in temp
    const tempNodeModules = join(tempDir, 'node_modules');
    if (!existsSync(tempNodeModules)) {
      await mkdir(tempNodeModules, { recursive: true });
    }

    // Verify target Zod version exists and create a symlink inside the temp dir
    if (!existsSync(zodVersionPath)) {
      return { error: `Zod v${zodVersion} is not installed at ${zodVersionPath}` };
    }

    if (!existsSync(zodLink)) {
      await symlink(zodVersionPath, zodLink, 'dir');
    }

    // Transpile TS (if any) to plain ESM JS so imports work without a runtime loader
    const transpiled = ts.transpileModule(schemaCode, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        jsx: ts.JsxEmit.Preserve,
      },
      fileName: 'schema.ts',
      reportDiagnostics: false,
    });

    await writeFile(tempFile, transpiled.outputText, 'utf-8');

    // Convert all detected schemas
    const allImports: string[][] = [];
    const allEnums = new Map<string, string>(); // key: enum signature, value: enum definition
    const bodyOutputs: string[] = [];

    for (const exportName of exportNames) {
      try {
        // Load the Zod schema
        const { schema, warnings } = await loadZodSchema({
          file: tempFile,
          exportName: exportName,
          registerTsLoader: false,
          allowUnresolved: false,
        });

        if (warnings && warnings.length > 0) {
          console.warn(`Warnings for ${exportName}:`, warnings);
        }

        // Convert based on target language
        let output: string;
        if (targetLanguage === 'pydantic') {
          output = convertZodToPydantic(schema, {
            name: exportName,
            enumStyle: 'enum',
            enumBaseType: 'str',
          });
        } else {
          output = convertZodToTypescript(schema, {
            name: exportName
          });
        }

        // Extract imports and body from the output
        const { imports, body } = targetLanguage === 'pydantic' 
          ? extractPythonImports(output)
          : extractTypeScriptImports(output);
        
        allImports.push(imports);
        
        // Extract enums from body and merge them
        const { enums, bodyWithoutEnums } = targetLanguage === 'pydantic'
          ? extractPythonEnums(body)
          : extractTypeScriptEnums(body);
        
        // Merge enums into the global map (deduplication happens here)
        for (const [enumSig, enumDef] of enums.entries()) {
          if (!allEnums.has(enumSig)) {
            allEnums.set(enumSig, enumDef);
          }
        }
        
        bodyOutputs.push(bodyWithoutEnums);
      } catch (err) {
        console.error(`Error converting ${exportName}:`, err);
        // Continue with other schemas even if one fails
        const userFriendlyError = formatConversionError(exportName, err, targetLanguage);
        bodyOutputs.push(userFriendlyError);
        allImports.push([]); // No imports for error messages
      }
    }

    // Merge all imports and place at the top
    const mergedImports = mergeImports(allImports, targetLanguage);
    const importsSection = mergedImports.length > 0 ? mergedImports.join('\n') + '\n' : '';
    
    // Combine unique enum definitions
    const enumSection = allEnums.size > 0 
      ? Array.from(allEnums.values()).join('\n\n') + '\n\n'
      : '';
    
    // Combine body outputs
    const bodySection = bodyOutputs.join('\n\n');
    
    // Add comment about unhandled schemas if any
    let unhandledComment = '';
    if (nonExported.length > 0) {
      const commentPrefix = getCommentPrefix(targetLanguage);
      const schemaList = nonExported.join(', ');
      unhandledComment = `\n\n${commentPrefix} Note: The following Zod schemas were detected but not converted because they are not exported:\n${commentPrefix} ${schemaList}\n${commentPrefix} To convert them, add 'export' before their declaration (e.g., export const ${nonExported[0]} = z....)`;
    }
    
    // Add spacing: blank line after imports if there's content after it
    const spacingAfterImports = (importsSection && (enumSection || bodySection)) ? '\n' : '';
    
    const finalOutput = importsSection + spacingAfterImports + enumSection + bodySection + unhandledComment;
    
    return { output: finalOutput };
  } catch (error) {
    console.error('Schema conversion error:', error);
    return {
      error: error instanceof Error ? error.message : 'Conversion failed'
    };
  } finally {
    // Clean up temporary directory tree
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn('Failed to delete temporary files:', err);
    }
  }
}

