/**
 * Client-side Office document parser
 * Parses Excel (xlsx), PowerPoint (pptx), Word (docx) files without server API calls
 * Uses fflate for ZIP decompression (Office files are ZIP archives)
 */

import { unzipSync, strFromU8 } from "fflate";

const OFFICE_EXTENSION_RE = /\.(xlsx|xls|pptx|ppt|docx|csv)$/iu;

export function isOfficeDocument(file: Pick<File, "name" | "type">): boolean {
  if (OFFICE_EXTENSION_RE.test(file.name)) return true;
  const type = file.type?.toLowerCase() || "";
  return (
    type.includes("spreadsheetml") ||
    type.includes("presentationml") ||
    type.includes("wordprocessingml") ||
    type === "application/vnd.ms-excel" ||
    type === "application/vnd.ms-powerpoint" ||
    type === "application/msword"
  );
}

export function getOfficeDocumentType(
  file: Pick<File, "name" | "type">,
): "xlsx" | "pptx" | "docx" | "csv" | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".pptx") || name.endsWith(".ppt")) return "pptx";
  if (name.endsWith(".docx")) return "docx";
  if (name.endsWith(".csv")) return "csv";
  return null;
}

/**
 * Parse XML text and extract inner text content
 * Simple XML text extraction without full DOM parsing (for browser efficiency)
 */
function extractTextFromXml(xml: string, tagName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "g");
  let match;
  while ((match = regex.exec(xml)) !== null) {
    // Strip inner XML tags to get plain text
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) results.push(text);
  }
  return results;
}

/**
 * Parse Excel/xlsx file to Markdown tables
 */
async function parseXlsxFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));

  // Read shared strings (xl/sharedStrings.xml)
  const sharedStrings: string[] = [];
  const sharedStringsFile = files["xl/sharedStrings.xml"];
  if (sharedStringsFile) {
    const xml = strFromU8(sharedStringsFile);
    const strings = extractTextFromXml(xml, "si");
    sharedStrings.push(...strings);
  }

  // Read workbook to get sheet names
  const workbookFile = files["xl/workbook.xml"];
  const sheetNames: Array<{ name: string; sheetId: string }> = [];
  if (workbookFile) {
    const xml = strFromU8(workbookFile);
    const sheetRegex = /<sheet\s+([^/]+?)\/>/g;
    let match;
    while ((match = sheetRegex.exec(xml)) !== null) {
      const attrs = match[1];
      const nameMatch = attrs.match(/name="([^"]+)"/);
      const idMatch = attrs.match(/sheetId="([^"]+)"/);
      if (nameMatch && idMatch) {
        sheetNames.push({ name: nameMatch[1], sheetId: idMatch[1] });
      }
    }
  }

  // Parse each sheet
  const sheetOutputs: string[] = [];
  const sheetFiles = Object.keys(files).filter(
    (name) => name.startsWith("xl/worksheets/sheet") && name.endsWith(".xml"),
  );

  for (let i = 0; i < sheetFiles.length; i++) {
    const sheetFile = sheetFiles[i];
    const sheetName = sheetNames[i]?.name || `Sheet${i + 1}`;
    const xml = strFromU8(files[sheetFile]);

    // Parse rows
    const rows: string[][] = [];
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(xml)) !== null) {
      const rowXml = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<c([^>]*)>([\s\S]*?)<\/c>/g;
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const attrs = cellMatch[1];
        const content = cellMatch[2];
        const typeMatch = attrs.match(/t="([^"]+)"/);
        const type = typeMatch?.[1] || "";

        const valueMatch = content.match(/<v>([\s\S]*?)<\/v>/);
        const value = valueMatch?.[1] || "";

        if (type === "s") {
          // Shared string reference
          const index = parseInt(value, 10);
          cells.push(sharedStrings[index] || "");
        } else if (type === "inlineStr") {
          // Inline string
          const inlineMatch = content.match(/<t[^>]*>([\s\S]*?)<\/t>/);
          cells.push(inlineMatch?.[1] || "");
        } else {
          cells.push(value);
        }
      }
      if (cells.length > 0) rows.push(cells);
    }

    if (rows.length === 0) continue;

    // Convert to Markdown table
    const maxCols = Math.max(...rows.map((r) => r.length));
    const normalized = rows.map((r) => {
      const padded = [...r];
      while (padded.length < maxCols) padded.push("");
      return padded;
    });

    let markdown = `## ${sheetName}\n\n`;
    if (normalized.length > 0) {
      markdown += `| ${normalized[0].join(" | ")} |\n`;
      markdown += `|${" --- |".repeat(maxCols)}\n`;
      for (let j = 1; j < normalized.length; j++) {
        markdown += `| ${normalized[j].join(" | ")} |\n`;
      }
    }
    sheetOutputs.push(markdown);
  }

  return sheetOutputs.join("\n\n");
}

/**
 * Parse PowerPoint/pptx file to Markdown
 */
async function parsePptxFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));

  // Find all slide files
  const slideFiles = Object.keys(files)
    .filter(
      (name) => name.startsWith("ppt/slides/slide") && name.endsWith(".xml"),
    )
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = strFromU8(files[slideFiles[i]]);
    const texts = extractTextFromXml(xml, "a:t");

    let slideContent = `## Slide ${i + 1}\n\n`;
    if (texts.length > 0) {
      // First text often is title
      slideContent += `**${texts[0]}**\n\n`;
      for (let j = 1; j < texts.length; j++) {
        slideContent += `- ${texts[j]}\n`;
      }
    }
    slides.push(slideContent);
  }

  return slides.join("\n\n");
}

/**
 * Parse Word/docx file to Markdown
 */
async function parseDocxFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));

  const documentFile = files["word/document.xml"];
  if (!documentFile) {
    throw new Error("Invalid docx file: no document.xml");
  }

  const xml = strFromU8(documentFile);

  // Extract paragraphs (w:p contains multiple w:t text runs)
  const paragraphs: string[] = [];
  const paragraphRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
  let paragraphMatch;
  while ((paragraphMatch = paragraphRegex.exec(xml)) !== null) {
    const pXml = paragraphMatch[1];
    const texts = extractTextFromXml(pXml, "w:t");
    const paragraphText = texts.join("");
    if (paragraphText.trim()) {
      paragraphs.push(paragraphText);
    }
  }

  return paragraphs.join("\n\n");
}

/**
 * Parse CSV file to Markdown table
 */
async function parseCsvFile(file: File): Promise<string> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return "";

  // Simple CSV parser (handles quoted values)
  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    cells.push(current);
    return cells;
  };

  const rows = lines.map(parseLine);
  const maxCols = Math.max(...rows.map((r) => r.length));
  const normalized = rows.map((r) => {
    const padded = [...r];
    while (padded.length < maxCols) padded.push("");
    return padded;
  });

  let markdown = `| ${normalized[0].join(" | ")} |\n`;
  markdown += `|${" --- |".repeat(maxCols)}\n`;
  for (let i = 1; i < normalized.length; i++) {
    markdown += `| ${normalized[i].join(" | ")} |\n`;
  }
  return markdown;
}

/**
 * Parse Office document to Markdown
 * Fully client-side, no API calls required
 */
export async function parseOfficeDocument(file: File): Promise<string> {
  const type = getOfficeDocumentType(file);
  if (!type) {
    throw new Error(`Unsupported office document type: ${file.name}`);
  }

  try {
    switch (type) {
      case "xlsx":
        return await parseXlsxFile(file);
      case "pptx":
        return await parsePptxFile(file);
      case "docx":
        return await parseDocxFile(file);
      case "csv":
        return await parseCsvFile(file);
      default:
        throw new Error(`Unsupported document type: ${type}`);
    }
  } catch (error) {
    throw new Error(
      `Failed to parse ${type} file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
