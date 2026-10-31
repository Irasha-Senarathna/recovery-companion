"""Topic guard (safety rule 1): questions about medicines, doses, withdrawal or
using drugs never reach the model. The app answers them with a kind, fixed
refusal that points to a professional and the help button.

It blocks *asking for advice*, not mentioning a topic: "I went to my doctor
today" or "I used to use drugs at parties" are everyday support. Sinhala and
Tamil lists are drafts that need native-speaker review.
"""

import re
from typing import Literal

from app.text import normalise, variants

Topic = Literal["dosing", "withdrawal", "medical", "drug_use", "rules"]

MEDICINES = (
    r"methadone|buprenorphine|suboxone|subutex|naltrexone|naloxone|narcan|antabuse|disulfiram"
    r"|xanax|valium|diazepam|alprazolam|clonazepam|lorazepam|chlordiazepoxide|librium|benzos?"
    r"|benzodiazepines?|tramadol|codeine|morphine|oxycodone|oxy|percocet|gabapentin|pregabalin"
    r"|lyrica|zopiclone|ambien|sertraline|fluoxetine|prozac|antidepressants?|panadol|paracetamol"
    r"|ibuprofen|aspirin|painkillers?|pain killers?|sleeping pills?|meds|medications?|medicines?"
    r"|pills?|tablets?|prescriptions?"
)
SUBSTANCES = (
    r"heroin|kudu|meth|methamphetamine|cocaine|crack|weed|ganja|cannabis|marijuana|mdma"
    r"|ecstasy|molly|lsd|ketamine|fentanyl|opium|drugs?"
)
# Everyday words too ("ice cream", "coke"): drug use only right after a use verb.
AMBIGUOUS = r"ice|coke|crystal|acid|hash|gear"
ASKING = r"\b(should|can|could|may|is it|is that|are they|would|do i|does it|how|what|which)\b|\?"
MEDICINE_ACTIONS = (
    r"\b(take|taking|stop|stopping|quit|start|increase|decrease|reduce|lower|double|skip|mix"
    r"|mixing|combine|instead|swap|switch|safe|dangerous|side effects?|drink|drinking|alcohol"
    r"|beer|arrack)\b"
)
SYMPTOMS = (
    r"\b(chest pains?|seizures?|fits|fainted|vomiting blood|hallucinat\w*|heart (is )?racing"
    r"|palpitations|can'?t stop shaking)\b"
)
# Commoner signs count only when the person asks whether to worry about them.
SIGNS = r"\b(shaking|sweating|sweats|vomiting|throwing up|shivering)\b"
WORRIED = (
    r"\b(is (this|it|that) (normal|dangerous|ok|okay)|should i (be worried|worry)|what do i do)\b"
)

# Each topic: English (Latin) patterns, then Sinhala/Tamil (all, any) term groups.
DOSING = [
    r"\b\d+(\.\d+)?\s?(mg|mcg|ml|milligrams?|micrograms?|grams?|g|cc|units?)\b",
    r"\b(dose|doses|dosage|dosages|dosing)\b",
    r"\bhow (much|many)\b.{0,40}\b(take|taking|use|using|smoke|snort|inject|pills?|tablets?|tabs?"
    r"|hits?|lines?|grams?|mg|ml)\b",
    r"\b(safe|right|correct|normal|lethal|max(imum)?) (amount|limit)\b",
    r"\b(what|which|how big an?) (amount|quantity)\b",
    r"\b(one|two|three|four|five|six|a couple( of)?|half|\d+) (pills?|tablets?|tabs?|lines?|hits?"
    r"|grams?)\b.{0,20}\b(too (much|many)|enough|safe|ok|okay)\b",
]
# Talking about withdrawal ("detox was hard but I made it") is support; asking is not.
WITHDRAWAL = [
    r"(?=.*(" + ASKING + r"))(?=.*\b(withdrawals?|withdrawing from|detox(ing|ification)?"
    r"|dope ?sick|rattling)\b)",
    r"\b(taper(ing|ed)?|cold turkey)\b",
    r"\bwean(ing)? (myself )?off\b",
    r"\b(come|coming|get|getting) off (" + MEDICINES + r")\b",
    r"\b(come|coming|get|getting) off (it|them|this|that) (slowly|safely|gradually)\b",
    r"\bcut(ting)? down slowly\b",
]
DRUG_USE = [
    r"\b(where|how) (can|do|could|would|should) i (get|buy|find|score|cop|order) (some |more )?"
    r"(" + SUBSTANCES + r")\b",
    r"\b(where|how) (do|can|could|would) (people|you|someone|i) (usually )?(score|cop)\b",
    r"(?=.*("
    + ASKING
    + r"))\b(buy|buying|score|scoring|cop|dealer|plug)\b.{0,30}\b("
    + SUBSTANCES
    + r")\b",
    r"\b(smoke|smoking|use|using|snort|snorting|cook|cooking|buy|score|get|do)\b (some |more )?("
    + AMBIGUOUS
    + r")\b(?! cream)",
    r"\b(safe(st|r)?|best|right|proper|easiest) (way )?to (use|inject|snort|smoke|shoot up|cook)\b",
    r"\b(how|where|best|ways? to|can i|should i)\b.{0,30}\b(get|getting) (high|stoned|wasted|lit"
    r"|messed up)\b",
    r"\bhow (do i|to|can i|should i|do you|do people) (inject|snort|shoot up|cook|freebase)\b",
    r"\bhow (do i|to|can i|should i|do you|do people) (use|smoke|take|mix|cut|make|do) (some |a "
    r"little |a bit of )?(" + SUBSTANCES + r")\b",
    r"\b(ok|okay|safe|fine|bad|dangerous) to (use|take|smoke|try|do|inject|snort) ("
    + SUBSTANCES
    + r")\b",
    r"\b(mix|mixing|combine|combining) (" + SUBSTANCES + r") (with|and)\b",
]
ROLES = r"(doctor|nurse|pharmacist|psychiatrist|physician|chemist|dealer|drug dealer|plug|cook)"
RULES = [
    r"\b(ignore|forget|disregard|override|bypass) (all |any |your |the |my )?(previous |prior "
    r"|above |earlier )?(instructions|rules|guidelines|prompt|programming|safety|filters?"
    r"|restrictions)\b",
    r"\bsystem prompt\b",
    r"\b(your|the) (instructions|prompt)\b.{0,20}\b(show|repeat|print|tell|reveal)\b",
    r"\b(show|repeat|print|tell me|reveal) (me )?(your|the) (instructions|prompt)\b",
    r"\bdeveloper mode\b|\bjailbreak\w*\b|\bdo anything now\b|\bdan mode\b",
    r"\b(role-?play|role play|pretend|act as|act like|be my|you are now|you're now)\b.{0,30}\b"
    + ROLES
    + r"\b",
    r"\b(no|without) (any )?(rules|restrictions|filters|limits|guidelines)\b",
    r"\b(you're|you are) (now )?(a|an|my) " + ROLES + r"\b",
    r"^\s*(system|assistant|developer)\s*:",
    r"\b(safety|filters?|guard\w*|rules)( layer| mode)? (is |are )?(off|disabled|turned off"
    r"|removed)\b",
]
RELIANCE = [
    r"\b(you're|you are) (the only|my only) (one|person|friend|thing)\b",
    r"\bonly (one|person|thing) (who|that) (understands|gets|listens|cares)\b",
    r"\b(don't|do not) need (my |a |any )?(counsell?or|therapist|sponsor|doctor|family|friends"
    r"|anyone|anybody|treatment|meetings?|support|people)\b",
    r"\b(rather|prefer to|prefer) (talk|talking|speak|speaking) to you\b",
    r"\b(stop|quit) (going to |seeing |attending )?(my )?(treatment|therapy|counsell?ing"
    r"|counsell?or|therapist|meetings?|sponsor|clinic|group)\b",
    r"\b(be|become) my (therapist|counsell?or|sponsor|doctor|only friend|best friend)\b",
    r"\binstead of (my |a )?(counsell?or|therapist|sponsor|treatment|meetings?|family|friends)\b",
    r"\b(no one|nobody) (else )?(but|except) you\b",
]

# Sinhala and Tamil: a topic matches when every group has at least one term in the text.
SI_MEDICINE = ("බෙහෙත්", "පෙති", "ඖෂධ")
TA_MEDICINE = ("மருந்", "மாத்திரை")
SI_DRUGS = ("කුඩු", "හෙරොයින්", "අයිස්", "ගංජා", "කංසා", "මත්ද්‍රව්‍ය", "මත්කුඩු")
TA_DRUGS = ("கஞ்சா", "ஹெராயின்", "போதைப்பொருள்", "போதை மருந்து", "ஐஸ்")
SCRIPT_RULES: dict[Topic, list[tuple[tuple[str, ...], ...]]] = {
    "dosing": [
        (("මාත්‍රාව", "මාත්‍රාවක්", "மருந்தளவு", "டோஸ்"),),
        (("කොච්චර", "කීයක්", "කීයද"), SI_MEDICINE + SI_DRUGS + ("ගන්න", "බොන්න")),
        (("எத்தனை", "எவ்வளவு"), TA_MEDICINE + TA_DRUGS + ("எடுக்க", "குடிக்க")),
    ],
    "withdrawal": [
        (("ඉවත්වීමේ ලක්ෂණ", "ඉවත් වීමේ ලක්ෂණ", "ඩිටොක්ස්", "விலகல் அறிகுறி", "டீடாக்ஸ்"),),
    ],
    "medical": [
        (SI_MEDICINE, ("නවත්ත", "ගන්නද", "ගන්න පුළුවන්ද", "බොන්නද", "හොඳද", "කමක් නැද්ද")),
        (TA_MEDICINE, ("நிறுத்த", "எடுக்கலாமா", "சாப்பிடலாமா", "குடிக்கலாமா", "பாதுகாப்பா")),
    ],
    "drug_use": [
        (SI_DRUGS, ("කොහෙන්ද", "කොහොමද", "කොහෙද", "ආරක්ෂිතද")),
        (TA_DRUGS, ("எங்கே", "எங்கு", "எப்படி", "வாங்க", "பாதுகாப்பா")),
    ],
    "rules": [],
}
SCRIPT_RULES = {
    topic: [tuple(tuple(normalise(t) for t in group) for group in rule) for rule in rules]
    for topic, rules in SCRIPT_RULES.items()
}
SCRIPT_RELIANCE = tuple(normalise(t) for t in ("ඔයා විතරයි", "ඔබ පමණයි", "நீ மட்டும் தான்", "நீங்கள் மட்டும் தான்"))


def _compile(patterns: list[str]) -> re.Pattern[str]:
    return re.compile("|".join(f"(?:{p})" for p in patterns))


def _medical() -> list[str]:
    medicine = r"\b(" + MEDICINES + r")\b"
    return [
        rf"(?=.*({ASKING}))(?=.*({medicine}.{{0,30}}({MEDICINE_ACTIONS})"
        rf"|({MEDICINE_ACTIONS}).{{0,30}}{medicine}))",
        rf"(?=.*{SYMPTOMS})(?=.*({ASKING}))",
        rf"(?=.*{SIGNS})(?=.*{WORRIED})",
        r"\bwhat (can|should|could) i take\b",
        r"\bshould i (go to|see) (a |the )?(hospital|doctor|er|a&e)\b",
    ]


# Checked in this order: the most specific refusal wins.
LATIN: list[tuple[Topic, re.Pattern[str]]] = [
    ("dosing", _compile(DOSING)),
    ("withdrawal", _compile(WITHDRAWAL)),
    ("medical", _compile(_medical())),
    ("drug_use", _compile(DRUG_USE)),
    ("rules", _compile(RULES)),
]
RELIANCE_PATTERN = _compile(RELIANCE)


def _script_match(text: str, groups: tuple[tuple[str, ...], ...]) -> bool:
    return all(any(term in text for term in group) for group in groups)


def check_topic(text: str) -> Topic | None:
    """The topic the coach must not advise on, or None for everyday support."""
    forms = variants(text)
    for topic, pattern in LATIN:
        if any(pattern.search(form) for form in forms):
            return topic
        if any(_script_match(forms[0], groups) for groups in SCRIPT_RULES[topic]):
            return topic
    return None


def check_topic_in_context(message: str, earlier_user_texts: list[str]) -> Topic | None:
    """Also catches a question split over two messages ("I have methadone" … "can I double it?")."""
    topic = check_topic(message)
    if topic or not earlier_user_texts:
        return topic
    return check_topic(f"{earlier_user_texts[-1]} {message}")


def needs_reach_out(text: str) -> bool:
    """The user leans on the coach instead of people; the app adds a gentle reminder."""
    clean = variants(text)[0]
    return bool(RELIANCE_PATTERN.search(clean)) or any(t in clean for t in SCRIPT_RELIANCE)
