import { describe, expect, it } from 'vitest';

import { previewLatexFile } from '../src/latex/preview.js';

describe('LaTeX file preview', () => {
  it('parses all heading levels and assigns inclusive hierarchical ranges', () => {
    const content = String.raw`\part{Overview}
intro
\chapter* [Short]{ Chapter \emph{One} }
chapter body
\section[Method short]{Method {with \textbf{nested}}}
section body
\subsection*{Details}
subsection body
\subsubsection{Fine}
fine body
\section{Next}
next body`;

    expect(previewLatexFile(content)).toEqual({
      lineCount: 12,
      items: [
        { type: 'part', title: 'Overview', startLine: 1, endLine: 12 },
        { type: 'chapter', title: 'Chapter \\emph{One}', startLine: 3, endLine: 12 },
        { type: 'section', title: 'Method {with \\textbf{nested}}', startLine: 5, endLine: 10 },
        { type: 'subsection', title: 'Details', startLine: 7, endLine: 10 },
        { type: 'subsubsection', title: 'Fine', startLine: 9, endLine: 10 },
        { type: 'section', title: 'Next', startLine: 11, endLine: 12 },
      ],
    });
  });

  it('returns references and complete float environments in source order', () => {
    const content = String.raw`\section{Method}
\input{ tables/results }
\begin{figure*}
\label{ fig:model }
\caption[Short]{ Model \textbf{architecture} }
\end{figure*}
\include{ sections/discussion }
\begin{table}
\caption{ Results }
\label{tab:results}
\end{table}
\begin{figure}
\label{fig:only-label}
\end{figure}
\begin{table*}
\label{tab:starred}
\caption{Starred table}
\end{table*}`;

    expect(previewLatexFile(content)).toEqual({
      lineCount: 18,
      items: [
        { type: 'section', title: 'Method', startLine: 1, endLine: 18 },
        { type: 'input', target: 'tables/results', startLine: 2 },
        {
          type: 'figure',
          startLine: 3,
          endLine: 6,
          caption: 'Model \\textbf{architecture}',
          label: 'fig:model',
        },
        { type: 'include', target: 'sections/discussion', startLine: 7 },
        { type: 'table', startLine: 8, endLine: 11, caption: 'Results', label: 'tab:results' },
        { type: 'figure', startLine: 12, endLine: 14, label: 'fig:only-label' },
        { type: 'table', startLine: 15, endLine: 18, caption: 'Starred table', label: 'tab:starred' },
      ],
    });
  });

  it('counts logical lines for LF, CRLF, CR, empty, and terminated files', () => {
    expect(previewLatexFile('')).toEqual({ lineCount: 0, items: [] });

    for (const newline of ['\n', '\r\n', '\r']) {
      expect(previewLatexFile(`\\section{One}${newline}body${newline}`)).toEqual({
        lineCount: 2,
        items: [{ type: 'section', title: 'One', startLine: 1, endLine: 2 }],
      });
    }
  });

  it('ignores commands in comments but preserves commands after an escaped percent', () => {
    const content = String.raw`% \section{Ignored} \begin{figure}
literal \% \input{ kept } % \include{ignored}
\section{Visible}`;

    expect(previewLatexFile(content)).toEqual({
      lineCount: 3,
      items: [
        { type: 'input', target: 'kept', startLine: 2 },
        { type: 'section', title: 'Visible', startLine: 3, endLine: 3 },
      ],
    });
  });

  it('skips malformed candidates while keeping later valid items', () => {
    const content = String.raw`\section{Broken
\input{missing
\begin{figure}
\caption{never closes
\section{Valid}
\input{good}
\begin{table}
\caption{Good}
\end{table}`;

    expect(previewLatexFile(content)).toEqual({
      lineCount: 9,
      items: [
        { type: 'section', title: 'Valid', startLine: 5, endLine: 9 },
        { type: 'input', target: 'good', startLine: 6 },
        { type: 'table', startLine: 7, endLine: 9, caption: 'Good' },
      ],
    });
  });

  it('uses the first valid caption and label inside a complete float', () => {
    const content = String.raw`\begin{figure}
\caption[broken
\caption{ Good {nested} caption }
\label{ fig:good }
\end{figure}`;

    expect(previewLatexFile(content)).toEqual({
      lineCount: 5,
      items: [
        {
          type: 'figure',
          startLine: 1,
          endLine: 5,
          caption: 'Good {nested} caption',
          label: 'fig:good',
        },
      ],
    });
  });
});
