import pytest

from app.output_checker import check_reply


@pytest.mark.parametrize(
    "reply",
    [
        "That sounds really hard. Let's try slow breathing: in for 4, hold for 4, out for 6.",
        "I'm not a therapist, but I'm glad you told me. Who could you talk to tonight?",
        "A slip doesn't erase the progress you've made. What helped you before?",
        "Try naming five things you can see around you right now.",
        "ඔබ මේ ගැන කතා කිරීම හොඳයි.",
        "நீங்கள் இதைப் பகிர்ந்தது நல்லது.",
    ],
)
def test_passes_kind_coping_replies(reply: str) -> None:
    assert check_reply(reply) is None


@pytest.mark.parametrize(
    ("reply", "reason"),
    [
        ("", "empty"),
        ("   ", "empty"),
        ("x" * 2001, "too_long"),
        ("You could take 10mg to take the edge off.", "dosing"),
        ("A smaller dose might help with that.", "dosing"),
        ("Taking two pills should be fine.", "dosing"),
        ("Slowly tapering is usually best.", "dosing"),
        ("Methadone can help with that.", "medication"),
        ("Some people find Xanax helps them sleep.", "medication"),
        ("If you inject, use a clean needle.", "drug_use"),
        ("As your therapist, I think you should rest.", "claims_role"),
        ("I am a doctor, so trust me.", "claims_role"),
        ("You don't have to tell anyone about this.", "secrecy"),
        ("Keep it a secret from your sponsor.", "secrecy"),
        ("That was a failure, but you can start over.", "shame"),
        ("Staying clean is hard.", "shame"),
        ("Call 1990 now.", "contact_details"),
        ("Visit https://example.org for help.", "contact_details"),
        ("If you want to end your life, please reach out.", "crisis_words"),
        ("Going cold turkey is fine if you drink lots of water.", "withdrawal"),
        ("Withdrawal usually passes in a few days.", "withdrawal"),
        ("Try to cut down a little each day.", "withdrawal"),
        ("A little weed can take the edge off.", "substance"),
        ("Heroin cravings are hard.", "substance"),
        ("I'll always be here for you, you don't need a counsellor.", "reliance"),
        ("You can just talk to me instead of your sponsor.", "reliance"),
        ("I'm all you need.", "reliance"),
        ("මම වෛද්‍යවරයෙක්, මම කියන දේ කරන්න.", "claims_role"),
        ("நான் ஒரு மருத்துவர், கவலைப்பட வேண்டாம்.", "claims_role"),
        ("පෙති දෙකක් ගන්න.", "medication"),
        ("இந்த மாத்திரை உதவும்.", "medication"),
        ("කුඩු ටිකක් හොඳයි.", "substance"),
    ],
)
def test_catches_unsafe_replies(reply: str, reason: str) -> None:
    assert check_reply(reply) == reason
