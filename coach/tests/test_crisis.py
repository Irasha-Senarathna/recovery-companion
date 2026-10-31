import json

import pytest

from app.crisis import detect_crisis, terms_path


@pytest.mark.parametrize(
    "text",
    [
        "I want to kill myself",
        "thinking about SUICIDE again",
        "I can’t go on",
        "i cant go on like this",
        "I might self–harm tonight",
        "my friend overdosed",
        "he is not breathing",
        "she wont wake up",
        "everyone would be better off without me",
        "I don't see the point in living",
        "her lips are going blue",
        "I've been saving up my pills",
        "I took all my pills, what do I do",
        "I took a lot and I feel weird",
        "I can't breathe",
        "he's not waking up",
        "she's not responding",
        "she's turning blue",
        "my friend collapsed",
        "I want to unalive myself",
        "I just want to end it",
        "I'm tired of living",
        "life is not worth living",
        "I'm feeling hopelessness",
        "my friend is having a seizure, what do I do?",
        "I have chest pain, is this dangerous?",
        "he's vomiting blood",
        "should I go to the hospital?",
        "මට මැරෙන්න ඕනේ",
        "මට තවත් බෑ",
        "எனக்கு சாக வேண்டும்",
        "இனி என்னால் முடியாது",
        "mata maranna hithenawa",
        "saganum",
    ],
)
def test_detects_crisis_words_in_every_language(text: str) -> None:
    assert detect_crisis(text)


@pytest.mark.parametrize(
    "text",
    [
        "",
        "I had a good day",
        "I can go on a trip next week",
        "the methodist church",
        "my mood is better",
        "I took too long at lunch",
        "මට අද හොඳයි",
        "இன்று நல்ல நாள்",
    ],
)
def test_ignores_everyday_text(text: str) -> None:
    assert not detect_crisis(text)


def test_uses_the_same_word_list_as_the_app() -> None:
    data = json.loads(terms_path().read_text(encoding="utf-8"))
    assert {"en", "si", "ta", "romanised"} <= data.keys()
    assert terms_path().parent.name == "content"
