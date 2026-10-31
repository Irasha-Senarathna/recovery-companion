"""Output checker: the model's draft reply is shown only if it passes every
check. Otherwise the app shows its fixed, safe fallback. It fails closed: a
kind reply that trips a check is lost, an unsafe one never gets through.
"""

import json
import re
from functools import cache

from app.crisis import content_path, detect_crisis
from app.text import latin_pattern, normalise, variants
from app.topic_guard import SI_DRUGS, SI_MEDICINE, TA_DRUGS, TA_MEDICINE

MAX_REPLY = 2000

MEDICINE_NAMES = (
    r"methadone|buprenorphine|suboxone|subutex|naltrexone|naloxone|narcan|antabuse|disulfiram"
    r"|xanax|valium|diazepam|alprazolam|clonazepam|lorazepam|chlordiazepoxide|librium|benzos?"
    r"|benzodiazepines?|tramadol|codeine|morphine|oxycodone|percocet|gabapentin|pregabalin|lyrica"
    r"|zopiclone|ambien|sertraline|fluoxetine|prozac|panadol|paracetamol|ibuprofen|aspirin"
    r"|melatonin|sleeping pills?|painkillers?"
)
ROLES = (
    r"(doctor|therapist|counsell?or|psychiatrist|psychologist|nurse|pharmacist|physician"
    r"|medical professional)"
)

SUBSTANCE_NAMES = (
    r"heroin|kudu|meth|methamphetamine|cocaine|crack|weed|ganja|cannabis|marijuana|mdma|ecstasy"
    r"|lsd|ketamine|fentanyl|opium"
)


def _script(*terms: str) -> str:
    """Sinhala/Tamil terms, normalised like the text they are matched against."""
    return "|".join(re.escape(normalise(t)) for t in terms)


# "I am a doctor" in Sinhala/Tamil, unless followed by "not".
SCRIPT_CLAIMS = (
    "මම (?:"
    + _script("වෛද්‍ය", "චිකිත්සක", "උපදේශක")
    + r")\S*(?!\s*(?:"
    + _script("නොවේ", "නෙමෙයි", "නෙවෙයි")
    + "))"
    "|நான் (?:ஒரு )?(?:"
    + _script("மருத்துவர்", "சிகிச்சையாளர்", "ஆலோசகர்")
    + r")(?!\s*(?:"
    + _script("அல்ல", "இல்லை")
    + "))"
)

# The crisis list is written in the first person; a reply speaks in the second.
YOU_CRISIS = re.compile(
    r"\b(end(ing)? your (own )?life|take your (own )?life|kill(ing)? yourself"
    r"|(hurt|harm|cut)(ing|ting)? yourself|want to die)\b"
)

# Checked in order; the first match is the reason given.
CHECKS: list[tuple[str, re.Pattern[str]]] = [
    (
        "contact_details",
        re.compile(r"\d[\d\s\-()]{2,}\d|\+\d|https?://|\bwww\.|\.(com|org|net|lk|gov)\b|\S@\S"),
    ),
    (
        "claims_role",
        re.compile(
            r"\bi(?:'m| am) (?!not\b)(?:a |an |your )?(?:licensed |qualified |trained |real )?"
            + ROLES
            + r"\b|\bas your "
            + ROLES
            + r"\b|(?<!such )\bas an? (?:licensed |qualified |trained )?"
            + ROLES
            + r"\s*,|"
            + SCRIPT_CLAIMS
        ),
    ),
    (
        "dosing",
        re.compile(
            r"\b\d+(\.\d+)?\s?(mg|mcg|ml|milligrams?|micrograms?|grams?|g|cc|units?)\b"
            r"|\b(dose|doses|dosage|dosing|taper\w*|milligrams?)\b"
            r"|\b(one|two|three|four|five|half|a couple of|\d+) (pills?|tablets?|tabs?|capsules?"
            r"|lines?|hits?|drops?)\b"
            r"|" + _script("මාත්‍රා", "மருந்தளவு", "டோஸ்")
        ),
    ),
    (
        "medication",
        re.compile(r"\b(" + MEDICINE_NAMES + r")\b|" + _script(*SI_MEDICINE, *TA_MEDICINE)),
    ),
    (
        "withdrawal",
        re.compile(
            r"\b(withdrawals?|detox\w*|cold turkey|wean\w*|cut(ting)? (it )?down|reduce slowly"
            r"|an extra one|half an? (pill|tablet|tab))\b"
        ),
    ),
    (
        "substance",
        re.compile(r"\b(" + SUBSTANCE_NAMES + r")\b|" + _script(*SI_DRUGS, *TA_DRUGS)),
    ),
    (
        "drug_use",
        re.compile(
            r"\b(inject\w*|snort\w*|shoot(ing)? up|needles?|syringes?|freebas\w*|safer use"
            r"|test strips?|cook(ing)? (it|up))\b"
        ),
    ),
    (
        "secrecy",
        re.compile(
            r"\b(don't|do not|no need to|never) (have to )?(tell|mention)\b"
            r"|\bkeep (it|this|that) (a )?(secret|to yourself|between us)\b"
            r"|\b(no ?one|nobody) (needs|has|ever needs) to know\b"
            r"|\bhide (it|this|that) from\b|\b(our|a) little secret\b"
        ),
    ),
    (
        "reliance",
        re.compile(
            r"\bi('ll| will) always be (here|there) for you\b"
            r"|\byou (don't|do not) need (a |your |any )?(counsell?or|therapist|sponsor|doctor"
            r"|meetings?|treatment|anyone|anybody|people|other people)\b"
            r"|\b(just|only) talk to me\b|\bi'm all you need\b|\bi am all you need\b"
            r"|\btalk to me instead\b|\binstead of (your |a )?(counsell?or|therapist|sponsor"
            r"|treatment|meetings?|family|friends)\b"
        ),
    ),
]

# Kind replies often deny a shame word: "you're not weak", "a slip isn't a failure".
# A clause is let through only when the whole clause is one of these plain
# denials. "Don't be weak", "you won't be a failure if...", "not just weak" and
# labels (addict, clean) still count as shame.
_SUBJECT = (
    r"(?:you|a slip|slips|this|it|that|slipping|a craving|cravings|having (?:a )?cravings?"
    r"|needing (?:help|support)|asking for help)"
)
_BE_NOT = r"(?:'re not|'s not| (?:is|are|was) not| (?:isn't|aren't|wasn't))"
_GERUND = r"(?: (?:for|by) \w+ing\b[\w ']{0,40})?"
ALLOWED_DENIAL = re.compile(
    _SUBJECT
    + _BE_NOT
    + r" (?:a |a sign of )?(?:weak|weakness|failure|failing|shameful)"
    + _GERUND
    + r"|(?:this|that|it|a slip|slipping|having a craving) (?:doesn't|does not|didn't|did not)"
    r" (?:make|mean) (?:that )?you(?:'re| are|'ve| have)? (?:a )?(?:weak|failure|failed)"
    r"|you (?:haven't|have not|didn't|did not) fail(?:ed)?"
    + _GERUND
    + r"|you (?:don't|do not) (?:have|need) to start over"
    r"|you(?:'re| are) never back to (?:day )?(?:zero|0|one|1)"
    r"|(?:needing (?:help|support)|asking for help) is nothing shameful"
)
# Any hedge in the reply and no denial is trusted: "you're not weak... yet",
# "it's not a failure if you stop now", "nobody would say you're not weak".
HEDGES = re.compile(
    r"\.\.\.|…|\b(?:yet|if|unless|as long as|until|this time|anymore|any more|again|at all"
    r"|only|lie|sure|nobody|no one|would say|won't|will not)\b"
)
CLAUSES = re.compile(r"([^.!?;,—]+)([.!?;,—]*)")
_LEADING = re.compile(r"^(?:and|but|so|and so) ")


@cache
def shame_patterns() -> tuple[re.Pattern[str], tuple[str, ...]]:
    """content/shame_terms.json: en patterns and si/ta terms (si/ta are drafts, need review)."""
    data = json.loads(content_path("shame_terms.json").read_text(encoding="utf-8"))
    script = tuple(normalise(t) for t in data["si"]["terms"] + data["ta"]["terms"])
    return latin_pattern(data["en"]["patterns"]), script


def _shames(form: str) -> bool:
    pattern, script = shame_patterns()
    if any(term in form for term in script):
        return True
    trust_denials = not HEDGES.search(form)
    for match in CLAUSES.finditer(form):
        clause = _LEADING.sub("", match.group(1).strip())
        if not pattern.search(clause):
            continue
        denial = trust_denials and "?" not in match.group(2) and ALLOWED_DENIAL.fullmatch(clause)
        if not denial:
            return True
    return False


def check_reply(reply: str) -> str | None:
    """None if the reply is safe to show, otherwise the reason it is not."""
    if not reply.strip():
        return "empty"
    if len(reply) > MAX_REPLY:
        return "too_long"
    forms = variants(reply)
    for reason, pattern in CHECKS[:1]:
        if pattern.search(forms[0]):
            return reason
    if detect_crisis(reply) or any(YOU_CRISIS.search(form) for form in forms):
        return "crisis_words"
    for reason, pattern in CHECKS[1:]:
        if any(pattern.search(form) for form in forms):
            return reason
    if any(_shames(form) for form in forms):
        return "shame"
    return None
