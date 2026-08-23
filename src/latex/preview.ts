import type {
  LatexFilePreview,
  PreviewFloatItem,
  PreviewHeadingItem,
  PreviewItem,
  PreviewReferenceItem,
  SectionType,
} from '../types.js';

interface ParsedArgument {
  contentStart: number;
  contentEnd: number;
  end: number;
}

interface InternalHeading extends PreviewHeadingItem {
  offset: number;
  level: number;
}

interface InternalItem {
  offset: number;
  sequence: number;
  item: PreviewItem;
}

interface EnvironmentStart {
  name: SupportedEnvironment;
  offset: number;
  contentStart: number;
}

type SupportedEnvironment = 'figure' | 'figure*' | 'table' | 'table*';

const headingLevels: Record<SectionType, number> = {
  part: -1,
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
};

export function previewLatexFile(content: string): LatexFilePreview {
  const lineStarts = buildLineStarts(content);
  const lineCount = lineStarts.length;
  if (lineCount === 0) {
    return { lineCount: 0, items: [] };
  }

  const masked = maskComments(content);
  const headings = parseHeadings(content, masked, lineStarts, lineCount);
  const internalItems: InternalItem[] = [];
  let sequence = 0;

  for (const heading of headings) {
    const { offset, level: _level, ...item } = heading;
    internalItems.push({ offset, sequence: sequence++, item });
  }
  for (const reference of parseReferences(content, masked, lineStarts)) {
    internalItems.push({ offset: reference.offset, sequence: sequence++, item: reference.item });
  }
  for (const float of parseFloats(content, masked, lineStarts)) {
    internalItems.push({ offset: float.offset, sequence: sequence++, item: float.item });
  }

  internalItems.sort((left, right) => left.offset - right.offset || left.sequence - right.sequence);
  return {
    lineCount,
    items: internalItems.map(({ item }) => item),
  };
}

function buildLineStarts(content: string): number[] {
  if (content.length === 0) {
    return [];
  }

  const starts = [0];
  for (let index = 0; index < content.length; index += 1) {
    if (content[index] === '\r') {
      if (content[index + 1] === '\n') {
        index += 1;
      }
    } else if (content[index] !== '\n') {
      continue;
    }

    if (index + 1 < content.length) {
      starts.push(index + 1);
    }
  }
  return starts;
}

function maskComments(content: string): string {
  const masked = content.split('');
  let precedingBackslashes = 0;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '\\') {
      precedingBackslashes += 1;
      continue;
    }
    if (character !== '%' || precedingBackslashes % 2 === 1) {
      precedingBackslashes = 0;
      continue;
    }

    while (index < content.length && content[index] !== '\r' && content[index] !== '\n') {
      masked[index] = ' ';
      index += 1;
    }
    index -= 1;
    precedingBackslashes = 0;
  }

  return masked.join('');
}

function parseHeadings(
  content: string,
  masked: string,
  lineStarts: number[],
  lineCount: number,
): InternalHeading[] {
  const headings: InternalHeading[] = [];
  const matcher = /\\(subsubsection|subsection|section|chapter|part)(?![A-Za-z@])/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(masked)) !== null) {
    const type = match[1] as SectionType;
    const argument = parseCommandArgument(masked, matcher.lastIndex, true, true);
    if (!argument) {
      continue;
    }
    headings.push({
      type,
      title: content.slice(argument.contentStart, argument.contentEnd).trim(),
      startLine: lineForOffset(lineStarts, match.index),
      endLine: lineCount,
      offset: match.index,
      level: headingLevels[type],
    });
    matcher.lastIndex = argument.end;
  }

  for (const [index, heading] of headings.entries()) {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    if (next) {
      heading.endLine = Math.max(heading.startLine, next.startLine - 1);
    }
  }
  return headings;
}

function parseReferences(
  content: string,
  masked: string,
  lineStarts: number[],
): Array<{ offset: number; item: PreviewReferenceItem }> {
  const references: Array<{ offset: number; item: PreviewReferenceItem }> = [];
  const matcher = /\\(input|include)(?![A-Za-z@])/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(masked)) !== null) {
    const argument = parseCommandArgument(masked, matcher.lastIndex, false, false);
    if (!argument) {
      continue;
    }
    references.push({
      offset: match.index,
      item: {
        type: match[1] as 'input' | 'include',
        target: content.slice(argument.contentStart, argument.contentEnd).trim(),
        startLine: lineForOffset(lineStarts, match.index),
      },
    });
    matcher.lastIndex = argument.end;
  }
  return references;
}

function parseFloats(
  content: string,
  masked: string,
  lineStarts: number[],
): Array<{ offset: number; item: PreviewFloatItem }> {
  const floats: Array<{ offset: number; item: PreviewFloatItem }> = [];
  const starts: EnvironmentStart[] = [];
  const matcher = /\\(begin|end)(?![A-Za-z@])/g;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(masked)) !== null) {
    const argument = parseCommandArgument(masked, matcher.lastIndex, false, false);
    if (!argument) {
      continue;
    }
    const name = masked.slice(argument.contentStart, argument.contentEnd).trim();
    if (!isSupportedEnvironment(name)) {
      continue;
    }
    matcher.lastIndex = argument.end;

    if (match[1] === 'begin') {
      starts.push({ name, offset: match.index, contentStart: argument.end });
      continue;
    }

    let startIndex = starts.length - 1;
    while (startIndex >= 0 && starts[startIndex].name !== name) {
      startIndex -= 1;
    }
    if (startIndex === -1) {
      continue;
    }
    const start = starts[startIndex];
    starts.splice(startIndex, 1);
    const caption = findFirstCommandArgument(content, masked, start.contentStart, match.index, 'caption', true);
    const label = findFirstCommandArgument(content, masked, start.contentStart, match.index, 'label', false);
    const item: PreviewFloatItem = {
      type: name.startsWith('figure') ? 'figure' : 'table',
      startLine: lineForOffset(lineStarts, start.offset),
      endLine: lineForOffset(lineStarts, match.index),
    };
    if (caption !== undefined) {
      item.caption = caption;
    }
    if (label !== undefined) {
      item.label = label;
    }
    floats.push({ offset: start.offset, item });
  }

  return floats;
}

function findFirstCommandArgument(
  content: string,
  masked: string,
  start: number,
  end: number,
  command: 'caption' | 'label',
  allowOptional: boolean,
): string | undefined {
  const matcher = new RegExp(`\\\\${command}(?![A-Za-z@])`, 'g');
  matcher.lastIndex = start;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(masked)) !== null && match.index < end) {
    const argument = parseCommandArgument(masked, matcher.lastIndex, false, allowOptional);
    if (argument && argument.end <= end) {
      return content.slice(argument.contentStart, argument.contentEnd).trim();
    }
  }
  return undefined;
}

function parseCommandArgument(
  content: string,
  start: number,
  allowStar: boolean,
  allowOptional: boolean,
): ParsedArgument | undefined {
  let index = skipWhitespace(content, start);
  if (allowStar && content[index] === '*') {
    index = skipWhitespace(content, index + 1);
  }
  if (allowOptional && content[index] === '[') {
    const optional = parseDelimited(content, index, '[', ']');
    if (!optional) {
      return undefined;
    }
    index = skipWhitespace(content, optional.end);
  }
  return parseDelimited(content, index, '{', '}');
}

function parseDelimited(
  content: string,
  start: number,
  opener: '{' | '[',
  closer: '}' | ']',
): ParsedArgument | undefined {
  if (content[start] !== opener) {
    return undefined;
  }

  let depth = 1;
  for (let index = start + 1; index < content.length; index += 1) {
    if (content[index] === '\\') {
      index += 1;
      continue;
    }
    if (content[index] === opener) {
      depth += 1;
    } else if (content[index] === closer && --depth === 0) {
      return {
        contentStart: start + 1,
        contentEnd: index,
        end: index + 1,
      };
    }
  }
  return undefined;
}

function skipWhitespace(content: string, start: number): number {
  let index = start;
  while (index < content.length && /\s/.test(content[index])) {
    index += 1;
  }
  return index;
}

function lineForOffset(lineStarts: number[], offset: number): number {
  let low = 0;
  let high = lineStarts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (lineStarts[middle] <= offset) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function isSupportedEnvironment(value: string): value is SupportedEnvironment {
  return value === 'figure' || value === 'figure*' || value === 'table' || value === 'table*';
}
