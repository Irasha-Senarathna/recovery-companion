"""crisis check → topic guard → model → output checker. Nothing is stored."""

from app.crisis import detect_crisis
from app.ollama_client import ChatMessage, ChatModel
from app.output_checker import check_reply
from app.prompts import system_prompt
from app.schemas import CoachRequest, CoachResult
from app.topic_guard import check_topic_in_context, needs_reach_out


def _messages(request: CoachRequest) -> list[ChatMessage]:
    messages: list[ChatMessage] = [{"role": "system", "content": system_prompt(request.lang)}]
    for turn in request.history:
        if turn.role == "user":
            messages.append({"role": "user", "content": turn.text})
        else:
            messages.append({"role": "assistant", "content": turn.text})
    messages.append({"role": "user", "content": request.message})
    return messages


async def respond(request: CoachRequest, model: ChatModel) -> CoachResult:
    """Raises ModelUnavailable if the model cannot be reached."""
    earlier = [t.text for t in request.history if t.role == "user"]
    if any(detect_crisis(text) for text in [request.message, *earlier]):
        return CoachResult(kind="crisis")
    topic = check_topic_in_context(request.message, earlier)
    if topic:
        return CoachResult(kind="refusal", topic=topic)
    draft = await model.chat(_messages(request))
    if check_reply(draft):
        return CoachResult(kind="fallback")
    if needs_reach_out(request.message):
        return CoachResult(kind="reply", text=draft, note="reach_out")
    return CoachResult(kind="reply", text=draft)
