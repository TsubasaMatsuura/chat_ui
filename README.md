# 入居者サポートAI — UI Demo

Agent SDK をローカルで動作させ、チャット形式で会話できるデモアプリケーションです。
（会話履歴の保持、ルーターの文脈分離など実運用を想定した挙動になっています）

## 📦 初期設定の手順

このリポジトリを `clone` して最初に動かすためのセットアップ手順です。

### 1. リポジトリのクローン
```bash
git clone https://github.com/TsubasaMatsuura/chat_ui.git
cd chat_ui
```

### 2. `main.py` の配置
SDKのエージェント設定ファイルである `main.py` はリポジトリに含まれていません。
ご自身の `main.py` を本ディレクトリ直下（`app.py` と同じ階層）にコピーして配置してください。

※ `main.py` には以下の変数が定義されている必要があります：
- `tenant_support_runner` （入居者対応エージェント）
- `router_runner` （ルーターエージェント）
- `output` （出力エージェント）

### 3. 環境変数の設定
APIの認証情報を設定するために `.env` ファイルを作成します。
```bash
touch .env
```
作成した `.env` ファイルに、以下の内容を記述して保存してください：
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxx
SECRET_KEY=demo-secret-key-change-me
```

- **OPENAI_API_KEY**: 有効な OpenAI API キーを設定してください。
- **SECRET_KEY**: Webサイトのセッション（ログインや履歴の一次保存）を暗号化するための合言葉です。任意の長いランダムな文字列を設定してください。

### 4. 仮想環境の作成と依存ライブラリのインストール
Python の仮想環境（venv）を作成し、必要なライブラリをインストールします。

```bash
# 仮想環境の作成
python -m venv venv

# 仮想環境のアクティベート（Mac/Linux の場合）
source venv/bin/activate
# ※ Windows の場合は: .\venv\Scripts\activate

# ライブラリのインストール
pip install -r requirements.txt
pip install openai-agents pydantic python-dotenv flask
```

### 5. アプリケーションの起動
セットアップが完了したら、サーバーを起動します。

```bash
python app.py
```

### 6. デモ画面へのアクセス
起動後、ブラウザで以下のURLにアクセスしてください：
👉 http://localhost:5050


## 💡 特徴
- **文脈（会話履歴）の維持**: ユーザーの入力とアシスタントの応答をバックエンドで保持し、ループ現象を防止。
- **UI コンポーネント化**: Assistantが返す `text` の表示と、`button` 配列を活用した選択肢クリック送信。
- **ルーターの分離**: RouterAgentの出力JSONがメインの会話文脈に混入しないよう別スコープで処理。
