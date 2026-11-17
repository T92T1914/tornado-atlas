"""Find words that text extraction joined to numbers or to other words in dossier prose.

The rule looks for a letter run straight into a digit, a digit run straight
into a word or into a lone m for meters, a clock run into a.m. or p.m., a.m. or
p.m. run into a capital letter, a list comma with no space after it and a word
or number run straight into an identifier on either side. It also looks for a
lower case letter run straight into a capital, as in exactID or
remainsJeffSnyder, and for an acronym run straight into a lower case word.
Two lower case words run together leave no pattern to find, so each one found
by reading is listed in LOWER_JOINS with the place its space belongs.

Tokens that are written joined on purpose are held aside first: links, DOIs,
hashes, file names, video, channel and photo IDs, product and message codes,
media types, codecs, a camera model, license names, station names, archive and
article identifiers, ordinals, grouped thousands, timestamps, page labels, release
stamps, panel letters, coordinate arrays, half open intervals and rating
labels. So are the names written in camel case on purpose, which no pattern can
tell from a join. Each one in NAMES was read in its sentence and found to be a
channel, company, product, program, format, unit, license tag, bot or field
name, and a Mc or Mac surname needs no entry. A new camel case word is flagged until it is read and
either spaced or added here.
"""
import re

# Camel case written on purpose, each read in its sentence: channels and
# companies, products and programs, file formats, units and color spaces, a
# license tag, a bot, and three field names quoted from the systems that use
# them.
NAMES = ('ArcGIS', 'DoW', 'FlickreviewR', 'FlowFrames', 'GeoEye', 'GoPro', 'GovInfo', 'NickNolteWx', 'RaXPol',
         'SevereStudios', 'StoryMap', 'SuDoc', 'TornadoCentral', 'TwisterChasers', 'USGov', 'WebM', 'WebP', 'WikiSal',
         'YouTube', 'dBZ', 'eScholarship', 'sRGB', 'DateTime', 'currentTime', 'playableInEmbed')
NAMED = r'\bMa?c[A-Z][a-z]+\b|\b(?:' + '|'.join(NAMES) + r')\b'
# Lower case words found run together by reading, each with its space put back.
LOWER_JOINS = {'autoplayoff': 'autoplay off'}
# The text before and after each such space, and where that space falls inside a whole word.
LOWER_SPLITS = tuple((spaced.split(' ')[0], join[spaced.index(' '):]) for join, spaced in LOWER_JOINS.items())
LOWER_SPLIT = '|'.join(rf'(?<=\b{re.escape(left)})(?={re.escape(right)}\b)' for left, right in LOWER_SPLITS)
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
  | ''' + NAMED + r'''
''', re.X)
NAMES_ONLY = re.compile(NAMED)
JOINS = re.compile(r'''
    (?<=[A-Za-z])(?=\d)
  | (?<=\d)(?=[A-Za-z]{2})
  | (?<=\d)(?=[ap]\.m\.)
  | (?<=[ap]\.m\.)(?=[A-Z])
  | (?<=\d)(?=m\b)
  | ,(?=\d)
  | (?<=[A-Za-z])(?=\ue000)
  | (?<=\ue000)(?=[A-Za-z0-9])
  | (?<=[a-z])(?=[A-Z])
  | (?<=[A-Z]{2})(?=[a-z]{2})
  | ''' + LOWER_SPLIT + r'''
''', re.X)
LOWER_SPLIT_AT = re.compile(LOWER_SPLIT)
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
