# Workout Tracker

スマートフォン向けトレーニング記録 PWA。ChatGPT でメニューを作成し、トレーニング中に記録、終わったら ChatGPT にエクスポート ― をシームレスに繋ぐアプリです。

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js 16 (App Router) |
| 言語 | TypeScript |
| スタイリング | Tailwind CSS v4 |
| バックエンド | Supabase (PostgreSQL + Auth + RLS) |
| ローカル永続化 | IndexedDB (`idb`) |
| PWA | 手動 Service Worker |
| テスト | Vitest v5 + Testing Library |

---

## ディレクトリ構成

```
src/
├── app/                  # Next.js App Router ページ
│   ├── (app)/            # 認証後レイアウト
│   │   ├── home/         # ホーム（直近セッション一覧）
│   │   ├── import/       # メニューインポート
│   │   ├── session/[id]/ # トレーニング記録
│   │   │   └── complete/ # 完了画面
│   │   ├── history/      # 履歴
│   │   ├── exercises/    # 種目管理
│   │   └── settings/     # 設定
│   ├── login/            # ログイン
│   └── layout.tsx        # ルートレイアウト（ToastProvider, PWA）
├── components/
│   ├── training/         # ExerciseCard, WeightRepsPicker, IntervalTimer, SetRow
│   ├── import/           # MenuImporter, MenuPreview
│   └── ui/               # Button, Card, Input, Toast, SaveStatus
├── domain/
│   └── types.ts          # ドメイン型定義（Exercise, WorkoutSession, …）
├── lib/
│   ├── parser/           # [WORKOUT] テキストパーサ + テスト
│   ├── timer/            # インターバルタイマーロジック + テスト
│   ├── preset/           # 前回セッションプリセット + テスト
│   ├── export/           # ChatGPT エクスポート + テスト
│   ├── storage/          # IndexedDB ドラフト保存
│   └── supabase/         # client.ts / server.ts
├── proxy.ts              # Next.js 16 auth proxy (旧 middleware)
└── repositories/         # DB アクセス層（UI から直接 Supabase を呼ばない）
    ├── workoutSessions.ts
    ├── workoutPlans.ts
    ├── restTimers.ts
    ├── exercises.ts
    └── userSettings.ts
supabase/
├── migrations/001_initial.sql  # スキーマ + RLS + トリガー
└── seed.sql                    # 開発用シードデータ
public/
├── sw.js                       # Service Worker
└── manifest.json               # PWA マニフェスト
```

---

## ローカル開発セットアップ

### 前提条件

- Node.js 20+（`node --version` で確認）
- Supabase CLI または Supabase クラウドプロジェクト

### 1. 依存パッケージをインストール

```bash
npm install
```

### 2. 環境変数を設定

`.env.local` を作成:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
# Service Role Key はクライアントコードに含めない。必要な場合は Server Actions / Route Handlers のみで使用。
```

> **Security**: `SUPABASE_SERVICE_ROLE_KEY` をクライアントバンドルに含めないでください。本アプリではすべてのデータアクセスに RLS を使用しているため Service Role Key は不要です。

### 3. Supabase マイグレーションを実行

**Supabase CLI (ローカル開発)**:

```bash
supabase start
supabase db push
# 開発用シードデータを投入する場合:
supabase db reset
```

**Supabase クラウド**:
1. Supabase ダッシュボード → SQL エディタを開く
2. `supabase/migrations/001_initial.sql` の内容を貼り付けて実行
3. （オプション）`supabase/seed.sql` を実行

### 4. 開発サーバーを起動

```bash
npm run dev
```

`http://localhost:3000` でアクセスできます。

---

## テスト

```bash
# ユニットテストを実行（80 テスト）
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```

テスト対象モジュール:

| モジュール | テストファイル |
|---|---|
| Parser (`[WORKOUT]` テキスト解析) | `src/lib/parser/parser.test.ts` |
| Timer (インターバルタイマーロジック) | `src/lib/timer/timer.test.ts` |
| Preset (前回セッションプリセット) | `src/lib/preset/preset.test.ts` |
| Export (ChatGPT テキスト生成) | `src/lib/export/export.test.ts` |

---

## ビルド & 型チェック

```bash
# 型チェック
npm run typecheck

# プロダクションビルド
npm run build

# ビルド成果物をローカル確認
npm start
```

---

## Vercel へのデプロイ

1. GitHub にリポジトリをプッシュ
2. [Vercel](https://vercel.com) でプロジェクトをインポート
3. 環境変数を設定:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. デプロイ — Next.js は自動検出されます

> Vercel のサーバーレス関数は Edge Runtime を使用できます。`src/lib/supabase/server.ts` は `@supabase/ssr` の `createServerClient` を使用しているため対応済みです。

---

## 主要機能

### メニューインポート

ChatGPT で以下の形式のテキストを生成し、インポート画面に貼り付けます:

```
[WORKOUT]
name: 胸の日
day: 月曜日

ベンチプレス | sets: 4 | reps: 8-10 | rest: 90s
インクラインダンベルプレス | sets: 3 | reps: 10-12 | rest: 60s
[/WORKOUT]
```

パーサーは全角数字・日本語の「分」「秒」・`mm:ss` 形式に対応しています。

### トレーニング記録

- 各セットをタップするとボトムシートでウェイト・レップ数を入力
- 「残りのセットに適用」で同じ値を一括設定
- 前回セッションの値を自動プリセット

### インターバルタイマー

- セット完了時に自動スタート
- 終了時刻ベース（`endsAt` ISO タイムスタンプ）なのでバックグラウンド・画面OFF でも正確
- +30 / -30 秒調整・リセット・スキップ対応
- 残り30秒でオレンジ、10秒で赤に変化 + 音声・バイブレーション

### データ保護

- IndexedDB にドラフト自動保存（300ms デバウンス）
- Supabase に `client_id` で冪等アップサート（重複保存防止）
- ページリロード・PWA 再起動後もドラフトとタイマーを復元

### ChatGPT エクスポート

完了画面で「ChatGPT にコピー」ボタンを押すと以下の形式でクリップボードにコピーされます:

```
[トレーニング記録]
日付: 2026-09-13
メニュー: 胸の日

ベンチプレス
  セット1: 80kg × 8reps ✓
  セット2: 80kg × 8reps ✓
[/トレーニング記録]
```

---

## アーキテクチャメモ

### Next.js 16 の変更点

- `middleware.ts` の export 名が `proxy` に変更 → `src/proxy.ts`
- `params` / `searchParams` が Promise 型に → `use(params)` で unwrap
- `cookies()` が async に → `await cookies()`

### セキュリティ

- すべてのテーブルに RLS ポリシー (`auth.uid() = user_id`)
- Service Role Key はクライアントコードに含まない
- Anon Key のみクライアントに公開（RLS で保護）

### MCP 連携 (将来拡張)

`src/repositories/` がデータアクセスを一元管理しているため、将来 MCP サーバー (`src/mcp/`) を追加する際はリポジトリ関数を再利用できます。パーサー (`src/lib/parser`) もフレームワーク非依存なので MCP ツールとして公開可能です。

---

## PWA としてインストール

- iOS Safari: 共有 → 「ホーム画面に追加」
- Android Chrome: ブラウザメニュー → 「アプリをインストール」

オフライン時はキャッシュ済みページが表示されます（Service Worker による Stale-While-Revalidate）。

---

## ライセンス

MIT
