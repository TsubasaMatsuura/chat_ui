import asyncio
import uuid
import sys
import os
from flask import Flask, render_template, request, jsonify, session
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'demo-secret-key-change-me')

# In-memory conversation storage: session_id -> conversation history list
_conversations: dict[str, list] = {}

# Cached agent references
_agents = None


def load_agents():
    """Import agents from user-placed main.py."""
    global _agents
    if _agents is not None:
        return _agents
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import main as m
        _agents = {
            'router': m.router_runner,
            'tenant': m.tenant_support_runner,
            'output': m.output,
        }
        return _agents
    except ImportError as e:
        raise RuntimeError(
            f"main.py が見つかりません。demo_ui/ に SDK の main.py を配置してください。\n{e}"
        )
    except AttributeError as e:
        raise RuntimeError(
            f"main.py に必要なエージェントが定義されていません。"
            f"tenant_support_runner, router_runner, output が必要です。\n{e}"
        )


def get_history(sid: str) -> list:
    if sid not in _conversations:
        _conversations[sid] = []
    return _conversations[sid]


async def process_turn(user_message: str, history: list) -> dict:
    """
    Process one conversation turn.
    Key fixes vs original main.py:
      1. history persists between calls (passed in from session)
      2. router output is NOT added to user history (prevents context pollution)
      3. only tenant/output agent responses are added to history
    """
    from agents import Runner

    agents = load_agents()

    # Add user message to history
    history.append({
        "role": "user",
        "content": [{"type": "input_text", "text": user_message}]
    })

    # === Router (separate scope — do NOT pollute user history) ===
    try:
        router_result = await Runner.run(agents['router'], input=list(history))
        route = router_result.final_output.model_dump().get("root", "入居者対応")
    except Exception as e:
        history.pop()  # rollback
        return {"text": f"ルーターエラー: {e}", "button": [], "complete_flag": False, "type": "error"}

    if route == "契約":
        return {
            "text": "契約に関するお問い合わせは、担当窓口よりご案内いたします。",
            "button": [],
            "complete_flag": True,
            "type": "contract"
        }

    if route == "対象外":
        return {
            "text": "申し訳ございませんが、賃貸住宅のお困りごと以外は受付対象外となります。",
            "button": [],
            "complete_flag": False,
            "type": "rejected"
        }

    # === Tenant Support Agent ===
    try:
        ts_result = await Runner.run(agents['tenant'], input=list(history))
        # Add agent response to history for the NEXT turn
        history.extend([item.to_input_item() for item in ts_result.new_items])
        ts_output = ts_result.final_output.model_dump()
    except Exception as e:
        history.pop()  # rollback
        return {"text": f"エージェントエラー: {e}", "button": [], "complete_flag": False, "type": "error"}

    # === If conversation is complete, run Output Agent ===
    if ts_output.get("complete_flag"):
        try:
            out_input = list(history) + [{
                "role": "user",
                "content": [{
                    "type": "input_text",
                    "text": f"{ts_output.get('user_summary', '')} {ts_output.get('company_summary', '')}"
                }]
            }]
            out_result = await Runner.run(agents['output'], input=out_input)
            history.extend([item.to_input_item() for item in out_result.new_items])
            out_data = out_result.final_output.model_dump()
        except Exception:
            out_data = {}

        return {
            "text": ts_output.get("text", ""),
            "button": ts_output.get("button", []),
            "complete_flag": True,
            "user_summary": ts_output.get("user_summary", ""),
            "company_summary": out_data.get("company_summary", ""),
            "suggest": out_data.get("suggest", ""),
            "title": ts_output.get("title", ""),
            "type": "complete"
        }

    # === Ongoing conversation ===
    return {
        "text": ts_output.get("text", ""),
        "button": ts_output.get("button", []),
        "complete_flag": False,
        "self_resolve_flag": ts_output.get("self_resolve_flag", False),
        "attachment_flag": ts_output.get("attachment_flag", False),
        "title": ts_output.get("title", ""),
        "type": "ongoing"
    }


@app.route("/")
def index():
    if 'sid' not in session:
        session['sid'] = str(uuid.uuid4())
    return render_template("index.html")


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    user_message = data.get("message", "").strip()
    if not user_message:
        return jsonify({"error": "メッセージが空です"}), 400

    sid = session.get('sid')
    if not sid:
        sid = str(uuid.uuid4())
        session['sid'] = sid

    history = get_history(sid)

    try:
        result = asyncio.run(process_turn(user_message, history))
    except Exception as e:
        return jsonify({
            "error": str(e),
            "text": f"エラーが発生しました: {e}",
            "button": [],
            "complete_flag": False,
            "type": "error"
        }), 500

    return jsonify(result)


@app.route("/api/reset", methods=["POST"])
def reset():
    sid = session.get('sid')
    if sid:
        _conversations[sid] = []
    return jsonify({"status": "ok"})


@app.route("/api/status")
def status():
    try:
        agents = load_agents()
        return jsonify({
            "status": "ready",
            "agents": list(agents.keys()),
            "active_sessions": len(_conversations)
        })
    except Exception as e:
        return jsonify({"status": "error", "error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("🚀  Demo UI  →  http://localhost:5050")
    print("📁  demo_ui/ に main.py を置いてください")
    print("=" * 50)
    app.run(debug=True, port=5050, use_reloader=False)
