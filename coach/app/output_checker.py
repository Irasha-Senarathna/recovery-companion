"""Output checker: the model's draft reply is shown only if it passes every
check. Otherwise the app shows its fixed, safe fallback. It fails closed: a
kind reply that trips a check is lost, an unsafe one never gets through.
"""

import re

from app.crisis import detect_crisis
from app.text import normalise, variants
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
    (
        "shame",
        re.compile(
            r"\bfail(ed|ure|ures|ing)?\b|\b(clean|dirty)\b|\baddicts?\b|\babusers?\b"
            r"|\bjunkies?\b|\bstart(ing)? over\b|\bback to (day )?(zero|0|one|1)\b"
            r"|\bweak(ness)?\b|\bshameful\b|\bruined (everything|it all)\b"
            r"|\blost all (your |of your )?progress\b"
        ),
    ),
]


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
    if detect_crisis(reply) or YOU_CRISIS.search(forms[0]):
        return "crisis_words"
    for reason, pattern in CHECKS[1:]:
        if any(pattern.search(form) for form in forms):
            return reason
    return None
