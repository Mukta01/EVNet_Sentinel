"""Build the Elsevier (elsarticle) journal version from the v4 IEEE paper body.

Usage (from this folder):
    python3 make_journal_version.py EVNet_Sentinel_Research_Paper_v4_IEEE.tex EVNet_Sentinel_Journal_Elsevier.tex
"""
import re
import sys

src, out = sys.argv[1], sys.argv[2]
s = open(src).read()

abstract = re.search(r"\\begin\{abstract\}\n(.*?)\n\\end\{abstract\}", s, re.S).group(1).strip()
body = s[s.index(r"% ============================================================================" + "\n" + r"\section{Introduction}"):s.index(r"\end{document}")]

# IEEE-only bits in the body
body = body.replace(r"\section*{Acknowledgment}", r"\section*{Acknowledgements}")
data_and_coi = r"""\section*{Data availability}

The CICEVSE2024 dataset is available from the Canadian Institute for Cybersecurity \cite{b8}. All code, exported results and the response replay are public at \url{https://github.com/Mukta01/EVNet_Sentinel}.

\section*{Declaration of competing interest}

The authors declare that they have no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper.

"""
body = body.replace(r"\section*{Acknowledgements}", data_and_coi + r"\section*{Acknowledgements}", 1)
# monospaced column names never break at underscores: allow a break after each one
body = re.sub(r"\\col\{([^}]*)\}", lambda m: "\\col{" + m.group(1).replace("\\_", "\\_\\allowbreak{}") + "}", body)
# figure* is fine in elsarticle; one-column review format, so full-width figures stay full width
preamble = r"""% ============================================================================
%  EVNet Sentinel — journal version (Elsevier, elsarticle), from v4
%
%  Same content as EVNet_Sentinel_Research_Paper_v4_IEEE.tex, in Elsevier's
%  submission (review) format: single column, numbered references, highlights,
%  data availability and competing-interest statements. Regenerate from v4
%  rather than editing both by hand.
%
%  Build:    pdflatex EVNet_Sentinel_Journal_Elsevier.tex  (run twice)
%  Needs:    elsarticle.cls (tlmgr install elsarticle)
% ============================================================================
\documentclass[preprint,12pt]{elsarticle}

\usepackage[T1]{fontenc}
\usepackage{lmodern}
\usepackage{amsmath,amssymb,amsfonts}
\usepackage{graphicx}
\graphicspath{{figures/}{../figures/}}
\usepackage{textcomp}
\usepackage{xcolor}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage{microtype}
\usepackage{tabularx}
\usepackage{lineno}

\hypersetup{
    colorlinks=true, linkcolor=blue, urlcolor=blue, citecolor=blue,
    pdftitle={EVNet Sentinel: Leakage-Corrected Intrusion Detection for EV Charging Networks},
    pdfauthor={Varak, Chaurasiya, Chogale, Chavhan, Khandke}
}

\newcommand{\col}[1]{\texttt{\small #1}}
\newcolumntype{L}{>{\raggedright\arraybackslash}X}
\DeclareMathOperator*{\argmax}{arg\,max}
% long column names (e.g. bidirectional_first_seen_ms) cannot hyphenate
\setlength{\emergencystretch}{3em}

\journal{(target journal)}

\begin{document}

\begin{frontmatter}

\title{EVNet Sentinel: A Leakage-Corrected Reproduction and Comparative Study of Intrusion Detection on Electric Vehicle Charging Networks, with a Closed-Loop Response}

\author[vit]{Mukta Varak}
\author[vit]{Shruti Chaurasiya}
\author[vit]{Shardul Chogale\corref{cor1}}
\ead{shardulchogale1983@gmail.com}
\author[vit]{Neha Chavhan}
\author[vit]{Mahesh Khandke}
\ead{makhandke@gmail.com}
\cortext[cor1]{Corresponding author.}

\affiliation[vit]{organization={Department of Computer Engineering, Vidyalankar Institute of Technology},
            city={Mumbai},
            country={India}}

\begin{abstract}
""" + abstract + r"""
\end{abstract}

\begin{highlights}
\item One capture timestamp recovers the CICEVSE2024 label better than the published model.
\item Reported concept drift sits on the joins between capture files, not traffic changes.
\item Leak-free macro-F1 is 0.558: floods stay separable, the six scan types do not.
\item Boosted trees tie with Random Forest; the scan ceiling lies in the flow features.
\item An operator-approved containment policy contains all 20 recorded attacks in replay.
\end{highlights}

\begin{keyword}
Intrusion detection \sep electric vehicle charging \sep CICEVSE2024 \sep data leakage \sep concept drift \sep OCPP \sep incident response
\end{keyword}

\end{frontmatter}

\linenumbers

"""
open(out, "w").write(preamble + body + r"\end{document}" + "\n")
print("journal written", len(preamble + body))
