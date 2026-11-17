"""Find words that text extraction joined to numbers in dossier prose.

The rule looks for a letter run straight into a digit, a digit run straight
into a word or into a lone m for meters, a clock run into a.m. or p.m., a.m. or
p.m. run into a capital letter, a list comma with no space after it and a word
or number run straight into an identifier on either side. Tokens that are written joined on purpose are
held aside first: links, DOIs,
hashes, file names, video, channel and photo IDs, product and message codes,
media types, codecs, a camera model, license names, station names, archive and
article identifiers, ordinals, grouped thousands, timestamps, page labels, release
stamps, panel letters, coordinate arrays, half open intervals and rating
labels.
"""
import re

PROTECTED = re.compile(r'''
    https?://\S+
  | \b10\.\d{4,}/[^\s,;)]+
  | \b[0-9a-f]{12,}\b
  | \b[\w.-]+\.(?:png|jpe?g|gif|json|pdf|md|html|csv|mp4|webm)\b
  | 5ohIVzIZLuQ | 9KjWtBrEYHY | T0FHTG9VETY | \bAPP13?\b | \bWFUS54\b
  | /O\.[A-Z]+\.[A-Z]+\.[A-Z]+\.[A-Z]\.\d+\.\d+T\d+Z-\d+T\d+Z/
  | \b\d+(?:st|nd|rd|th)\b
  | \b\d{1,3}(?:,\d{3})+\b
  | \b\d{4}-\d{2}-\d{2}T[\d:.]+Z?
  | \bE\d{4}\b
  | \bc20\d{6}\b
  | \bBAMS-D-[\d.-]+
  | \b\d+[a-d](?:,[a-d])*\b(?!\.m\.)
  | \[[-\d.,]+\]
  | \[\d+,\d+\)
  | \b(?:SHA256|SHA1|MM:SS|EF\d|F\d|NIST|VTEC|CC0|H\.264|VP8|MP4|HDR-PJ710V)\b
  | 0Wdv6zsvsI0 | C34EVyWRZbk | EFwJAlg0qWc | jsBDFA6_81M | s-W92EOU138 | UCVkPU2g8vQQTpJgeELP8wvQ
  | wuU-nFuIZN4 | Em5HbYt0Fsk | \b[nr]-[A-Za-z0-9]{6}\b | \b\d{6}-[A-Z]-[A-Z]{2}\d{3}-\d{3}\b
  | \b[0-9a-f]{40}_\d{4}-\d{2}-\d{2}T[\d:]+
  | \b(?:video|image|audio)/[a-z0-9.+-]+
  | \b(?:FLORA\d+|FY\d{4}|PMC\d+|PMID\d+|oldid\d+)\b
  | \bnws-[a-z-]+\d+\b
  | \bFOX\d+\b
''', re.X)
JOINS = re.compile(r'''
    (?<=[A-Za-z])(?=\d)
  | (?<=\d)(?=[A-Za-z]{2})
  | (?<=\d)(?=[ap]\.m\.)
  | (?<=[ap]\.m\.)(?=[A-Z])
  | (?<=\d)(?=m\b)
  | ,(?=\d)
  | (?<=[A-Za-z])(?=\ue000)
  | (?<=\ue000)(?=[A-Za-z0-9])
''', re.X)
HELD = '\ue000'


def joined_words(text):
    """Return each whitespace separated word of text that holds a join."""
    work = PROTECTED.sub(HELD, text)
    words = []
    for match in JOINS.finditer(work):
        start = work.rfind(' ', 0, match.start()) + 1
        end = work.find(' ', match.end())
        word = work[start:None if end < 0 else end].replace(HELD, '...')
        if word not in words:
            words.append(word)
    return words
