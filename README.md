# Nulab Backlog Actions

GitHub Pull Requests と Nulab Backlog を連携するための GitHub Actions です。

GitHub の Issue - Pull Request 連携のような機能を Backlog で実現します。

## 機能

### 1. PR作成時のコメント追加
Pull Request（ドラフトを除く）が作成されると、タイトルや説明に含まれる Backlog 課題に PR の URL をコメントとして追加します。

### 2. PRマージ時のステータス自動変更
Pull Request がマージされると、アノテーションに基づいて Backlog 課題のステータスを自動的に変更します。

| アノテーション | ステータス |
|--------------|----------|
| `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved` | 処理済み |
| `close`, `closes`, `closed` | 完了 |

## アノテーション形式

PR のタイトルまたは説明に以下の形式でアノテーションを記述します：

```
fixes PROJECT-123
close: PROJECT-456
resolves #PROJECT-789
```

課題キーは大文字のプロジェクトキーとハイフン、数字の組み合わせです（例: `PROJ-123`, `MY_PROJECT-1`）。

## セットアップ

### 1. Backlog API キーの取得

1. Backlog にログイン
2. 個人設定 → API → 新しい API キーを発行
3. 発行された API キーをコピー

### 2. GitHub Secrets の設定

リポジトリの Settings → Secrets and variables → Actions で以下のシークレットを追加：

- `BACKLOG_HOST`: Backlog のホスト名（例: `example.backlog.com`）
- `BACKLOG_API_KEY`: Backlog API キー

### 3. ワークフローの設定

`.github/workflows/backlog.yml` を作成：

```yaml
name: Backlog Integration

on:
  pull_request:
    types: [opened, reopened, ready_for_review, closed]

jobs:
  backlog:
    runs-on: ubuntu-latest
    steps:
      - uses: atman-inc/nulab-backlog-actions@v1
        with:
          backlog_host: ${{ secrets.BACKLOG_HOST }}
          backlog_api_key: ${{ secrets.BACKLOG_API_KEY }}
```

## 入力パラメータ

| パラメータ | 必須 | デフォルト | 説明 |
|-----------|------|-----------|------|
| `backlog_host` | ✅ | - | Backlog のホスト名 |
| `backlog_api_key` | ✅ | - | Backlog API キー |
| `add_comment` | - | `true` | PR作成時にコメントを追加するか |
| `update_status_on_merge` | - | `true` | マージ時にステータスを変更するか |
| `fix_status_id` | - | `3` | fix系アノテーションで設定するステータスID |
| `close_status_id` | - | `4` | close系アノテーションで設定するステータスID |

### カスタムステータスIDの確認

プロジェクトでカスタムステータスを使用している場合、Backlog API でステータス一覧を取得できます：

```bash
curl "https://YOUR_HOST/api/v2/projects/PROJECT_KEY/statuses?apiKey=YOUR_API_KEY"
```

## 使用例

### PR作成時
```
タイトル: PROJ-123 ログイン機能の修正

説明:
ログイン時のバリデーションエラーを修正しました。
fixes PROJ-123
```

→ Backlog の PROJ-123 に「GitHub Pull Request がオープンされました」というコメントが追加されます。

### PRマージ時
```
タイトル: fixes PROJ-456 ユーザー登録のバグ修正
```

→ マージ時に PROJ-456 のステータスが「処理済み」に変更されます。

### 複数の課題を参照
```
説明:
この PR では以下の課題を解決します：
fixes PROJ-123
closes PROJ-456
```

→ マージ時に PROJ-123 は「処理済み」、PROJ-456 は「完了」に変更されます。

## 動作環境

- Node.js 20
- GitHub Actions

## ライセンス

MIT License
