# 入居者サポートAI — Demo UI

チャット形式で Agent SDK をローカル実行するデモ環境です。

## ディレクトリ構成
```
demo_ui/
├── app.py              # Flask サーバー（会話履歴管理・ルーティング）
├── main.py             # ← ここに SDK の main.py をコピーする
├── requirements.txt
├── .env                # ← .env.example をコピーして作成
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── app.js
```

## セットアップ

### 1. main.py を配置する
```bash
cp /path/to/your/main.py /Users/matsuuratsubasa/Antigravity/demo_ui/main.py
# または tenant_chat_ai から
cp ../tenant_chat_ai/main.py ./main.py
```

### 2. .env を作成する
```bash
cp .env.example .env
# .env を編集して OPENAI_API_KEY を設定
```

### 3. 依存パッケージをインストール
既存の tenant_chat_ai の venv を使う場合（推奨）:
```bash
../tenant_chat_ai/venv/bin/pip install flask python-dotenv
```

または新しい venv を作る場合:
```bash
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
# さらに tenant_chat_ai と同じパッケージも必要
./venv/bin/pip install openai-agents pydantic python-dotenv
```

### 4. サーバーを起動する
```bash
# tenant_chat_ai の venv を使う場合
../tenant_chat_ai/venv/bin/python app.py

# または自前 venv の場合
./venv/bin/python app.py
```

### 5. ブラウザでアクセス
```
http://localhost:5050
```

## 機能

| 機能 | 説明 |
|------|------|
| テキスト入力 | 自由テキストを送信（Enter で送信） |
| ボタン選択 | AI が出した選択肢をクリックすると自動送信 |
| 会話履歴保持 | セッション内で history を維持（ループ防止） |
| Router 分離 | router の出力を user history に混入させない改善済み |
| リセット | ヘッダーの「リセット」ボタンで会話をクリア |

## main.py の要件

demo_ui/app.py は以下を import します。main.py に定義されている必要があります：

```python
tenant_support_runner  # 入居者対応エージェント
router_runner          # ルーターエージェント
output                 # 出力エージェント
```

## ポート変更

`app.py` 最終行の `port=5050` を変更してください。
