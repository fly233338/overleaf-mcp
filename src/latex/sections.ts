import type { Section, SectionType } from '../types.js';

const openerRegex = /\\(subsubsection|subsection|section|chapter|part)\*?(?:\[[^\]]*\])?\{/g;
const sectionLevels: Record<SectionType, number> = {
  part: -1,
  chapter: 0,
  section: 1,
  subsection: 2,
  subsubsection: 3,
};

export function parseSections(content: string): Section[] {
  const sections: Section[] = [];
  const matcher = new RegExp(openerRegex.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(content)) !== null) {
    const startIndex = match.index;
    let depth = 1;
    let index = matcher.lastIndex;

    while (index < content.length && depth > 0) {
      const character = content[index];
      if (character === '\\') {
        index += 2;
        continue;
      }
      if (character === '{') {
        depth += 1;
      } else if (character === '}' && --depth === 0) {
        break;
      }
      index += 1;
    }

    if (depth !== 0) {
      continue;
    }

    sections.push({
      title: content.slice(matcher.lastIndex, index),
      type: match[1] as SectionType,
      index: startIndex,
    });
    matcher.lastIndex = index + 1;
  }

  return sections;
}

export function replaceSection(content: string, sectionTitle: string, newContent: string): string {
  const sections = parseSections(content);
  const target = sections.find((section) => section.title === sectionTitle);
  if (!target) {
    throw new Error(`Section "${sectionTitle}" not found`);
  }

  const targetLevel = sectionLevels[target.type];
  const next = sections.find(
    (section) =>
      section.index > target.index && sectionLevels[section.type] <= targetLevel,
  );
  const endMarker = content.lastIndexOf('\\end{document}');
  const endIndex = next?.index ?? (endMarker === -1 ? content.length : endMarker);

  return content.slice(0, target.index) + newContent.trimEnd() + '\n\n' + content.slice(endIndex);
}
